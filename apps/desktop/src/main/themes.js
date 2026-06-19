/**
 * テーマ管理(main プロセス側)。
 * - 同梱テーマ(corporate)はビルド時に CSS 文字列としてバンドル(?raw)。
 *   ※core の THEMES_DIR はバンドル後にパスが壊れるため使わない。
 * - ユーザーテーマは userData/themes から実行時に読み込む。
 */
import { app } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { themeNameFromCss } from "@slidegen/core";
import corporateCss from "@slidegen/core/themes/corporate.css?raw";

const BUILTIN = [{ name: "corporate", css: corporateCss, source: "builtin" }];

/** ユーザーが追加したテーマの置き場所(無ければ作成)。 */
export function userThemesDir() {
  const dir = join(app.getPath("userData"), "themes");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 同梱 + ユーザーの全テーマを [{name, css, source}] で返す(名前で重複排除)。 */
export function getThemes() {
  const map = new Map();
  for (const t of BUILTIN) map.set(t.name, t);
  const dir = userThemesDir();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".css"))) {
      const css = readFileSync(join(dir, f), "utf8");
      const name = themeNameFromCss(css, f.replace(/\.css$/, ""));
      map.set(name, { name, css, source: "user" });
    }
  }
  return [...map.values()];
}
