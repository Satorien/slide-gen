/**
 * render.mjs
 * @marp-team/marp-core を用いて Markdown を HTML+CSS に変換する。
 *
 * プレビュー(デスクトップ)・出力(デスクトップのネイティブ書き出し)の双方が
 * この単一の renderDeck() を使うため、「プレビュー == 出力」が保証される。
 */
import { Marp } from "@marp-team/marp-core";
import { loadBuiltinThemes } from "./themes.mjs";

/** スライドの既定サイズ(16:9, px)。テーマの @size 指定があればそちらが優先される。 */
export const DEFAULT_SLIDE = { width: 1280, height: 720 };

/**
 * Marp インスタンスを生成し、与えられたテーマ群を登録する。
 * @param {object} [opts]
 * @param {"mathjax"|"katex"|false} [opts.math="mathjax"] 数式エンジン(プレビュー/出力で固定)
 * @param {Array<{css:string}>} [opts.themes] 追加登録するテーマ群
 * @param {boolean} [opts.html=false] Markdown 内の生 HTML を許可するか
 */
export function createMarp({ math = "mathjax", themes = [], html = false } = {}) {
  const marp = new Marp({ html, math });
  for (const t of themes) {
    if (t?.css) marp.themeSet.add(t.css);
  }
  return marp;
}

/**
 * Markdown を描画して { html, css, slideCount, size } を返す。
 * @param {string} markdown 入力 Markdown
 * @param {object} [opts]
 * @param {string} [opts.theme] 既定テーマ名(フロントマターの theme 指定が優先)
 * @param {"mathjax"|"katex"|false} [opts.math="mathjax"]
 * @param {Array<{name:string,css:string}>} [opts.themes] テーマ群(既定: core 同梱)
 * @param {boolean} [opts.html=false]
 */
export function renderDeck(markdown, { theme, math = "mathjax", themes, html = false } = {}) {
  const themeList = themes ?? loadBuiltinThemes();
  const marp = createMarp({ math, themes: themeList, html });

  // フロントマターに theme 指定が無い場合の既定テーマを設定する。
  if (theme) {
    const t = marp.themeSet.get(theme);
    if (t) marp.themeSet.default = t;
  }

  const result = marp.render(markdown);
  const slideCount = (result.html.match(/<section/g) || []).length;

  // テーマ由来のスライドサイズ(marp-core は theme.widthPixel/heightPixel を持つ)
  const used = marp.lastGlobalDirectives?.theme;
  const usedTheme = used ? marp.themeSet.get(used) : marp.themeSet.default;
  const size = {
    width: usedTheme?.widthPixel || DEFAULT_SLIDE.width,
    height: usedTheme?.heightPixel || DEFAULT_SLIDE.height,
  };

  return { html: result.html, css: result.css, slideCount, size };
}

/**
 * renderDeck の結果を、単体で表示・印刷できる完全な HTML 文書に組み立てる。
 * デスクトップのプレビュー iframe / ネイティブ出力 / CLI の HTML 出力で共用する。
 * @param {{html:string,css:string}} rendered renderDeck の戻り値
 * @param {object} [opts]
 * @param {string} [opts.title="Slides"] ドキュメントタイトル
 * @param {string} [opts.extraHead] <head> に差し込む追加 HTML(フォント @font-face 等)
 * @param {string} [opts.lang="ja"]
 */
export function buildHtmlDocument(rendered, { title = "Slides", extraHead = "", lang = "ja" } = {}) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${extraHead}
<style>${rendered.css}</style>
</head>
<body>
${rendered.html}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
