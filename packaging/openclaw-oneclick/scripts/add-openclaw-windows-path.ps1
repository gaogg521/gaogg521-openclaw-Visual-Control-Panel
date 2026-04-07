#Requires -Version 5.1
<#
.SYNOPSIS
  将 ONE Claw 一键安装相关目录追加到当前用户的持久化 Path（注册表）：
  - %LOCALAPPDATA%\ONEClaw\node-portable\node-v*-win-x64\（若存在，取字典序最新的）
  - 同上目录下的 node_modules\npm\bin
  - %LOCALAPPDATA%\npm（npm 全局 bin，含 openclaw.cmd 等）
  已存在则跳过；执行后广播 Environment 变更（新终端生效）。
#>
$ErrorActionPreference = "Stop"

function Send-EnvironmentChanged {
  try {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EnvBroadcast {
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
"@
    $HWND_BROADCAST = [IntPtr]0xffff
    $WM_SETTINGCHANGE = 0x001A
    [UIntPtr]$res = [UIntPtr]::Zero
    [void][EnvBroadcast]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, "Environment", 2, 500, [ref]$res)
  }
  catch { }
}

function Get-UserPathParts {
  $raw = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $raw) { return @() }
  return @($raw -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Set-UserPathParts([string[]]$Parts) {
  $uniq = [System.Collections.Generic.List[string]]::new()
  foreach ($p in $Parts) {
    if (-not $p) { continue }
    if (-not $uniq.Contains($p)) { $uniq.Add($p) }
  }
  [Environment]::SetEnvironmentVariable("Path", ($uniq -join ";"), "User")
  Send-EnvironmentChanged
}

function Add-SegmentsToUserPath([string[]]$Segments) {
  $parts = @(Get-UserPathParts)
  $added = $false
  foreach ($seg in $Segments) {
    if (-not $seg) { continue }
    if (-not (Test-Path -LiteralPath $seg)) { continue }
    try {
      $full = (Resolve-Path -LiteralPath $seg).Path
    }
    catch {
      $full = $seg
    }
    if ($parts -notcontains $full) {
      $parts += $full
      $added = $true
    }
  }
  if ($added) {
    Set-UserPathParts $parts
    Write-Host "[openclaw-oneclick] Updated User PATH (openclaw / portable Node)."
  }
}

$toAdd = [System.Collections.Generic.List[string]]::new()

$portableRoot = Join-Path $env:LOCALAPPDATA "ONEClaw\node-portable"
if (Test-Path -LiteralPath $portableRoot) {
  $bestDir = $null
  $bestVer = $null
  Get-ChildItem -LiteralPath $portableRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
      if ($_.Name -match '^node-v([\d.]+)-win-x64$') {
        try {
          $v = [version]$Matches[1]
          if ($null -eq $bestVer -or $v -gt $bestVer) {
            $bestVer = $v
            $bestDir = $_
          }
        }
        catch { }
      }
    }
  if ($bestDir) {
    $nodeDir = $bestDir.FullName
    $toAdd.Add($nodeDir)
    $npmBin = Join-Path $nodeDir "node_modules\npm\bin"
    if (Test-Path -LiteralPath $npmBin) {
      $toAdd.Add($npmBin)
    }
  }
}

$npmGlobal = Join-Path $env:LOCALAPPDATA "npm"
if (Test-Path -LiteralPath $npmGlobal) {
  $toAdd.Add($npmGlobal)
}

if ($toAdd.Count -gt 0) {
  Add-SegmentsToUserPath @($toAdd.ToArray())
}
