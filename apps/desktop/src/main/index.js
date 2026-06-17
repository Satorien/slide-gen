/**
 * Electron main プロセス。
 * - ウィンドウ生成
 * - IPC: レンダリング(プレビュー) / 出力 / ファイル open-save / PPTXテーマ取込
 */
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join, basename, extname, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { renderDeck, buildHtmlDocument, extractThemeFromPptx } from "@slidegen/core";
import { getThemes, userThemesDir } from "./themes.js";
import { exportDeck } from "./export.js";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 820,
    minHeight: 560,
    show: false,
    backgroundColor: "#1e1f22",
    title: "Slide Generator",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}

// --- プレビュー用 HTML 文書(スライドをiframe幅に合わせて縮小表示) ---
function buildPreviewDoc(markdown, theme, themes) {
  const rendered = renderDeck(markdown, { theme, themes });
  const { width } = rendered.size;
  const css =
    "html,body{margin:0;background:#3b3f45;}" +
    "body{display:flex;flex-direction:column;align-items:center;gap:18px;padding:18px;box-sizing:border-box;}" +
    "section{box-shadow:0 6px 20px rgba(0,0,0,.45);}";
  const script =
    `<script>(function(){var W=${width};function fit(){var vw=document.documentElement.clientWidth-36;` +
    `var z=Math.min(1,vw/W);document.querySelectorAll('section').forEach(function(s){s.style.zoom=z;});}` +
    `window.addEventListener('resize',fit);document.addEventListener('DOMContentLoaded',fit);fit();})();<\/script>`;
  const doc = buildHtmlDocument(rendered, {
    extraHead: `<style>${css}</style>${script}`,
  });
  return { doc, size: rendered.size, slideCount: rendered.slideCount };
}

function registerIpc() {
  ipcMain.handle("themes:list", () =>
    getThemes().map((t) => ({ name: t.name, source: t.source }))
  );

  ipcMain.handle("deck:render", (_e, { markdown, theme }) => {
    try {
      const themes = getThemes();
      return buildPreviewDoc(markdown ?? "", theme, themes);
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  });

  ipcMain.handle("file:open", async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (canceled || !filePaths[0]) return { canceled: true };
    const content = await readFile(filePaths[0], "utf8");
    return { path: filePaths[0], content };
  });

  ipcMain.handle("file:save", async (e, { content, path }) => {
    let target = path;
    if (!target) {
      const win = BrowserWindow.fromWebContents(e.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: "deck.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (canceled || !filePath) return { canceled: true };
      target = filePath;
    }
    await writeFile(target, content ?? "", "utf8");
    return { path: target };
  });

  ipcMain.handle("deck:export", async (e, { markdown, theme, format }) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const opts = { theme, themes: getThemes() };
    try {
      if (format === "png") {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
          title: "PNG の出力先フォルダを選択",
          properties: ["openDirectory", "createDirectory"],
        });
        if (canceled || !filePaths[0]) return { canceled: true };
        const files = await exportDeck({
          markdown,
          opts,
          format,
          outDir: filePaths[0],
          base: "slide",
        });
        return { ok: true, files };
      }
      const extMap = { pdf: "pdf", pptx: "pptx", html: "html" };
      const ext = extMap[format];
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: `deck.${ext}`,
        filters: [{ name: format.toUpperCase(), extensions: [ext] }],
      });
      if (canceled || !filePath) return { canceled: true };
      const files = await exportDeck({ markdown, opts, format, outPath: filePath });
      return { ok: true, files };
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  });

  ipcMain.handle("theme:importPptx", async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "テーマを抽出する PPTX を選択",
      properties: ["openFile"],
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
    });
    if (canceled || !filePaths[0]) return { canceled: true };
    try {
      const bytes = await readFile(filePaths[0]);
      const { css, themeName } = extractThemeFromPptx(bytes, {
        name: basename(filePaths[0], extname(filePaths[0])),
      });
      const out = join(userThemesDir(), `${themeName}.css`);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, css, "utf8");
      return { ok: true, name: themeName };
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// isDev は将来のデバッグ用フラグ(現状未使用箇所がある)
void isDev;
