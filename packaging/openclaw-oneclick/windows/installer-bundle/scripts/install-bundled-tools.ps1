#Requires -Version 5.1
<#
  安装后：将 {app}\tools\node 与 {app}\tools\git\cmd 追加到当前用户 PATH，并检测 node/git 是否可执行。
  卸载：-Uninstall 时从用户 PATH 中移除本安装目录下 tools 相关段。
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$AppDir,
  [switch]$Uninstall
)

$ErrorActionPreference = "Continue"
Add-Type -AssemblyName System.Windows.Forms

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
  } catch { }
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

function Add-ToolsToUserPath {
  $nodeDir = Join-Path $AppDir "tools\node"
  $gitCmd = Join-Path $AppDir "tools\git\cmd"
  $parts = @(Get-UserPathParts)
  $added = $false
  foreach ($seg in @($nodeDir, $gitCmd)) {
    if (-not (Test-Path -LiteralPath $seg)) { continue }
    try {
      $full = (Resolve-Path -LiteralPath $seg).Path
    } catch {
      $full = $seg
    }
    if ($parts -notcontains $full) {
      $parts += $full
      $added = $true
    }
  }
  if ($added) { Set-UserPathParts $parts }
  return $added
}

function Remove-ToolsFromUserPath {
  $prefix = (Join-Path $AppDir "tools").TrimEnd("\")
  $parts = Get-UserPathParts | Where-Object {
    $_ -and ($_ -notlike "$prefix*")
  }
  Set-UserPathParts $parts
}

$nodeExe = Join-Path $AppDir "tools\node\node.exe"
$gitExe = Join-Path $AppDir "tools\git\cmd\git.exe"

if ($Uninstall) {
  Remove-ToolsFromUserPath
  exit 0
}

$addedPath = Add-ToolsToUserPath
if ($addedPath) { Start-Sleep -Milliseconds 400 }

$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

$issues = @()

if (-not (Test-Path -LiteralPath $nodeExe)) {
  $issues += "未检测到安装包内置 Node（编译前未运行 prepare-full-redist.ps1）。`n请打开 https://nodejs.org 下载并安装 LTS（可勾选自动加入 PATH）。"
} else {
  $pn = Start-Process -FilePath $nodeExe -ArgumentList "-v" -Wait -PassThru -WindowStyle Hidden
  if ($pn.ExitCode -ne 0) {
    $issues += "内置 Node 无法执行（可能被安全软件拦截）。`n请从 https://nodejs.org 手动安装 Node.js LTS。"
  }
}

if (-not (Test-Path -LiteralPath $gitExe)) {
  $issues += "未检测到安装包内置 Git（MinGit）。`n请打开 https://git-scm.com/download/win 下载并安装 Git for Windows。"
} else {
  $pg = Start-Process -FilePath $gitExe -ArgumentList "--version" -Wait -PassThru -WindowStyle Hidden
  if ($pg.ExitCode -ne 0) {
    $issues += "内置 Git 无法执行。`n请从 https://git-scm.com/download/win 手动安装 Git。"
  }
}

if ($issues.Count -gt 0) {
  $body = ($issues -join "`n`n---`n`n") + "`n`n配置用户 PATH 后，请重新打开终端或重新登录 Windows 再试。"
  [void][System.Windows.Forms.MessageBox]::Show(
    $body,
    "ONE CLAW OneClick — 需要您手动安装",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  )
}

exit 0
