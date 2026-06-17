/**
 * @slidegen/core
 * Markdown→スライドのレンダリングと PPTX テーマ抽出の共有ロジック。
 * Electron / puppeteer に非依存（純 JS）。CLI とデスクトップ双方から利用する。
 */
export {
  renderDeck,
  createMarp,
  buildHtmlDocument,
  DEFAULT_SLIDE,
} from "./render.mjs";

export {
  extractThemeFromPptx,
  parseThemeXml,
  renderThemeCss,
  slugify,
} from "./extract-theme.mjs";

export {
  THEMES_DIR,
  loadBuiltinThemes,
  themeNameFromCss,
  BUILTIN_MARP_THEMES,
} from "./themes.mjs";
