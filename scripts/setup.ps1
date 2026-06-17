<#
.SYNOPSIS
  Initialize the development environment (run once after cloning).
  - Installs the Node version from .node-version via fnm, then runs npm install
  - Creates a Python virtual environment via uv

.EXAMPLE
  ./scripts/setup.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot
try {
    Write-Host "=== Node (fnm) ===" -ForegroundColor Cyan
    if (Get-Command fnm -ErrorAction SilentlyContinue) {
        fnm env --use-on-cd | Out-String | Invoke-Expression
        fnm use --install-if-missing
        node --version
        Write-Host "npm install ..." -ForegroundColor DarkGray
        npm install
    } else {
        Write-Warning "fnm not found. Install it with 'scoop install fnm' or from https://github.com/Schniz/fnm."
    }

    Write-Host "`n=== Python (uv) ===" -ForegroundColor Cyan
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv sync
        Write-Host "Python virtual environment is ready." -ForegroundColor Green
    } else {
        Write-Warning "uv not found. See https://docs.astral.sh/uv/ for installation instructions."
    }

    Write-Host "`nSetup complete. Try:" -ForegroundColor Green
    Write-Host "  ./scripts/build.ps1            # convert slides/ to HTML"
    Write-Host "  ./scripts/preview.ps1          # live preview"
} finally {
    Pop-Location
}
