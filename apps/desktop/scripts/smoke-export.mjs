/**
 * Electron 配下で出力パイプラインを検証するスモークテスト。
 *   実行: electron apps/desktop/scripts/smoke-export.mjs
 * 非表示(オフスクリーン)で example.md を PDF/PPTX/PNG に出力して検査する。
 * Electron の console は Windows で端末に届かないため、進捗は逐次 JSON へ書く。
 */
import { app, BrowserWindow } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, mkdir, stat } from "node:fs/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import { exportDeck } from "../src/main/export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const slidesMd = join(ROOT, "slides", "example.md");
const outDir = join(__dirname, "..", "smoke-out");
const resultPath = join(outDir, "smoke-result.json");

const result = { stage: "start", ok: false, steps: {}, error: null };
mkdirSync(outDir, { recursive: true });
const flush = () => {
  try {
    writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf8");
  } catch {}
};
flush();

process.on("uncaughtException", (e) => {
  result.error = "uncaught: " + (e?.stack || String(e));
  flush();
  app.exit(1);
});
process.on("unhandledRejection", (e) => {
  result.error = "unhandledRejection: " + (e?.stack || String(e));
  flush();
  app.exit(1);
});

app.disableHardwareAcceleration();

// 出力ごとに一時ウィンドウを破棄するため、既定の「全ウィンドウ閉=終了」を抑止する。
app.on("window-all-closed", () => {});

app.on("render-process-gone", (_e, _wc, details) => {
  result.error = "render-process-gone: " + JSON.stringify(details);
  flush();
});
app.on("child-process-gone", (_e, details) => {
  result.error = "child-process-gone: " + JSON.stringify(details);
  flush();
});

app.whenReady().then(async () => {
  try {
    const md = await readFile(slidesMd, "utf8");
    const opts = {}; // example.md のフロントマターに theme: corporate

    result.stage = "pdf";
    flush();
    const pdf = await exportDeck({ markdown: md, opts, format: "pdf", outPath: join(outDir, "deck.pdf") });
    result.steps.pdf = { file: pdf[0], size: (await stat(pdf[0])).size };
    flush();

    result.stage = "pptx";
    flush();
    const pptx = await exportDeck({ markdown: md, opts, format: "pptx", outPath: join(outDir, "deck.pptx") });
    result.steps.pptx = { file: pptx[0], size: (await stat(pptx[0])).size };
    flush();

    result.stage = "png";
    flush();
    const png = await exportDeck({ markdown: md, opts, format: "png", outDir, base: "slide" });
    result.steps.png = { count: png.length, firstSize: (await stat(png[0])).size };
    flush();

    result.stage = "assert";
    if (result.steps.pdf.size < 1000) throw new Error("PDF too small");
    if (result.steps.pptx.size < 5000) throw new Error("PPTX too small");
    if (result.steps.png.count < 1 || result.steps.png.firstSize < 1000) throw new Error("PNG failed");

    result.ok = true;
    result.stage = "done";
  } catch (e) {
    result.error = (result.stage ? `[${result.stage}] ` : "") + (e?.stack || String(e));
  } finally {
    flush();
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
    app.exit(result.ok ? 0 : 1);
  }
});
