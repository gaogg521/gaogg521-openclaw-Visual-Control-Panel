#Requires -Version 5.1
<#
  顺序：onboard（wizard.env）→ 启动龙虾 standalone → 等待网关并打开两个浏览器页
  需已安装 openclaw，且已在 lobster 项目根执行 npm run build
#>
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
  Write-Error "未找到 openclaw 命令。请先运行 install-openclaw-windows.ps1（若已安装仍报错，请检查 PATH）。"
  exit 1
}

& (Join-Path $ScriptDir "run-onboard-from-env.ps1")
& (Join-Path $ScriptDir "start-lobster-standalone.ps1")
Start-Sleep -Seconds 3
& (Join-Path $ScriptDir "wait-gateway-open-dashboards.ps1")
