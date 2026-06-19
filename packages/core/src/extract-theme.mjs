/**
 * extract-theme.mjs
 * PPTX から配色・フォントを抽出し、Marp 用テーマ(CSS)を生成する。
 *
 * src/extract_theme.py(Python, 廃止)の JS 移植版。
 * PPTX は実体が ZIP。ppt/theme/themeN.xml の <a:clrScheme>/<a:fontScheme> 等を読む。
 * 依存は純 JS の fflate(unzip) + fast-xml-parser(XML) のみ。
 */
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

// 配色スキームのキー(dk1/lt1=テキスト/背景1, dk2/lt2=同2, accent1-6, hlink)
const COLOR_KEYS = [
  "dk1", "lt1", "dk2", "lt2",
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "hlink",
];

// Office 標準の system color フォールバック
const SYS_COLOR_FALLBACK = { windowText: "000000", window: "FFFFFF" };
const DEFAULT_SLIDE_SIZE_EMU = { slideWidthEmu: 12192000, slideHeightEmu: 6858000 };
const DEFAULT_CLR_MAP = {
  bg1: "lt1",
  tx1: "dk1",
  bg2: "lt2",
  tx2: "dk2",
  accent1: "accent1",
  accent2: "accent2",
  accent3: "accent3",
  accent4: "accent4",
  accent5: "accent5",
  accent6: "accent6",
  hlink: "hlink",
  folHlink: "folHlink",
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
});

function toU8(pptxBytes) {
  return pptxBytes instanceof Uint8Array
    ? pptxBytes
    : new Uint8Array(pptxBytes instanceof ArrayBuffer ? pptxBytes : pptxBytes.buffer ?? pptxBytes);
}

function readPptxXmlParts(pptxBytes) {
  const files = unzipSync(toU8(pptxBytes), {
    filter: (f) =>
      /^ppt\/theme\/theme\d+\.xml$/.test(f.name) ||
      f.name === "ppt/presentation.xml" ||
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(f.name),
  });
  const themeNames = Object.keys(files).filter((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name)).sort();
  const masterNames = Object.keys(files).filter((name) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).sort();
  if (themeNames.length === 0) {
    throw new Error("PPTX 内に theme XML が見つかりませんでした。");
  }
  return {
    themeXml: strFromU8(files[themeNames[0]]),
    presentationXml: files["ppt/presentation.xml"] ? strFromU8(files["ppt/presentation.xml"]) : null,
    slideMasterXml: masterNames.length > 0 ? strFromU8(files[masterNames[0]]) : null,
  };
}

/** PPTX(Uint8Array/Buffer/ArrayBuffer) から最初のテーマ XML 文字列を取り出す。 */
function readThemeXml(pptxBytes) {
  return readPptxXmlParts(pptxBytes).themeXml;
}

/** 配色ノード(dk1 等の中身)から 6桁 HEX を取り出す。 */
function resolveColor(node) {
  if (!node || typeof node !== "object") return null;
  const srgb = node["a:srgbClr"];
  if (srgb && srgb["@_val"]) return String(srgb["@_val"]).toUpperCase();
  const sys = node["a:sysClr"];
  if (sys) {
    if (sys["@_lastClr"]) return String(sys["@_lastClr"]).toUpperCase();
    return SYS_COLOR_FALLBACK[sys["@_val"]] ?? null;
  }
  return null;
}

/** テーマ XML 文字列から色とフォントを抽出する。 */
export function parseThemeXml(xml) {
  const doc = xmlParser.parse(xml);
  const theme = doc["a:theme"] || {};
  const elements = theme["a:themeElements"] || {};

  const colors = {};
  const clrScheme = elements["a:clrScheme"];
  if (clrScheme) {
    for (const key of COLOR_KEYS) {
      const hex = resolveColor(clrScheme[`a:${key}`]);
      if (hex) colors[key] = hex;
    }
  }

  const fonts = {};
  const fontScheme = elements["a:fontScheme"];
  if (fontScheme) {
    const major = fontScheme["a:majorFont"];
    const minor = fontScheme["a:minorFont"];
    const latin = (f) => f?.["a:latin"]?.["@_typeface"] || null;
    const jpan = (f) => {
      const list = f?.["a:font"];
      const arr = Array.isArray(list) ? list : list ? [list] : [];
      const hit = arr.find((x) => x["@_script"] === "Jpan");
      return hit?.["@_typeface"] || null;
    };
    if (latin(major)) fonts.major = latin(major);
    if (latin(minor)) fonts.minor = latin(minor);
    if (jpan(major)) fonts.major_ja = jpan(major);
    if (jpan(minor)) fonts.minor_ja = jpan(minor);
  }

  return { name: theme["@_name"] || "extracted", colors, fonts };
}

