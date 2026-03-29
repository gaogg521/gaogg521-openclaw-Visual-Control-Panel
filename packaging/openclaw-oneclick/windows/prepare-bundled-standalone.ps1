#Requires -Version 5.1
# 在「龙虾可视化控制面板」根目录执行 npm run packaging:prepare-standalone 后，
# 将 .next\standalone 复制到 installer-bundle\standalone，再编译 Inno 即可把控制台打进安装包。
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$panelRoot = (Resolve-Path (Join-Path $here "..\..\..")).Path
$src = Join-Path $panelRoot ".next\standalone"
$dst = Join-Path $here "installer-bundle\standalone"

if (-not (Test-Path (Join-Path $src "server.js"))) {
  Write-Host "未找到 $src\server.js — 请在面板根目录执行: npm run packaging:prepare-standalone" -ForegroundColor Red
  exit 1
}

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
Write-Host "已复制 standalone -> $dst"
Write-Host "下一步: 用 Inno 编译 OpenClawOneClick.iss（脚本已含 Check: HasBundledStandalone，有 server.js 即自动打入）。"
