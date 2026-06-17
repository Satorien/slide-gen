<#
.SYNOPSIS
  Start the live preview server (http://localhost:8080).
  The browser auto-reloads whenever a Markdown file is saved.

.EXAMPLE
  ./scripts/preview.ps1
  ./scripts/preview.ps1 -Input slides
#>
[CmdletBinding()]
param(
    [Alias("i")] [string] $Input
)

. "$PSScriptRoot/_env.ps1"

$argsList = @("$ProjectRoot/src/convert.mjs", "--server")
if ($Input) { $argsList += @("--input", $Input) }

Push-Location $ProjectRoot
try {
    Write-Host "Preview: http://localhost:8080  (Ctrl+C to stop)" -ForegroundColor Cyan
    node @argsList
} finally {
    Pop-Location
}
