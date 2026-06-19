# AGENTS.md — slide-generator

Guidance for AI agents (Codex, Claude Code) and humans working in this repo.
Markdown → Marp slide generator, shipped as a **cross-platform CLI + Electron desktop app**.

## Repo layout (npm workspaces monorepo)

```
packages/core/      @slidegen/core   — shared logic, NO Electron, NO puppeteer (pure JS)
  src/render.mjs        renderDeck() via @marp-team/marp-core; buildHtmlDocument()
  src/extract-theme.mjs PPTX → Marp theme CSS (fflate unzip + fast-xml-parser)
  src/themes.mjs        builtin theme discovery (THEMES_DIR, loadBuiltinThemes)
  themes/corporate.css  bundled custom theme
  test/                 node:test unit tests
packages/cli/       @slidegen/cli    — `slidegen` command; uses core; keeps marp-cli for export
apps/desktop/       @slidegen/desktop — Electron app (electron-vite): editor + live preview + native export
  src/main/  src/preload/  src/renderer/
  build/      app icons (committed)        electron-builder.yml   build config
.github/workflows/release.yml  3-OS matrix → GitHub Releases on v* tags
slides/  data/pptx/  output/
```

## Toolchain & commands

- **Node 22** pinned via [fnm](https://github.com/Schniz/fnm) + `.node-version`. Activate before any node/npm work:
  `fnm use --install-if-missing` (or `fnm env --use-on-cd | Out-String | Invoke-Expression` in PowerShell).
- **Python was removed** — theme extraction is JS now. Do not reintroduce a Python dependency.

```bash
npm install                                       # workspace install
npm test                                          # core unit tests
npx slidegen -f pdf                               # CLI convert (html|pdf|pptx|png)
npx slidegen extract-theme x.pptx -n mybrand      # PPTX → theme
npm run desktop:dev                               # run desktop app
npm run build --workspace @slidegen/desktop       # electron-vite build
npm run package --workspace @slidegen/desktop -- --win   # installers (/--mac /--linux)
```

Release: push a `v*` tag → CI builds Win (NSIS+portable) / macOS (universal dmg) / Linux (AppImage+deb).

## Architecture decisions

- **`core` is the single rendering source of truth.** Desktop preview AND desktop export both call `renderDeck()`, so "preview == export" by construction. Keep `core` free of Electron/puppeteer/native deps (so it bundles into the Electron main chunk and stays portable).
- **Desktop export is native — no external browser.** PDF = `webContents.printToPDF()`, PNG = offscreen `capturePage()` per slide, PPTX = `pptxgenjs` (each slide as a full-bleed background image, same as marp-cli's default). The CLI, by contrast, still shells out to `@marp-team/marp-cli` and needs Chrome/Edge.
- **CLI vs desktop split is intentional.** CLI keeps marp-cli (external browser acceptable for a dev tool); desktop is self-contained for end users.

## Gotchas learned (don't rediscover these)

### CLI / marp-cli
- Always pass `--no-stdin` to marp-cli. In non-interactive shells it otherwise waits on stdin forever ("waiting data from stdin stream").
- Single-file input → `--output` must be a **file path**, not a directory (else `EISDIR`). Directory input uses `--input-dir` + `--output <dir>`.
- PDF/PPTX/PNG need Chrome/Chromium/Edge; honor `CHROME_PATH`.

### Electron desktop
- **Offscreen capture:** export windows use `webPreferences.offscreen:true` + `show:false`; a fully hidden non-offscreen window yields blank `capturePage()` results.
- **`window-all-closed` handler is required** even for batch/headless flows: Electron's default quits the app the moment all windows close, so sequential exports (each creating+destroying a temp window) would kill the process mid-run.
- **Hide scrollbars in the export HTML** (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) or they get captured into PNG/PPTX. Keep scrollability for the per-slide `scrollTo`.
- marp-core is **CJS** (`lib/marp.js`); the Electron main is built CJS and bundles `@slidegen/core` while externalizing marp-core/fflate/fast-xml-parser/pptxgenjs (see `electron.vite.config.mjs` — `externalizeDepsPlugin({ exclude: ['@slidegen/core'] })`).
- Builtin theme CSS is imported into main via Vite **`?raw`** (`@slidegen/core/themes/corporate.css?raw`) — `core`'s filesystem `THEMES_DIR` path breaks once bundled, so don't rely on it in the desktop main.

### electron-builder (monorepo)
- Electron must be **pinned to an exact version** in `apps/desktop` devDependencies (e.g. `"electron": "42.4.1"`), and `electronVersion` set in `electron-builder.yml` — a `^range` fails in a workspace.
- Bundled-at-build deps (`@slidegen/core`) go in **devDependencies**; only true runtime (externalized) deps stay in `dependencies` so they get packaged.
- Icons (`sharp` + `png2icons`) are build-time devDeps; the generated `build/icon.{png,ico,icns}` are committed.

### Delegating coding to Codex
The user delegates coding tasks to the local Codex CLI. Invoke it headlessly as
`$null | & <codex.exe> exec -C "<repo>" --dangerously-bypass-approvals-and-sandbox "<prompt>"`
(pipe `$null` so it doesn't hang on stdin; bypass the inner sandbox or child processes fail with `CreateProcessAsUserW failed: 5`). Tell Codex **not** to touch git — the orchestrator commits/pushes and independently verifies the result.

## Conventions
- One logical change per commit; imperative subject; explain *why* in the body. When work was produced by Codex, say so in the message.
- Don't commit `output/`, `apps/*/out`, `apps/*/dist`, `apps/*/smoke-out`, locally generated `/themes/` (see `.gitignore`).
- Verify before claiming done: run tests / the build / the actual app; for binary outputs, open and inspect them.
