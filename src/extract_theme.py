#!/usr/bin/env python3
"""extract_theme.py

Extract color and font information from a PPTX file and generate a Marp theme (CSS).

A PPTX file is a ZIP archive. Its `ppt/theme/themeN.xml` entries define the color
scheme (<a:clrScheme>) and font scheme (<a:fontScheme>). This script extracts brand
colors and fonts from those entries and writes them into a CSS variable structure
compatible with src/themes/corporate.css.

Uses only the standard library (zipfile, xml.etree) — no external dependencies.

Usage:
    uv run python src/extract_theme.py data/pptx/sample.pptx
    uv run python src/extract_theme.py data/pptx/sample.pptx --name mybrand
    uv run python src/extract_theme.py data/pptx/sample.pptx -o src/themes/mybrand.css
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

# Fix encoding to UTF-8 on Windows consoles that default to cp932
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

# DrawingML namespace
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_THEMES_DIR = ROOT / "src" / "themes"

# PPTX color scheme keys and their roles:
# dk1/lt1 = text/background 1, dk2/lt2 = text/background 2, accent1-6 = accents
COLOR_KEYS = [
    "dk1",
    "lt1",
    "dk2",
    "lt2",
    "accent1",
    "accent2",
    "accent3",
    "accent4",
    "accent5",
    "accent6",
    "hlink",
]

# Fallback values for Office system colors
SYS_COLOR_FALLBACK = {
    "windowText": "000000",
    "window": "FFFFFF",
}


def _read_theme_xml(pptx_path: Path) -> bytes:
    """Return the bytes of the first theme XML found inside the PPTX."""
    with zipfile.ZipFile(pptx_path) as z:
        theme_names = sorted(
            n for n in z.namelist() if re.match(r"ppt/theme/theme\d+\.xml$", n)
        )
        if not theme_names:
            raise ValueError("No theme XML found inside the PPTX.")
        return z.read(theme_names[0])


def _resolve_color(node: ET.Element) -> str | None:
    """Extract a 6-digit hex color from a color scheme node (<a:dk1>, etc.)."""
    srgb = node.find(f"{A}srgbClr")
    if srgb is not None and srgb.get("val"):
        return srgb.get("val").upper()
    sysclr = node.find(f"{A}sysClr")
    if sysclr is not None:
        # prefer lastClr attribute, fall back to known system color
        last = sysclr.get("lastClr")
        if last:
            return last.upper()
        return SYS_COLOR_FALLBACK.get(sysclr.get("val", ""), None)
    return None


def parse_theme(xml_bytes: bytes) -> dict:
    """Extract colors and fonts from theme XML bytes."""
    root = ET.fromstring(xml_bytes)

    colors: dict[str, str] = {}
    clr_scheme = root.find(f".//{A}clrScheme")
    if clr_scheme is not None:
        for key in COLOR_KEYS:
            node = clr_scheme.find(f"{A}{key}")
            if node is not None:
                hexval = _resolve_color(node)
                if hexval:
                    colors[key] = hexval

    fonts: dict[str, str] = {}
    font_scheme = root.find(f".//{A}fontScheme")
    if font_scheme is not None:
        major = font_scheme.find(f"{A}majorFont/{A}latin")
        minor = font_scheme.find(f"{A}minorFont/{A}latin")
        if major is not None and major.get("typeface"):
            fonts["major"] = major.get("typeface")
        if minor is not None and minor.get("typeface"):
            fonts["minor"] = minor.get("typeface")
        # pick up Japanese (East Asian) fonts if present
        major_ea = font_scheme.find(f'{A}majorFont/{A}font[@script="Jpan"]')
        minor_ea = font_scheme.find(f'{A}minorFont/{A}font[@script="Jpan"]')
        if major_ea is not None and major_ea.get("typeface"):
            fonts["major_ja"] = major_ea.get("typeface")
        if minor_ea is not None and minor_ea.get("typeface"):
            fonts["minor_ja"] = minor_ea.get("typeface")

    scheme_name = root.get("name", "extracted")
    return {"name": scheme_name, "colors": colors, "fonts": fonts}


def _hex(colors: dict, key: str, default: str) -> str:
    val = colors.get(key)
    return f"#{val}" if val else default


def _font_stack(fonts: dict, kind: str) -> str:
    """Build a CSS font stack from the major/minor font entries."""
    latin = fonts.get(kind)
    ja = fonts.get(f"{kind}_ja")
    parts = []
    if latin:
        parts.append(f'"{latin}"')
    if ja:
        parts.append(f'"{ja}"')
    # always append Japanese fallbacks
    parts += [
        '"Hiragino Kaku Gothic ProN"',
        '"Yu Gothic UI"',
        '"Meiryo"',
        "system-ui",
        "sans-serif",
    ]
    # deduplicate while preserving order
    seen = set()
    uniq = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    return ", ".join(uniq)


def render_css(theme_name: str, parsed: dict) -> str:
    """Generate a Marp theme CSS compatible with corporate.css from extracted data."""
    colors = parsed["colors"]
    fonts = parsed["fonts"]

    primary = _hex(colors, "accent1", "#1f6feb")
    secondary = _hex(colors, "dk2", _hex(colors, "accent2", "#0b3d91"))
    accent = _hex(colors, "accent3", _hex(colors, "accent2", "#f0a202"))
    background = _hex(colors, "lt1", "#ffffff")
    foreground = _hex(colors, "dk1", "#22272e")
    link = _hex(colors, "hlink", primary)

    font_base = _font_stack(fonts, "minor")
    font_heading = _font_stack(fonts, "major")

    src_name = parsed.get("name", "extracted")
    return f"""/* @theme {theme_name} */

