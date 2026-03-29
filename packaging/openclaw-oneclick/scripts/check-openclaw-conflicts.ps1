#Requires -Version 5.1
<#
  安装前检测：已有 openclaw 则跳过官方安装；网关端口占用且无 CLI 则报错。
  参考: https://github.com/oneclaw/oneclaw
  退出码: 0=继续安装  10=跳过安装  20=端口冲突
#>
$ErrorActionPreference = "Continue"

$force = $env:OPENCLAW_ONECLICK_FORCE_REINSTALL
if ($force -eq "1" -or $force -eq "true") {
  Write-Host "[openclaw-oneclick/check] OPENCLAW_ONECLICK_FORCE_REINSTALL=1 — will run official install.ps1."
  exit 0
}

$oc = Get-Command openclaw -ErrorAction SilentlyContinue
if ($oc) {
  $null = & openclaw --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $ver = (& openclaw --version 2>&1 | Out-String).Trim()
    Write-Host "[openclaw-oneclick/check] OpenClaw CLI already on PATH: $ver"
    Write-Host "[openclaw-oneclick/check] Skip official install.ps1 to avoid duplicate install / overwrite. Set OPENCLAW_ONECLICK_FORCE_REINSTALL=1 to force."
    exit 10
  }
}

$homeOc = if ($env:OPENCLAW_HOME) { $env:OPENCLAW_HOME } else { Join-Path $HOME ".openclaw" }
$cfgPath = Join-Path $homeOc "openclaw.json"
$gwPort = 18789
if (Test-Path $cfgPath) {
  try {
    $cfg = Get-Content -Raw $cfgPath | ConvertFrom-Json
    if ($cfg.gateway.port) { $gwPort = [int]$cfg.gateway.port }
  } catch { }
}

$t = Test-NetConnection -ComputerName "127.0.0.1" -Port $gwPort -WarningAction SilentlyContinue
if ($t.TcpTestSucceeded) {
  if ($env:OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY -eq "1" -or $env:OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY -eq "true") {
    Write-Host "[openclaw-oneclick/check] WARN: port $gwPort busy, ALLOW_BUSY_GATEWAY=1 — continuing."
    exit 0
  }
  Write-Host "[openclaw-oneclick/check] ERROR: port $gwPort is in use but openclaw CLI was not found." -ForegroundColor Red
  Write-Host "[openclaw-oneclick/check] Free the port or set OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY=1 to proceed anyway." -ForegroundColor Red
  exit 20
}

Write-Host "[openclaw-oneclick/check] No openclaw on PATH and port $gwPort is free — will run official install."
exit 0
