#!/usr/bin/env node
/**
 * convert.mjs
 * Wrapper around Marp CLI that converts Markdown slides.
 *
 * - Auto-registers custom themes from themes/
 * - Accepts file or directory as input
 * - Supports html / pdf / pptx / png output
 * - Supports watch and server (preview) modes
 *
 * See docs/usage.md or run `node src/convert.mjs --help` for details.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, basename, extname } from "node:path";
import { existsSync, statSync, readdirSync, readFileSync, mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULTS = {
  input: join(ROOT, "slides"),
  output: join(ROOT, "output"),
  themesDir: join(ROOT, "src", "themes"),
  format: "html",
};

const FORMATS = new Set(["html", "pdf", "pptx", "png"]);

// ---------------------------------------------------------------------------
// 引数パース
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    input: DEFAULTS.input,
    output: DEFAULTS.output,
    themesDir: DEFAULTS.themesDir,
    format: DEFAULTS.format,
    theme: null,
    watch: false,
    server: false,
    pptxEditable: false,
    listThemes: false,
    help: false,
    passthrough: [], // extra args passed directly to Marp CLI
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-i":
      case "--input":
        opts.input = argv[++i];
        break;
      case "-o":
      case "--output":
        opts.output = argv[++i];
        break;
      case "-f":
      case "--format":
        opts.format = String(argv[++i] || "").toLowerCase();
        break;
      case "--theme":
        opts.theme = argv[++i];
        break;
      case "-w":
      case "--watch":
        opts.watch = true;
        break;
      case "-s":
      case "--server":
        opts.server = true;
        break;
      case "--pptx-editable":
        opts.pptxEditable = true;
        break;
      case "--list-themes":
        opts.listThemes = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "--":
        opts.passthrough.push(...argv.slice(i + 1));
        i = argv.length;
        break;
      default:
        // positional arg as input (alternative to -i)
        if (!a.startsWith("-") && opts._positionalUsed !== true) {
          opts.input = a;
          opts._positionalUsed = true;
        } else {
          opts.passthrough.push(a);
        }
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// テーマ一覧
// ---------------------------------------------------------------------------
function listThemes(themesDir) {
  if (!existsSync(themesDir)) return [];
  const files = readdirSync(themesDir).filter((f) => f.endsWith(".css"));
  const themes = [];
  for (const f of files) {
    const css = readFileSync(join(themesDir, f), "utf8");
    const m = css.match(/\/\*\s*@theme\s+([\w-]+)\s*\*\//);
    themes.push({ name: m ? m[1] : f.replace(/\.css$/, ""), file: f });
  }
  return themes;
}

// ---------------------------------------------------------------------------
// Marp CLI の bin を解決
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Marp 引数を組み立て
// ---------------------------------------------------------------------------
function buildMarpArgs(opts) {
  // Prevent Marp from hanging waiting for stdin in non-interactive (pipe) environments.
  const args = ["--no-stdin"];
  const inputPath = resolve(opts.input);
  if (!existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }
  const isDir = statSync(inputPath).isDirectory();

  // register custom themes
  if (existsSync(opts.themesDir)) {
    args.push("--theme-set", opts.themesDir);
  }
  if (opts.theme) {
    args.push("--theme", opts.theme);
  }

  // output format
  switch (opts.format) {
    case "html":
      break;
    case "pdf":
      args.push("--pdf", "--allow-local-files");
      break;
    case "pptx":
      args.push("--pptx", "--allow-local-files");
      if (opts.pptxEditable) args.push("--pptx-editable");
      break;
    case "png":
      args.push("--images", "png");
      break;
    default:
      throw new Error(
        `Unsupported format: ${opts.format} (must be one of html|pdf|pptx|png)`
      );
  }

  // server (preview) mode
  if (opts.server) {
    const dir = isDir ? inputPath : dirname(inputPath);
    args.push("--server", dir);
    args.push(...opts.passthrough);
    return args;
  }

  if (opts.watch) args.push("--watch");

  // output destination
  const outDir = resolve(opts.output);
  mkdirSync(outDir, { recursive: true });
  if (isDir) {
    args.push("--input-dir", inputPath, "--output", outDir);
  } else {
    // single file: --output must be a file path, not a directory (passing a dir causes EISDIR)
    const ext = opts.format === "html" ? "html" : opts.format;
    const base = basename(inputPath, extname(inputPath));
    const outFile = join(outDir, `${base}.${ext}`);
    args.push(inputPath, "--output", outFile);
  }

  args.push(...opts.passthrough);
  return args;
}

// ---------------------------------------------------------------------------
// ヘルプ
// ---------------------------------------------------------------------------
function printHelp() {
  const rel = (p) => relative(process.cwd(), p) || ".";
  console.log(`
slidegen - Generate slides from Markdown using Marp

Usage:
  node src/convert.mjs [input] [options]

Options:
  -i, --input <path>    Input file or directory  (default: ${rel(DEFAULTS.input)})
  -o, --output <path>   Output directory         (default: ${rel(DEFAULTS.output)})
  -f, --format <fmt>    html | pdf | pptx | png  (default: ${DEFAULTS.format})
      --theme <name>    Theme name to apply
      --pptx-editable   Output editable PPTX (requires LibreOffice Impress)
  -w, --watch           Watch for changes and rebuild automatically
  -s, --server          Start preview server (http://localhost:8080)
      --list-themes     List available themes
  -h, --help            Show this help
      --                Pass remaining args directly to Marp CLI

Examples:
  node src/convert.mjs                       # convert slides/ to HTML
  node src/convert.mjs -f pdf                # generate PDF
  node src/convert.mjs slides/example.md -f pptx
  node src/convert.mjs --server             # live preview in browser
  node src/convert.mjs --theme corporate -f pdf

Note:
  pdf / pptx / png output requires Chrome, Chromium, or Edge.
  Set the CHROME_PATH environment variable to specify the browser path.
`);
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------
function run() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.listThemes) {
    const themes = listThemes(opts.themesDir);
    if (themes.length === 0) {
      console.log("No custom themes found (src/themes/*.css)");
    } else {
      console.log("Available custom themes:");
      for (const t of themes) console.log(`  - ${t.name}  (${t.file})`);
    }
    console.log("Built-in Marp themes: default, gaia, uncover");
    return;
  }

  if (!FORMATS.has(opts.format)) {
    console.error(`Error: Unsupported format "${opts.format}"`);
    process.exit(1);
  }

  let marpArgs;
  try {
    marpArgs = buildMarpArgs(opts);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  const marpBin = resolveMarpBin();
  console.log(`> marp ${marpArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}\n`);

  const child = spawn(process.execPath, [marpBin, ...marpArgs], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code !== 0 && opts.pptxEditable) {
      console.error("\nHint: --pptx-editable requires LibreOffice.");
      console.error("Install it from: https://www.libreoffice.org/");
    }
    process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error(`Failed to run Marp: ${err.message}`);
    process.exit(1);
  });
}

run();