/*
 * Auto-generated by extract_theme.py from a PPTX file.
 * Source theme: {src_name}
 * Edit the :root variables below to customize colors and fonts.
 */

@import "default";

:root {{
  --brand-primary: {primary};
  --brand-secondary: {secondary};
  --brand-accent: {accent};

  --color-background: {background};
  --color-foreground: {foreground};
  --color-heading: var(--brand-secondary);
  --color-link: {link};

  --font-base: {font_base};
  --font-heading: {font_heading};
  --font-code: "Cascadia Code", "Consolas", "SFMono-Regular", monospace;

  font-family: var(--font-base);
  color: var(--color-foreground);
  background-color: var(--color-background);
}}

section {{
  font-family: var(--font-base);
  color: var(--color-foreground);
  background-color: var(--color-background);
  padding: 60px 70px;
  font-size: 26px;
  line-height: 1.5;
}}

h1, h2, h3, h4, h5, h6 {{
  font-family: var(--font-heading);
  color: var(--color-heading);
}}

h1 {{
  font-size: 1.9em;
  border-bottom: 4px solid var(--brand-primary);
  padding-bottom: 0.2em;
}}

h2 {{ font-size: 1.4em; }}

a {{ color: var(--color-link); }}
strong {{ color: var(--brand-secondary); }}
ul > li::marker {{ color: var(--brand-primary); }}

code {{ font-family: var(--font-code); }}
pre {{ border-radius: 8px; }}

table th {{
  background-color: var(--brand-primary);
  color: #ffffff;
}}

blockquote {{
  border-left: 6px solid var(--brand-accent);
  color: #4a5160;
}}

section::after {{
  color: #8b95a1;
  font-size: 0.6em;
}}

section.title {{
  justify-content: center;
  text-align: center;
  background: linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 100%);
  color: #ffffff;
}}
section.title h1 {{
  color: #ffffff;
  border-bottom: none;
  font-size: 2.4em;
}}
section.title h2, section.title h3 {{ color: rgba(255, 255, 255, 0.85); }}

section.section {{
  justify-content: center;
  background-color: var(--brand-secondary);
  color: #ffffff;
}}
section.section h1, section.section h2 {{
  color: #ffffff;
  border-bottom: none;
}}
"""


def slugify(text: str) -> str:
    s = re.sub(r"[^\w-]+", "-", text.strip().lower())
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "extracted"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract a Marp theme (CSS) from a PPTX file"
    )
    parser.add_argument("pptx", help="path to the input PPTX file")
    parser.add_argument(
        "-n",
        "--name",
        help="theme name to use (@theme name; defaults to the PPTX filename)",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="output CSS path (default: src/themes/<name>.css)",
    )
    parser.add_argument(
        "--print",
        action="store_true",
        help="print the CSS to stdout instead of writing a file",
    )
    args = parser.parse_args(argv)

    pptx_path = Path(args.pptx)
    if not pptx_path.exists():
        print(f"Error: file not found: {pptx_path}", file=sys.stderr)
        return 1

    try:
        xml_bytes = _read_theme_xml(pptx_path)
        parsed = parse_theme(xml_bytes)
    except (zipfile.BadZipFile, ValueError, ET.ParseError) as e:
        print(f"Error: failed to parse PPTX: {e}", file=sys.stderr)
        return 1

    theme_name = slugify(args.name) if args.name else slugify(pptx_path.stem)
    css = render_css(theme_name, parsed)

    if args.print:
        print(css)
        return 0

    out_path = (
        Path(args.output)
        if args.output
        else DEFAULT_THEMES_DIR / f"{theme_name}.css"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(css, encoding="utf-8")

    print(f"[OK] Theme generated: {out_path}")
    print(f"  @theme name    : {theme_name}")
    print(f"  Source theme   : {parsed.get('name')}")
    if parsed["colors"]:
        cols = ", ".join(f"{k}=#{v}" for k, v in parsed["colors"].items())
        print(f"  Colors         : {cols}")
    if parsed["fonts"]:
        fns = ", ".join(f"{k}={v}" for k, v in parsed["fonts"].items())
        print(f"  Fonts          : {fns}")
    print()
    print(f"Usage: node src/convert.mjs --theme {theme_name} -f pdf")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
