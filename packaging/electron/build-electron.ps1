<#
.SYNOPSIS
  一键构建 1ONE 龙虾控制台 Electron 安装包（Windows NSIS；逻辑与 build-electron.js 一致）。

.DESCRIPTION
  实际步骤由 packaging/electron/build-electron.js 执行（跨平台）。
  Mac / Linux 请用：./build-electron.sh 或 node build-electron.js

.EXAMPLE
  cd <项目根目录>/packaging/electron
  .\build-electron.ps1

  跳过 Next 构建：
  .\build-electron.ps1 -SkipNextBuild

  显式指定平台（一般不需要）：
  node .\build-electron.js -- --win
#>
param(
  [switch]$SkipNextBuild,
  [Parameter(ValueFromRemainingArguments = $true)]
  $RemainingArguments
)

$ErrorActionPreference = "Stop"
$js = Join-Path $PSScriptRoot "build-electron.js"
$extra = @()
if ($SkipNextBuild) { $extra += "--skip-next-build" }
& node $js @extra @RemainingArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
