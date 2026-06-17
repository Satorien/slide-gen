#!/usr/bin/env node
/**
 * slidegen — Markdown を Marp でスライドに変換する CLI。
 *
 * サブコマンド:
 *   slidegen [入力] [オプション]        Markdown → HTML/PDF/PPTX/PNG 変換
 *   slidegen extract-theme <pptx> ...   PPTX から Marp テーマ(CSS)を抽出
 *   slidegen list-themes                利用可能なテーマを一覧
 *
 * - テーマは @slidegen/core 同梱分(THEMES_DIR)に加え、カレントの ./themes も使う
 * - 出力(PDF/PPTX/PNG)には Chrome/Chromium/Edge が必要(環境変数 CHROME_PATH 可)
 * - クロスプラットフォーム(Windows/macOS/Linux)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve, relative, basename, extname } from "node:path";
import {
  existsSync, statSync, readdirSync, readFileSync, mkdirSync, writeFileSync,
} from "node:fs";
import {
  THEMES_DIR as CORE_THEMES_DIR,
  loadBuiltinThemes,
  BUILTIN_MARP_THEMES,
  extractThemeFromPptx,
} from "@slidegen/core";

const require = createRequire(import.meta.url);

const FORMATS = new Set(["html", "pdf", "pptx", "png"]);
const DEFAULTS = {
  input: resolve(process.cwd(), "slides"),
  output: resolve(process.cwd(), "output"),
  format: "html",
};

// カレントプロジェクトのローカルテーマ置き場(あれば使う / 抽出の既定出力先)
const LOCAL_THEMES_DIR = resolve(process.cwd(), "themes");

/** marp-cli へ渡すテーマディレクトリ(core 同梱 + ローカル)。 */
function themeDirs() {
  const dirs = [CORE_THEMES_DIR];
  if (existsSync(LOCAL_THEMES_DIR)) dirs.push(LOCAL_THEMES_DIR);
  return dirs;
}

// ---------------------------------------------------------------------------
// 変換サブコマンド
// ---------------------------------------------------------------------------
function parseConvertArgs(argv) {
  const opts = {
    input: DEFAULTS.input,
    output: DEFAULTS.output,
    format: DEFAULTS.format,
    theme: null,
    watch: false,
    server: false,
    pptxEditable: false,
    passthrough: [],
    _positionalUsed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-i": case "--input": opts.input = argv[++i]; break;
      case "-o": case "--output": opts.output = argv[++i]; break;
      case "-f": case "--format": opts.format = String(argv[++i] || "").toLowerCase(); break;
      case "--theme": opts.theme = argv[++i]; break;
      case "-w": case "--watch": opts.watch = true; break;
      case "-s": case "--server": opts.server = true; break;
      case "--pptx-editable": opts.pptxEditable = true; break;
      case "--": opts.passthrough.push(...argv.slice(i + 1)); i = argv.length; break;
      default:
        if (!a.startsWith("-") && !opts._positionalUsed) {
          opts.input = a;
          opts._positionalUsed = true;
        } else {
          opts.passthrough.push(a);
        }
    }
  }
  return opts;
}

function resolveMarpBin() {
  const pkgPath = require.resolve("@marp-team/marp-cli/package.json");
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  let binRel;
  if (typeof pkg.bin === "string") binRel = pkg.bin;
  else if (pkg.bin && pkg.bin.marp) binRel = pkg.bin.marp;
  else binRel = "marp-cli.js";
  return join(pkgDir, binRel);
}

function buildMarpArgs(opts) {
  // 非対話(パイプ)環境で stdin 待ちハングを防ぐ。常にファイル/ディレクトリ入力。
  const args = ["--no-stdin"];
  const inputPath = resolve(opts.input);
  if (!existsSync(inputPath)) throw new Error(`入力が見つかりません: ${inputPath}`);
  const isDir = statSync(inputPath).isDirectory();

  // テーマ登録(core 同梱 + ローカル)
  for (const d of themeDirs()) args.push("--theme-set", d);
  if (opts.theme) args.push("--theme", opts.theme);

  switch (opts.format) {
    case "html": break;
    case "pdf": args.push("--pdf", "--allow-local-files"); break;
    case "pptx":
      args.push("--pptx", "--allow-local-files");
      if (opts.pptxEditable) args.push("--pptx-editable");
      break;
    case "png": args.push("--images", "png"); break;
    default: throw new Error(`未対応のフォーマット: ${opts.format} (html|pdf|pptx|png)`);
  }

  if (opts.server) {
    const dir = isDir ? inputPath : dirname(inputPath);
    args.push("--server", dir, ...opts.passthrough);
    return args;
  }

  if (opts.watch) args.push("--watch");

  const outDir = resolve(opts.output);
  mkdirSync(outDir, { recursive: true });
  if (isDir) {
    args.push("--input-dir", inputPath, "--output", outDir);
  } else {
    const ext = opts.format === "html" ? "html" : opts.format;
    const base = basename(inputPath, extname(inputPath));
    args.push(inputPath, "--output", join(outDir, `${base}.${ext}`));
  }
  args.push(...opts.passthrough);
  return args;
}

