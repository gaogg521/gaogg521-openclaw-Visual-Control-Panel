#Requires -Version 5.1
<#
  读取 ../config/wizard.env，执行 openclaw onboard --non-interactive
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root "config\wizard.env"
if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile — copy wizard.example.env to wizard.env and fill keys."
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^\s*#' -or $line -eq '') { return }
  if ($line -match '^([^=]+)=(.*)$') {
    $k = $matches[1].Trim()
    $v = $matches[2].Trim()
    [Environment]::SetEnvironmentVariable($k, $v, "Process")
  }
}

$auth = $env:AUTH_CHOICE
if (-not $auth) { Write-Error "AUTH_CHOICE missing in wizard.env" }

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "18789" }
$bind = if ($env:GATEWAY_BIND) { $env:GATEWAY_BIND } else { "loopback" }
$installDaemon = $env:INSTALL_DAEMON -eq "1" -or $env:INSTALL_DAEMON -eq "true"
$daemonRt = if ($env:DAEMON_RUNTIME) { $env:DAEMON_RUNTIME } else { "node" }
$skipSkills = $env:SKIP_SKILLS -ne "0" -and $env:SKIP_SKILLS -ne "false"

$ocArgs = @(
  "onboard", "--non-interactive",
  "--mode", "local",
  "--auth-choice", $auth,
  "--secret-input-mode", "plaintext",
  "--gateway-port", $port,
  "--gateway-bind", $bind
)
if ($installDaemon) { $ocArgs += @("--install-daemon", "--daemon-runtime", $daemonRt) }
if ($skipSkills) { $ocArgs += "--skip-skills" }

function Add-KeyArg([string]$flag, [string]$val) {
  if ($val) { $script:ocArgs += @($flag, $val) }
}

switch -Regex ($auth) {
  "openai-api-key" { Add-KeyArg "--openai-api-key" $env:OPENAI_API_KEY }
  "anthropic-api-key" { Add-KeyArg "--anthropic-api-key" $env:ANTHROPIC_API_KEY }
  "moonshot-api-key" { Add-KeyArg "--moonshot-api-key" $env:MOONSHOT_API_KEY }
  "gemini-api-key" { Add-KeyArg "--gemini-api-key" $env:GEMINI_API_KEY }
  "ollama" {
    Add-KeyArg "--custom-model-id" $env:CUSTOM_MODEL_ID
    if ($env:ACCEPT_RISK -eq "1" -or $env:ACCEPT_RISK -eq "true") { $ocArgs += "--accept-risk" }
  }
  "custom-api-key" {
    Add-KeyArg "--custom-base-url" $env:CUSTOM_BASE_URL
    Add-KeyArg "--custom-api-key" $env:CUSTOM_API_KEY
    Add-KeyArg "--custom-provider-id" $env:CUSTOM_PROVIDER_ID
    Add-KeyArg "--custom-compatibility" $env:CUSTOM_COMPATIBILITY
  }
  default {
    Write-Warning "AUTH_CHOICE=$auth — add explicit flags in this script if onboard fails."
  }
}

Write-Host "[openclaw-oneclick] openclaw $($ocArgs -join ' ')"
& openclaw @ocArgs
Write-Host "[openclaw-oneclick] onboard finished. Start lobster + run wait-gateway-open-dashboards.ps1"