/** presentation.xml からスライドサイズ(EMU)を抽出する。 */
export function parsePresentation(xml) {
  if (!xml) return { ...DEFAULT_SLIDE_SIZE_EMU };
  const doc = xmlParser.parse(xml);
  const sldSz = doc?.["p:presentation"]?.["p:sldSz"];
  const width = Number(sldSz?.["@_cx"]);
  const height = Number(sldSz?.["@_cy"]);
  return {
    slideWidthEmu: Number.isFinite(width) && width > 0 ? width : DEFAULT_SLIDE_SIZE_EMU.slideWidthEmu,
    slideHeightEmu: Number.isFinite(height) && height > 0 ? height : DEFAULT_SLIDE_SIZE_EMU.slideHeightEmu,
  };
}

function firstNode(node) {
  return Array.isArray(node) ? node[0] : node;
}

function hundredthsToPt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

function normalizeHex(hexValue) {
  if (!hexValue) return null;
  const hexText = String(hexValue).replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(hexText) ? hexText : null;
}

function parseClrMap(master) {
  const attrs = master?.["p:clrMap"];
  if (!attrs || typeof attrs !== "object") return { ...DEFAULT_CLR_MAP };
  const normalized = {};
  for (const [key, value] of Object.entries(attrs)) {
    normalized[key.replace(/^@_/, "")] = value;
  }
  return { ...DEFAULT_CLR_MAP, ...normalized };
}

/** schemeClr token を clrMap 経由で clrScheme の 6桁 HEX に解決する。 */
export function resolveSchemeColor(token, clrMap = DEFAULT_CLR_MAP, clrScheme = {}) {
  const mapped = clrMap?.[token] || token;
  return normalizeHex(clrScheme?.[mapped]) || normalizeHex(clrScheme?.[token]) || null;
}

function resolveSolidFillColor(solidFill, clrMap, clrScheme) {
  if (!solidFill) return null;
  const direct = resolveColor(solidFill);
  if (direct) return normalizeHex(direct);
  const schemeToken = solidFill["a:schemeClr"]?.["@_val"];
  return schemeToken ? resolveSchemeColor(schemeToken, clrMap, clrScheme) : null;
}

function parseTextStyle(style) {
  const lvl1 = firstNode(style?.["a:lvl1pPr"]);
  return {
    pt: hundredthsToPt(lvl1?.["a:defRPr"]?.["@_sz"]),
    align: lvl1?.["@_algn"] || null,
  };
}

function normalizeAlign(value) {
  if (value === "ctr") return "center";
  if (value === "l") return "left";
  if (value === "r") return "right";
  return value || null;
}

/** slideMaster XML からタイトル/本文サイズ、タイトル揃え、背景色を抽出する。 */
export function parseSlideMaster(xml, clrScheme = {}) {
  if (!xml) return { titlePt: null, bodyPt: null, titleAlign: null, bgColorHex: null };
  const doc = xmlParser.parse(xml);
  const master = doc?.["p:sldMaster"] || {};
  const clrMap = parseClrMap(master);
  const bg = master?.["p:cSld"]?.["p:bg"];
  const bgPr = bg?.["p:bgPr"];
  const bgRef = bg?.["p:bgRef"];
  const bgColorHex =
    resolveSolidFillColor(bgPr?.["a:solidFill"], clrMap, clrScheme) ||
    (bgRef?.["a:schemeClr"]?.["@_val"]
      ? resolveSchemeColor(bgRef["a:schemeClr"]["@_val"], clrMap, clrScheme)
      : null);

  const txStyles = master?.["p:txStyles"] || {};
  const title = parseTextStyle(txStyles["p:titleStyle"]);
  const body = parseTextStyle(txStyles["p:bodyStyle"]);

  return {
    titlePt: title.pt,
    bodyPt: body.pt,
    titleAlign: normalizeAlign(title.align),
    bgColorHex,
  };
}

function hex(colors, key, fallback) {
  return colors[key] ? `#${colors[key]}` : fallback;
}

/** major/minor を CSS フォントスタックへ。日本語フォールバックを必ず付与。 */
function fontStack(fonts, kind) {
  const latin = fonts[kind];
  const ja = fonts[`${kind}_ja`];
  const parts = [];
  if (latin) parts.push(`"${latin}"`);
  if (ja) parts.push(`"${ja}"`);
  parts.push(
    '"Hiragino Kaku Gothic ProN"', '"Yu Gothic UI"', '"Meiryo"', "system-ui", "sans-serif"
  );
  return [...new Set(parts)].join(", ");
}

/** kebab-case 化。 */
export function slugify(text) {
  const raw = String(text ?? "").trim().toLowerCase();
  if (!raw) return "extracted";
  const s = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (s) return s;
  const hash = [...raw].reduce((acc, ch) => (acc * 31 + ch.codePointAt(0)) >>> 0, 0).toString(36);
  return `extracted-${hash}`;
}

