<#
.SYNOPSIS
  Markdown をスライドに変換するワンライン実行スクリプト。

.EXAMPLE
  ./scripts/build.ps1
  ./scripts/build.ps1 -Format pdf
  ./scripts/build.ps1 -Input slides/example.md -Format pptx -Theme corporate

.DESCRIPTION
  src/convert.mjs のラッパー。追加引数は -- 以降でそのまま Marp へ渡せる。
#>
[CmdletBinding()]
param(
    [Alias("i")] [string] $Input,
    [Alias("o")] [string] $Output,
    [Alias("f")] [ValidateSet("html", "pdf", "pptx", "png")] [string] $Format = "html",
    [string] $Theme,
    [switch] $PptxEditable,
    [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest
)

. "$PSScriptRoot/_env.ps1"

$argsList = @("$ProjectRoot/src/convert.mjs", "--format", $Format)
if ($Input) { $argsList += @("--input", $Input) }
if ($Output) { $argsList += @("--output", $Output) }
if ($Theme) { $argsList += @("--theme", $Theme) }
if ($PptxEditable) { $argsList += "--pptx-editable" }
if ($Rest) { $argsList += $Rest }

Push-Location $ProjectRoot
try {
    node @argsList
} finally {
    Pop-Location
}
