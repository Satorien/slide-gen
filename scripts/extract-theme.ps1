<#
.SYNOPSIS
  PPTX から Marp テーマ(CSS)を抽出して src/themes/ に生成する。

.EXAMPLE
  ./scripts/extract-theme.ps1 data/pptx/sample.pptx
  ./scripts/extract-theme.ps1 data/pptx/sample.pptx -Name mybrand

.DESCRIPTION
  uv で分離した Python 環境(.venv)を使って src/extract_theme.py を実行する。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)] [string] $Pptx,
    [Alias("n")] [string] $Name,
    [Alias("o")] [string] $Output,
    [switch] $Print
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$argsList = @("run", "python", "$ProjectRoot/src/extract_theme.py", $Pptx)
if ($Name) { $argsList += @("--name", $Name) }
if ($Output) { $argsList += @("--output", $Output) }
if ($Print) { $argsList += "--print" }

Push-Location $ProjectRoot
try {
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw "uv が見つかりません。https://docs.astral.sh/uv/ を参照して導入してください。"
    }
    uv @argsList
} finally {
    Pop-Location
}
