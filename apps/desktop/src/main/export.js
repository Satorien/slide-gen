/**
 * ネイティブ出力パイプライン(main プロセス)。
 * marp-cli / puppeteer / 外部ブラウザを使わず、Electron 内蔵 Chromium で出力する。
 *   - PDF : webContents.printToPDF()         (ベクター, テキスト選択可)
 *   - PNG : webContents.capturePage()         (スライドごと)
 *   - PPTX: pptxgenjs(各スライド画像を全面背景) (marp-cli 既定と同一の画像ベース)
 *
 * プレビューと同じ core.renderDeck() を使うため「プレビュー == 出力」。
 */
import { BrowserWindow } from "electron";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderDeck, buildHtmlDocument } from "@slidegen/core";
import PptxGenJS from "pptxgenjs";

/** 出力用の完全な HTML 文書(@page サイズ・改ページ・余白0を注入)を作る。 */
function buildExportDoc(markdown, { theme, themes } = {}) {
  const rendered = renderDeck(markdown, { theme, themes });
  const { width, height } = rendered.size;
  const printCss = `
    html,body{margin:0!important;padding:0!important;background:#fff;}
    /* スクロールは capture 用に残しつつ、スクロールバーは写り込ませない */
    html{scrollbar-width:none;-ms-overflow-style:none;}
    body::-webkit-scrollbar,html::-webkit-scrollbar{width:0!important;height:0!important;display:none;}
    section{margin:0!important;page-break-after:always;break-after:page;}
    section:last-of-type{page-break-after:auto;break-after:auto;}
    @page{size:${width}px ${height}px;margin:0;}
  `;
  const doc = buildHtmlDocument(rendered, {
    extraHead: `<style>${printCss}</style>`,
  });
  return { doc, size: rendered.size, slideCount: Math.max(1, rendered.slideCount) };
}

/** 非表示ウィンドウにデッキを読み込み、フォント読込完了を待ってから fn を実行。 */
async function withDeckWindow(doc, size, fn) {
  // オフスクリーンレンダリング: 可視ウィンドウ無しで確実に描画でき、
  // 'paint' イベントからフレーム画像を取得できる(ヘッドレス対応の正攻法)。
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setFrameRate(60);
  const tmp = join(
    tmpdir(),
    `slidegen-export-${Date.now()}-${Math.round(Math.random() * 1e6)}.html`
  );
  try {
    await writeFile(tmp, doc, "utf8");
    await win.loadFile(tmp);
    // フォント読込 + 2フレーム待機(レイアウト確定)
    await win.webContents.executeJavaScript(
      "(async()=>{try{await document.fonts.ready}catch{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()"
    );
    return await fn(win);
  } finally {
    win.destroy();
    await unlink(tmp).catch(() => {});
  }
}

/** 指定スライドを最上部にスクロールして 1 枚キャプチャ。 */
async function captureSlide(win, index, size) {
  await win.webContents.executeJavaScript(
    `(async()=>{window.scrollTo(0, ${index} * ${size.height});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()`
  );
  const img = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
  });
  return img;
}

export async function exportPdf(markdown, opts, outPath) {
  const { doc, size } = buildExportDoc(markdown, opts);
  await withDeckWindow(doc, size, async (win) => {
    const data = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: "none" },
      pageSize: { width: size.width / 96, height: size.height / 96 },
    });
    await writeFile(outPath, data);
  });
  return outPath;
}

export async function exportPng(markdown, opts, outDir, base) {
  const { doc, size, slideCount } = buildExportDoc(markdown, opts);
  const files = [];
  await withDeckWindow(doc, size, async (win) => {
    for (let i = 0; i < slideCount; i++) {
      const img = await captureSlide(win, i, size);
      const name =
        slideCount > 1 ? `${base}.${String(i + 1).padStart(3, "0")}.png` : `${base}.png`;
      const out = join(outDir, name);
      await writeFile(out, img.toPNG());
      files.push(out);
    }
  });
  return files;
}

export async function exportPptx(markdown, opts, outPath) {
  const { doc, size, slideCount } = buildExportDoc(markdown, opts);
  const pptx = new PptxGenJS();
  const widthIn = 13.333;
  const heightIn = +(widthIn * (size.height / size.width)).toFixed(3);
  pptx.defineLayout({ name: "SLIDEGEN", width: widthIn, height: heightIn });
  pptx.layout = "SLIDEGEN";

  await withDeckWindow(doc, size, async (win) => {
    for (let i = 0; i < slideCount; i++) {
      const img = await captureSlide(win, i, size);
      const dataUrl = "data:image/png;base64," + img.toPNG().toString("base64");
      const slide = pptx.addSlide();
      slide.background = { data: dataUrl };
    }
  });

  await pptx.writeFile({ fileName: outPath });
  return outPath;
}

/** 形式に応じて出力。PNG は複数ファイルになり得るので配列で返す。 */
export async function exportDeck({ markdown, opts, format, outPath, outDir, base }) {
  switch (format) {
    case "pdf":
      return [await exportPdf(markdown, opts, outPath)];
    case "pptx":
      return [await exportPptx(markdown, opts, outPath)];
    case "png":
      return await exportPng(markdown, opts, outDir, base);
    case "html": {
      const { doc } = buildExportDoc(markdown, opts);
      await writeFile(outPath, doc, "utf8");
      return [outPath];
    }
    default:
      throw new Error(`未対応のフォーマット: ${format}`);
  }
}
