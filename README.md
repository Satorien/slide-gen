# slide-generator

Generate presentation slides from Markdown using [Marp](https://marp.app/).

## Features

- Write slides in plain Markdown — no design tools needed
- Apply custom themes, or extract one automatically from an existing PPTX file
- Export to **HTML, PDF, PPTX, or PNG**
- Live preview server with auto-reload on save
- Watch mode for continuous background rebuilds

## Prerequisites

| Tool | Purpose |
| ---- | ------- |
| [Node.js](https://nodejs.org/) ≥ 18 (via [fnm](https://github.com/Schniz/fnm)) | Runs Marp CLI |
| [uv](https://docs.astral.sh/uv/) | Python env for theme extraction |
| Chrome, Chromium, or Edge | Required for PDF / PPTX / PNG export |

## Setup

Run once after cloning:

```powershell
./scripts/setup.ps1
```

This installs npm dependencies (Marp CLI) and creates a Python virtual environment via uv.

## Usage

### Build slides

```powershell
./scripts/build.ps1                                     # Convert slides/ → HTML (default)
./scripts/build.ps1 -Format pdf                         # Generate PDF
./scripts/build.ps1 -Format pptx                        # Generate PPTX
./scripts/build.ps1 -Format png                         # Generate PNG (one image per slide)

./scripts/build.ps1 -Input slides/foo.md -Format pdf    # Single file
./scripts/build.ps1 -Theme corporate -Format pdf        # Apply a specific theme
```

Output is written to `output/`.

### Live preview

```powershell
./scripts/preview.ps1
```

Starts a server at **http://localhost:8080**. The browser updates automatically whenever you save a Markdown file.

### Watch mode

```powershell
./scripts/watch.ps1               # Auto-rebuild HTML on change
./scripts/watch.ps1 -Format pdf   # Auto-rebuild PDF on change
```

### Extract a theme from a PPTX file

```powershell
./scripts/extract-theme.ps1 data/pptx/your-template.pptx -Name mytheme
```

Reads brand colors and fonts from the PPTX theme XML and generates `src/themes/mytheme.css`. The theme is immediately usable with `-Theme mytheme`.

### List available themes

```powershell
node src/convert.mjs --list-themes
```

Built-in Marp themes: `default`, `gaia`, `uncover`

## Directory structure

```
slide-generator/
├── slides/               # Put your .md slide files here
├── output/               # Generated output (git-ignored)
├── data/pptx/            # PPTX templates for theme extraction (git-ignored)
├── src/
│   ├── themes/           # Custom Marp theme CSS files
│   ├── convert.mjs       # Marp CLI wrapper (main entry point)
│   └── extract_theme.py  # PPTX → CSS theme extractor
└── scripts/              # PowerShell helper scripts
    ├── setup.ps1
    ├── build.ps1
    ├── preview.ps1
    ├── watch.ps1
    └── extract-theme.ps1
```

## Notes

- PDF / PPTX / PNG output requires Chrome, Chromium, or Edge. Set the `CHROME_PATH` environment variable if the browser is not on `PATH`.
- `--pptx-editable` produces an editable PPTX but requires [LibreOffice](https://www.libreoffice.org/).
- The `data/pptx/` and `output/` directories are git-ignored. Add your own PPTX templates to `data/pptx/`.

## License

MIT
