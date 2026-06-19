# slide-generator

Generate presentation slides from Markdown using [Marp](https://marp.app/) — available as both a **cross-platform CLI** and a **desktop app** (Windows / macOS / Linux).

## Features

- ✍️ Write slides in plain Markdown — no design tools needed
- 🖥️ **Desktop app** with a Markdown editor and live preview
- ⌨️ **CLI** for scripting and batch conversion
- 🎨 Apply custom themes, or extract one automatically from an existing PPTX file
- 📤 Export to **HTML, PDF, PPTX, or PNG**
- 🔋 Desktop export needs **no external browser** — it uses Electron's built-in Chromium

## Repository layout (npm workspaces monorepo)

```
slide-generator/
├── packages/
│   ├── core/        @slidegen/core — shared rendering (marp-core) +
│   │               PPTX → theme extraction (fflate + fast-xml-parser)
│   └── cli/         @slidegen/cli  — the `slidegen` command
├── apps/
│   └── desktop/     @slidegen/desktop — Electron app (editor + preview + export)
├── slides/          sample Markdown
├── data/pptx/       PPTX templates for theme extraction
└── output/          CLI output (git-ignored)
```

## Prerequisites

| Tool | Purpose |
| ---- | ------- |
| [Node.js](https://nodejs.org/) 22 (via [fnm](https://github.com/Schniz/fnm)) | Runs everything |
| Chrome / Chromium / Edge | **CLI only** — needed for PDF / PPTX / PNG export. The desktop app does **not** need this. |

> Python is no longer required — theme extraction was ported to JavaScript.

## Setup

```bash
# install Node from .node-version (with fnm) and all workspace deps
fnm use --install-if-missing   # or: nvm use
npm install
```

## CLI usage (`slidegen`)

```bash
# from the repo root
npm run build                              # convert ./slides → ./output (HTML)
node packages/cli/src/convert.mjs -f pdf   # PDF
node packages/cli/src/convert.mjs --server # live preview at http://localhost:8080

# or use the linked bin
npx slidegen slides/example.md -f pptx
npx slidegen extract-theme data/pptx/brand.pptx --name mybrand
npx slidegen --theme mybrand -f pdf
npx slidegen list-themes
```

| Task | Command |
| ---- | ------- |
| HTML | `npx slidegen` |
| PDF / PPTX / PNG | `npx slidegen -f pdf` (or `pptx` / `png`) |
| Live preview | `npx slidegen --server` |
| Watch & rebuild | `npx slidegen --watch -f pdf` |
| Extract theme from PPTX | `npx slidegen extract-theme x.pptx -n mybrand` |
| List themes | `npx slidegen list-themes` |
| Help | `npx slidegen --help` |

> CLI PDF/PPTX/PNG export needs Chrome/Chromium/Edge. Set `CHROME_PATH` if it is not on `PATH`.

## Desktop app

```bash
npm run desktop:dev          # run the app in development
npm run desktop:build        # build the app bundle (electron-vite)

# build installers for the current OS (output in apps/desktop/dist/)
npm run package --workspace @slidegen/desktop -- --win    # or --mac / --linux
```

The desktop app provides a two-pane Markdown editor with live preview, a theme picker, one-click **PPTX theme import**, and export to PDF / PPTX / PNG / HTML — all without an external browser.

## Releases

Pushing a `v*` tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds installers on Windows, macOS, and Linux runners and publishes them to GitHub Releases:

- **Windows** — NSIS installer + portable `.exe`
- **macOS** — universal `.dmg` (arm64 + x64)
- **Linux** — AppImage + `.deb`

```bash
npm version 1.0.0 --workspace @slidegen/desktop   # bump
git tag v1.0.0 && git push --tags                 # trigger the release build
```

> **v1 ships unsigned.** On first launch: macOS → right-click the app → *Open*; Windows → *More info* → *Run anyway* (or use the portable exe). Code signing / notarization can be added later without changing the build config. macOS auto-update requires signing.

## Development

```bash
npm test    # run @slidegen/core unit tests (theme extraction)
```

## License

MIT
