/**
 * themes.mjs
 * core 同梱テーマ(CSS)の探索・読み込みヘルパー。
 * CLI とデスクトップの両方が同じテーマ群を共有する。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** core に同梱したテーマ CSS のディレクトリ(絶対パス)。 */
export const THEMES_DIR = join(__dirname, "..", "themes");

/** CSS 文字列の先頭コメントから `@theme <name>` を取り出す。 */
export function themeNameFromCss(css, fallback = "theme") {
  const m = css.match(/\/\*\s*@theme\s+([\w-]+)\s*\*\//);
  return m ? m[1] : fallback;
}

/**
 * 同梱テーマを {name, css, file} の配列で返す。
 * @param {string} [dir] 探索ディレクトリ(既定: THEMES_DIR)
 */
export function loadBuiltinThemes(dir = THEMES_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => {
      const css = readFileSync(join(dir, f), "utf8");
      return { name: themeNameFromCss(css, f.replace(/\.css$/, "")), css, file: f };
    });
}

/** Marp 組み込みテーマ名。 */
export const BUILTIN_MARP_THEMES = ["default", "gaia", "uncover"];
