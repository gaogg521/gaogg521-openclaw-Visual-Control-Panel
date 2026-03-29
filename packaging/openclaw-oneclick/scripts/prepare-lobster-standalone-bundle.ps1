# 在龙虾项目根执行
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Set-Location $Root
npm run build
$standalone = Join-Path $Root ".next\standalone"
New-Item -ItemType Directory -Force -Path (Join-Path $standalone ".next") | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root ".next\static") (Join-Path $standalone ".next\static")
Copy-Item -Recurse -Force (Join-Path $Root "public") (Join-Path $standalone "public")
Write-Host "[ok] Bundle ready under .next\standalone"
