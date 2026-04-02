#Requires -Version 5.1
<#
.SYNOPSIS
  使用官方 install.ps1 静默安装 OpenClaw（-NoOnboard，无向导）。
  文档: https://docs.openclaw.ai/install
  已安装则跳过，避免重复安装；端口冲突见 check-openclaw-conflicts.ps1
#>
$ErrorActionPreference = "Stop"

$checkScript = Join-Path $PSScriptRoot "check-openclaw-conflicts.ps1"
$p = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $checkScript
) -Wait -PassThru
$chk = $p.ExitCode
switch ($chk) {
  10 {
    Write-Host "[openclaw-oneclick] Install skipped (already installed)."
    exit 0
  }
  0 { }
  default { exit $chk }
}

. (Join-Path $PSScriptRoot "ensure-node22-portable.ps1")

$env:SHARP_IGNORE_GLOBAL_LIBVIPS = if ($env:SHARP_IGNORE_GLOBAL_LIBVIPS) { $env:SHARP_IGNORE_GLOBAL_LIBVIPS } else { "1" }
$env:OPENCLAW_NO_ONBOARD = "1"

Write-Host "[openclaw-oneclick] Fetching official install.ps1 ..."
$src = Invoke-WebRequest -UseBasicParsing -Uri "https://openclaw.ai/install.ps1"
& ([scriptblock]::Create($src.Content)) -NoOnboard

$oc = Get-Command openclaw -ErrorAction SilentlyContinue
if (-not $oc) {
  Write-Warning "openclaw not on PATH. Add npm global prefix to user PATH (see OpenClaw docs), then reopen PowerShell."
  exit 1
}
openclaw --version
Write-Host "[openclaw-oneclick] Done. Next: copy config\wizard.example.env to wizard.env and run .\run-onboard-from-env.ps1"
