#Requires -Version 5.1
# 启动龙虾前检测 3003（或可改 LOBSTER_PORT）是否被占用
param([int]$Port = $(if ($env:LOBSTER_PORT) { [int]$env:LOBSTER_PORT } else { 3003 }))
$ErrorActionPreference = "Continue"
$t = Test-NetConnection -ComputerName "127.0.0.1" -Port $Port -WarningAction SilentlyContinue
if ($t.TcpTestSucceeded) {
  if ($env:OPENCLAW_ONECLICK_ALLOW_BUSY_LOBSTER -eq "1") {
    Write-Host "[openclaw-oneclick/check] WARN: lobster port $Port busy, ALLOW_BUSY_LOBSTER=1"
    exit 0
  }
  Write-Host "[openclaw-oneclick/check] ERROR: port $Port already in use (lobster dashboard). Change LOBSTER_PORT or stop the other process." -ForegroundColor Red
  exit 30
}
exit 0
