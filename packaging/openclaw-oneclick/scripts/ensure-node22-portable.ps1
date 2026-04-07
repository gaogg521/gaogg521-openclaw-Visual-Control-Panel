#Requires -Version 5.1
<#
.SYNOPSIS
  若 PATH 上无 Node 或主版本 < 22，则下载并解压 Node.js v22 win-x64 zip 到
  %LOCALAPPDATA%\ONEClaw\node-portable，并把该目录置于当前进程 PATH 最前。
  用户级持久化 Path 由 add-openclaw-windows-path.ps1 在安装流程末尾写入。
#>
$ErrorActionPreference = "Stop"

function Ensure-Node22Plus {
  $need = $true
  try {
    if (Get-Command node -ErrorAction SilentlyContinue) {
      $raw = (node -v 2>&1 | Select-Object -First 1 | Out-String).Trim()
      if ($raw -match '^v(\d+)') {
        if ([int]$Matches[1] -ge 22) { $need = $false }
      }
    }
  }
  catch { }

  if (-not $need) { return }

  $cacheRoot = Join-Path $env:LOCALAPPDATA "ONEClaw\node-portable"
  New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
  $idx = Invoke-RestMethod -UseBasicParsing -Uri "https://nodejs.org/dist/index.json"
  $ver = (
    $idx |
    Where-Object { $_.version -like "v22.*" -and ($_.files -contains "win-x64-zip") } |
    Select-Object -First 1
  ).version
  if (-not $ver) {
    throw "Cannot resolve Node.js v22+ win-x64 zip from nodejs.org"
  }
  $zipName = "node-$ver-win-x64.zip"
  $zipPath = Join-Path $cacheRoot $zipName
  $nodeDir = Join-Path $cacheRoot "node-$ver-win-x64"
  if (-not (Test-Path -LiteralPath $nodeDir)) {
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$ver/$zipName" -OutFile $zipPath
    Expand-Archive -LiteralPath $zipPath -DestinationPath $cacheRoot -Force
  }
  $npmBin = Join-Path $nodeDir "node_modules\npm\bin"
  $env:Path = "$nodeDir;$npmBin;$env:Path"
  Write-Host "[openclaw-oneclick] Using portable Node $ver at $nodeDir"
}

Ensure-Node22Plus
