<#
.SYNOPSIS
  Watch Markdown files for changes and rebuild slides automatically.

.EXAMPLE
  ./scripts/watch.ps1
  ./scripts/watch.ps1 -Format pdf
#>
[CmdletBinding()]
param(
    [Alias("i")] [string] $Input,
    [Alias("o")] [string] $Output,
    [Alias("f")] [ValidateSet("html", "pdf", "pptx", "png")] [string] $Format = "html",
    [string] $Theme
)

. "$PSScriptRoot/_env.ps1"

$argsList = @("$ProjectRoot/src/convert.mjs", "--watch", "--format", $Format)
if ($Input) { $argsList += @("--input", $Input) }
if ($Output) { $argsList += @("--output", $Output) }
if ($Theme) { $argsList += @("--theme", $Theme) }

Push-Location $ProjectRoot
try {
    Write-Host "Watching for changes (Ctrl+C to stop)" -ForegroundColor Cyan
    node @argsList
} finally {
    Pop-Location
}
