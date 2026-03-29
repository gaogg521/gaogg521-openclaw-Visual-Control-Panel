#Requires -Version 5.1
param(
  [string]$StandaloneDir = $env:LOBSTER_STANDALONE_DIR,
  [string]$NodeExe = $env:LOBSTER_NODE_EXE,
  [int]$Port = 3003
)
$ErrorActionPreference = "Stop"
$portScript = Join-Path $PSScriptRoot "check-lobster-port.ps1"
$pp = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $portScript, "-Port", "$Port"
) -Wait -PassThru
if ($pp.ExitCode -ne 0) { exit $pp.ExitCode }

if (-not $StandaloneDir) {
  $panelRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
  $StandaloneDir = Join-Path $panelRoot ".next\standalone"
}
if (-not (Test-Path (Join-Path $StandaloneDir "server.js"))) {
  Write-Error "standalone server.js not found at $StandaloneDir — run: npm run build (with next.config output standalone)"
}
if (-not $NodeExe) { $NodeExe = "node" }

$env:PORT = "$Port"
$env:HOSTNAME = "0.0.0.0"
$env:NODE_ENV = "production"
Set-Location $StandaloneDir
Write-Host "[openclaw-oneclick] Starting lobster on port $Port from $StandaloneDir"
Start-Process -FilePath $NodeExe -ArgumentList "server.js" -WorkingDirectory $StandaloneDir -WindowStyle Minimized
Write-Host "[lobster] If static files 404, copy .next\static and public next to standalone (see Dockerfile)."
