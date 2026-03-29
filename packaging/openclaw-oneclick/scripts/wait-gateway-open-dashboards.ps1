#Requires -Version 5.1
param(
  [int]$MaxWaitSec = 120,
  [int]$LobsterPort = 3003
)
$ErrorActionPreference = "Stop"
$homeOpenclaw = Join-Path $HOME ".openclaw"
$cfgPath = Join-Path $homeOpenclaw "openclaw.json"
$port = 18789
$token = ""
if (Test-Path $cfgPath) {
  try {
    $cfg = Get-Content -Raw $cfgPath | ConvertFrom-Json
    if ($cfg.gateway.port) { $port = [int]$cfg.gateway.port }
    if ($cfg.gateway.auth.token) { $token = [string]$cfg.gateway.auth.token }
  } catch { Write-Warning "Could not parse openclaw.json, using defaults" }
}

$openclawChat = "http://localhost:$port/chat"
if ($token) { $openclawChat += "?token=$([System.Uri]::EscapeDataString($token))" }
$lobster = "http://localhost:$LobsterPort/oneone-dashboard"

Write-Host "[openclaw-oneclick] Waiting for gateway TCP $port (max ${MaxWaitSec}s) ..."
$deadline = (Get-Date).AddSeconds($MaxWaitSec)
$ok = $false
while ((Get-Date) -lt $deadline) {
  $t = Test-NetConnection -ComputerName "127.0.0.1" -Port $port -WarningAction SilentlyContinue
  if ($t.TcpTestSucceeded) { $ok = $true; break }
  Start-Sleep -Seconds 2
}

if (-not $ok) {
  Write-Warning "Port $port not open yet. Check: openclaw gateway status"
  exit 1
}

Write-Host "[openclaw-oneclick] Opening OpenClaw UI: $openclawChat"
Start-Process $openclawChat
Start-Sleep -Milliseconds 400
Write-Host "[openclaw-oneclick] Opening lobster dashboard: $lobster"
Start-Process $lobster