/** 抽出結果から corporate.css 互換の Marp テーマ CSS を生成する。 */
export function renderThemeCss(themeName, parsed) {
  const { colors = {}, fonts = {}, sizes = {}, background } = parsed;
  const primary = hex(colors, "accent1", "#1f6feb");
  const secondary = hex(colors, "dk2", hex(colors, "accent2", "#0b3d91"));
  const accent = hex(colors, "accent3", hex(colors, "accent2", "#f0a202"));
  const backgroundHex = normalizeHex(background);
  const backgroundColor = backgroundHex ? `#${backgroundHex}` : hex(colors, "lt1", "#ffffff");
  const foreground = hex(colors, "dk1", "#22272e");
  const link = hex(colors, "hlink", primary);
  const fontBase = fontStack(fonts, "minor");
  const fontHeading = fontStack(fonts, "major");
  const srcName = parsed.name || "extracted";
  const pxPerPt = sizes.pxPerPt ?? (1280 / (DEFAULT_SLIDE_SIZE_EMU.slideWidthEmu / 12700));
  const bodyPt = sizes.bodyPt ?? 24;
  const titlePt = sizes.titlePt ?? 40;
  const bodyPx = Math.round(bodyPt * pxPerPt);
  const titlePx = Math.round(titlePt * pxPerPt);
  const titleRatio = titlePx / bodyPx;
  const extractedDetails = [
    sizes.titlePt != null ? `タイトル: ${sizes.titlePt}pt` : null,
    sizes.bodyPt != null ? `本文: ${sizes.bodyPt}pt` : null,
    backgroundHex ? `背景: #${backgroundHex}` : null,
  ].filter(Boolean).join(" / ");

  return `/* @theme ${themeName} */

/*
 * このテーマは extract-theme により PPTX から自動生成されました。
 * 元テーマ名: ${srcName}
${extractedDetails ? ` * 抽出情報: ${extractedDetails}\n` : ""} * 色やフォントは下記 :root の変数を編集して微調整できます。
 */

@import "default";

:root {
  --brand-primary: ${primary};
  --brand-secondary: ${secondary};
  --brand-accent: ${accent};

  --color-background: ${backgroundColor};
  --color-foreground: ${foreground};
  --color-heading: var(--brand-secondary);
  --color-link: ${link};

  --font-base: ${fontBase};
  --font-heading: ${fontHeading};
  --font-code: "Cascadia Code", "Consolas", "SFMono-Regular", monospace;

  font-family: var(--font-base);
  color: var(--color-foreground);
  background-color: var(--color-background);
}

section {
  font-family: var(--font-base);
  color: var(--color-foreground);
  background-color: var(--color-background);
  padding: 60px 70px;
  font-size: ${bodyPx}px;
  line-height: 1.5;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--color-heading);
}

h1 {
  font-size: ${titleRatio.toFixed(2)}em;
  border-bottom: 4px solid var(--brand-primary);
  padding-bottom: 0.2em;
}

h2 { font-size: 1.4em; }

a { color: var(--color-link); }
strong { color: var(--brand-secondary); }
ul > li::marker { color: var(--brand-primary); }

code { font-family: var(--font-code); }
pre { border-radius: 8px; }

table th {
  background-color: var(--brand-primary);
  color: #ffffff;
}

blockquote {
  border-left: 6px solid var(--brand-accent);
  color: #4a5160;
}

section::after {
  color: #8b95a1;
  font-size: 0.6em;
}

section.title {
  justify-content: center;
  text-align: center;
  background: linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 100%);
  color: #ffffff;
}
section.title h1 {
  color: #ffffff;
  border-bottom: none;
  font-size: ${(titleRatio * 1.4).toFixed(2)}em;
}
section.title h2, section.title h3 { color: rgba(255, 255, 255, 0.85); }

section.section {
  justify-content: center;
  background-color: var(--brand-secondary);
  color: #ffffff;
}
section.section h1, section.section h2 {
  color: #ffffff;
  border-bottom: none;
}
`;
}

/**
 * PPTX バイト列からテーマ CSS を生成する高レベル API。
 * @param {Uint8Array|ArrayBuffer|Buffer} pptxBytes
 * @param {object} [opts]
 * @param {string} [opts.name] テーマ名(@theme 名)。省略時は元テーマ名を slug 化。
 * @returns {{ css:string, themeName:string, parsed:object }}
 */
export function extractThemeFromPptx(pptxBytes, { name } = {}) {
  const parts = readPptxXmlParts(pptxBytes);
  const parsed = parseThemeXml(parts.themeXml);
  const presentation = parsePresentation(parts.presentationXml);
  const master = parseSlideMaster(parts.slideMasterXml, parsed.colors);
  const slideWidthPt = presentation.slideWidthEmu / 12700;
  const pxPerPt = 1280 / slideWidthPt;
  parsed.presentation = presentation;
  parsed.sizes = {
    titlePt: master.titlePt,
    bodyPt: master.bodyPt,
    pxPerPt,
  };
  parsed.titleAlign = master.titleAlign;
  parsed.background = master.bgColorHex;
  const themeName = slugify(name || parsed.name);
  const css = renderThemeCss(themeName, parsed);
  return { css, themeName, parsed };
}