function runConvert(argv) {
  const opts = parseConvertArgs(argv);
  if (!FORMATS.has(opts.format)) {
    console.error(`エラー: 未対応のフォーマット "${opts.format}"`);
    process.exit(1);
  }
  let marpArgs;
  try {
    marpArgs = buildMarpArgs(opts);
  } catch (e) {
    console.error(`エラー: ${e.message}`);
    process.exit(1);
  }
  const marpBin = resolveMarpBin();
  console.log(`> marp ${marpArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}\n`);
  const child = spawn(process.execPath, [marpBin, ...marpArgs], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error(`Marp の実行に失敗しました: ${err.message}`);
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// テーマ抽出サブコマンド(旧 extract_theme.py の置き換え)
// ---------------------------------------------------------------------------
function runExtractTheme(argv) {
  let pptx = null;
  let name = null;
  let output = null;
  let printOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-n": case "--name": name = argv[++i]; break;
      case "-o": case "--output": output = argv[++i]; break;
      case "--print": printOnly = true; break;
      default: if (!a.startsWith("-") && !pptx) pptx = a;
    }
  }
  if (!pptx) {
    console.error("使い方: slidegen extract-theme <pptx> [--name <name>] [-o <out.css>] [--print]");
    process.exit(1);
  }
  const pptxPath = resolve(pptx);
  if (!existsSync(pptxPath)) {
    console.error(`エラー: ファイルが見つかりません: ${pptxPath}`);
    process.exit(1);
  }

  let result;
  try {
    const bytes = readFileSync(pptxPath);
    result = extractThemeFromPptx(bytes, { name });
  } catch (e) {
    console.error(`エラー: PPTX の解析に失敗しました: ${e.message}`);
    process.exit(1);
  }
  const { css, themeName, parsed } = result;

  if (printOnly) {
    process.stdout.write(css);
    return;
  }

  const outPath = output ? resolve(output) : join(LOCAL_THEMES_DIR, `${themeName}.css`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, css, "utf8");

  console.log(`[OK] テーマを生成しました: ${outPath}`);
  console.log(`  @theme 名      : ${themeName}`);
  console.log(`  元テーマ       : ${parsed.name}`);
  const cols = Object.entries(parsed.colors).map(([k, v]) => `${k}=#${v}`).join(", ");
  if (cols) console.log(`  抽出した色     : ${cols}`);
  const fns = Object.entries(parsed.fonts).map(([k, v]) => `${k}=${v}`).join(", ");
  if (fns) console.log(`  抽出したフォント: ${fns}`);
  console.log(`\n利用例: slidegen --theme ${themeName} -f pdf`);
}

// ---------------------------------------------------------------------------
// テーマ一覧
// ---------------------------------------------------------------------------
function runListThemes() {
  const seen = new Set();
  const all = [];
  for (const dir of themeDirs()) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".css"))) {
      const css = readFileSync(join(dir, f), "utf8");
      const m = css.match(/\/\*\s*@theme\s+([\w-]+)\s*\*\//);
      const nm = m ? m[1] : f.replace(/\.css$/, "");
      if (!seen.has(nm)) {
        seen.add(nm);
        all.push({ name: nm, dir });
      }
    }
  }
  if (all.length === 0) console.log("独自テーマはありません。");
  else {
    console.log("利用可能な独自テーマ:");
    for (const t of all) console.log(`  - ${t.name}  (${relative(process.cwd(), t.dir) || "."})`);
  }
  console.log(`Marp 組み込みテーマ: ${BUILTIN_MARP_THEMES.join(", ")}`);
}

// ---------------------------------------------------------------------------
// ヘルプ
// ---------------------------------------------------------------------------
function printHelp() {
  console.log(`
slidegen — Markdown から Marp でスライドを生成

使い方:
  slidegen [入力] [オプション]            Markdown を変換 (既定: ./slides → ./output)
  slidegen extract-theme <pptx> [opts]    PPTX から Marp テーマ(CSS)を抽出
  slidegen list-themes                    利用可能なテーマを一覧
  slidegen --help

変換オプション:
  -i, --input <path>    入力ファイル or ディレクトリ (既定: ./slides)
  -o, --output <path>   出力ディレクトリ            (既定: ./output)
  -f, --format <fmt>    html | pdf | pptx | png     (既定: html)
      --theme <name>    使用するテーマ名
      --pptx-editable   編集可能な PPTX を出力 (要 LibreOffice)
  -w, --watch           変更を監視して自動再生成
  -s, --server          プレビューサーバー (http://localhost:8080)
      --                以降を marp CLI へそのまま渡す

extract-theme オプション:
  -n, --name <name>     生成するテーマ名 (既定: 元テーマ名)
  -o, --output <path>   出力 CSS パス (既定: ./themes/<name>.css)
      --print           ファイルに書かず標準出力へ

例:
  slidegen                            # ./slides → HTML
  slidegen -f pdf                     # PDF を生成
  slidegen slides/deck.md -f pptx
  slidegen --server                  # ライブプレビュー
  slidegen extract-theme brand.pptx -n mybrand
  slidegen --theme mybrand -f pdf

注意: pdf/pptx/png の出力には Chrome/Chromium/Edge が必要です。
      環境変数 CHROME_PATH でブラウザのパスを指定できます。
`);
}

// ---------------------------------------------------------------------------
// ディスパッチ
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "-h" || cmd === "--help" || cmd === "help") return printHelp();
  if (cmd === "extract-theme") return runExtractTheme(argv.slice(1));
  if (cmd === "list-themes" || cmd === "--list-themes") return runListThemes();
  return runConvert(argv);
}

main();
