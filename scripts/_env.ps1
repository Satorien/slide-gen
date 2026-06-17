# scripts/_env.ps1
# Common environment setup sourced at the top of each script.
# Activates the fnm-managed Node version specified in .node-version.

$ErrorActionPreference = "Stop"

# Project root (one level above this script)
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Enable-FnmNode {
    if (-not (Get-Command fnm -ErrorAction SilentlyContinue)) {
        Write-Warning "fnm not found. Using the default node."
        return
    }
    # apply fnm to the current shell
    fnm env --use-on-cd | Out-String | Invoke-Expression
    # switch to the version in .node-version (install if missing)
    Push-Location $script:ProjectRoot
    try {
        fnm use --install-if-missing 2>$null | Out-Null
    } finally {
        Pop-Location
    }
}

Enable-FnmNode
