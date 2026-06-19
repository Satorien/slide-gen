/**
 * extract-theme のテスト。
 * fflate でテーマ XML を含む最小 PPTX(zip)をその場で生成し、
 * 抽出ロジックが配色・フォントを正しく取り出すことを検証する。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  parseThemeXml,
  parsePresentation,
  parseSlideMaster,
  extractThemeFromPptx,
  renderThemeCss,
  slugify,
} from "../src/extract-theme.mjs";

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Test Theme">
  <a:themeElements>
    <a:clrScheme name="Test">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
    </a:clrScheme>
    <a:fontScheme name="Test">
      <a:majorFont>
        <a:latin typeface="Calibri Light"/>
        <a:font script="Jpan" typeface="Yu Gothic"/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:font script="Jpan" typeface="Meiryo"/>
      </a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`;

const SLIDE_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgRef idx="1001">
        <a:schemeClr val="bg1"/>
      </p:bgRef>
    </p:bg>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"
    accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4"
    accent5="accent5" accent6="accent6" hlink="hlink" folHlink="hlink"/>
  <p:txStyles>
    <p:titleStyle>
      <a:lvl1pPr algn="ctr">
        <a:defRPr sz="3600"/>
      </a:lvl1pPr>
    </p:titleStyle>
    <p:bodyStyle>
      <a:lvl1pPr>
        <a:defRPr sz="2400"/>
      </a:lvl1pPr>
    </p:bodyStyle>
  </p:txStyles>
</p:sldMaster>`;

function makeFakePptx({ includePresentation = true, includeMaster = true } = {}) {
  const files = {
    "[Content_Types].xml": strToU8("<Types/>"),
    "ppt/theme/theme1.xml": strToU8(THEME_XML),
  };
  if (includePresentation) files["ppt/presentation.xml"] = strToU8(PRESENTATION_XML);
  if (includeMaster) files["ppt/slideMasters/slideMaster1.xml"] = strToU8(SLIDE_MASTER_XML);
  return zipSync(files);
}

test("parseThemeXml extracts colors with srgb and sysClr fallback", () => {
  const parsed = parseThemeXml(THEME_XML);
  assert.equal(parsed.name, "Test Theme");
  assert.equal(parsed.colors.dk1, "000000"); // sysClr lastClr
  assert.equal(parsed.colors.lt1, "FFFFFF");
  assert.equal(parsed.colors.dk2, "1F497D");
  assert.equal(parsed.colors.accent1, "4F81BD");
  assert.equal(parsed.colors.hlink, "0000FF");
});

test("parseThemeXml extracts latin and Japanese fonts", () => {
  const { fonts } = parseThemeXml(THEME_XML);
  assert.equal(fonts.major, "Calibri Light");
  assert.equal(fonts.minor, "Calibri");
  assert.equal(fonts.major_ja, "Yu Gothic");
  assert.equal(fonts.minor_ja, "Meiryo");
});

test("parsePresentation extracts slide size and falls back when missing", () => {
  const parsed = parsePresentation(PRESENTATION_XML);
  assert.equal(parsed.slideWidthEmu, 12192000);
  assert.equal(parsed.slideHeightEmu, 6858000);
  assert.deepEqual(parsePresentation(null), { slideWidthEmu: 12192000, slideHeightEmu: 6858000 });
});

test("parseSlideMaster extracts text sizes and resolves background scheme color", () => {
  const parsed = parseSlideMaster(SLIDE_MASTER_XML, { lt1: "F7F8FA", dk1: "111111" });
  assert.equal(parsed.titlePt, 36);
  assert.equal(parsed.bodyPt, 24);
  assert.equal(parsed.titleAlign, "center");
  assert.equal(parsed.bgColorHex, "F7F8FA");
});

test("extractThemeFromPptx produces valid Marp theme CSS", () => {
  const bytes = makeFakePptx();
  const { css, themeName, parsed } = extractThemeFromPptx(bytes, { name: "My Brand" });
  assert.equal(themeName, "my-brand");
  assert.match(css, /\/\* @theme my-brand \*\//);
  assert.match(css, /@import "default";/);
  assert.match(css, /--brand-primary: #4F81BD;/); // accent1
  assert.match(css, /--brand-secondary: #1F497D;/); // dk2
  assert.match(css, /--color-link: #0000FF;/); // hlink
  assert.match(css, /"Calibri"/); // minor font in --font-base
  assert.match(css, /"Yu Gothic"/); // major_ja
  assert.match(css, /--color-background: #FFFFFF;/);
  assert.match(css, /section\s*\{[\s\S]*font-size: 32px;/);
  assert.match(css, /h1\s*\{[\s\S]*font-size: 1\.5\d*em;/);
  assert.equal(parsed.colors.accent1, "4F81BD");
  assert.equal(parsed.sizes.titlePt, 36);
  assert.equal(parsed.sizes.bodyPt, 24);
  assert.equal(parsed.background, "FFFFFF");
});

test("extractThemeFromPptx falls back when presentation and master XML are absent", () => {
  const bytes = makeFakePptx({ includePresentation: false, includeMaster: false });
  const { css, parsed } = extractThemeFromPptx(bytes, { name: "Theme Only" });
  assert.match(css, /\/\* @theme theme-only \*\//);
  assert.match(css, /section\s*\{[\s\S]*font-size: \d+px;/);
  assert.equal(parsed.sizes.titlePt, null);
  assert.equal(parsed.sizes.bodyPt, null);
  assert.equal(parsed.background, null);
});

test("slugify normalizes names", () => {
  assert.equal(slugify("My Brand!!"), "my-brand");
  assert.equal(slugify("  Spaces  "), "spaces");
  assert.equal(slugify(""), "extracted");
});

test("renderThemeCss falls back to defaults when colors missing", () => {
  const css = renderThemeCss("empty", { name: "x", colors: {}, fonts: {} });
  assert.match(css, /--brand-primary: #1f6feb;/);
  assert.match(css, /system-ui, sans-serif/);
});
