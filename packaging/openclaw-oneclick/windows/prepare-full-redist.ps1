#Requires -Version 5.1
<#
  下载便携 Node.js（win-x64 zip）与 MinGit，解压到 installer-bundle\redist\
  供 OpenClawOneClick.Full.iss 打入安装包（离线、无需再执行官方安装向导）。

  编译完整安装包前在本目录执行一次（需联网）：
    .\prepare-full-redist.ps1

  可选：先执行 prepare-bundled-standalone.ps1 再编译 Full，即可同时带上控制台 standalone。
#>
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = "SilentlyContinue"

$here = $PSScriptRoot
$redist = Join-Path $here "installer-bundle\redist"
$tmp = Join-Path $env:TEMP "oneclaw-redist-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

# 版本可按需更新（官方直链）
$NodeVer = "22.14.0"
$NodeZipName = "node-v$NodeVer-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVer/$NodeZipName"

$MinGitVer = "2.48.1"
$MinGitZip = "MinGit-$MinGitVer-64-bit.zip"
$MinGitUrl = "https://github.com/git-for-windows/git/releases/download/v$MinGitVer.windows.1/$MinGitZip"

function Expand-Zip($zipPath, $destDir) {
  if (-not (Get-Command Expand-Archive -ErrorAction SilentlyContinue)) { throw "需要 PowerShell 5+ Expand-Archive" }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $destDir -Force
}

try {
  New-Item -ItemType Directory -Path $redist -Force | Out-Null
  $nodeOut = Join-Path $redist "node"
  $gitOut = Join-Path $redist "git"
  if (Test-Path $nodeOut) { Remove-Item $nodeOut -Recurse -Force }
  if (Test-Path $gitOut) { Remove-Item $gitOut -Recurse -Force }

  Write-Host "Downloading Node $NodeVer ..."
  $nodeZip = Join-Path $tmp $NodeZipName
  Invoke-WebRequest -Uri $NodeUrl -OutFile $nodeZip -UseBasicParsing
  $nodeStage = Join-Path $tmp "node-expand"
  New-Item -ItemType Directory -Path $nodeStage -Force | Out-Null
  Expand-Zip $nodeZip $nodeStage
  $inner = Get-ChildItem $nodeStage -Directory | Select-Object -First 1
  if (-not $inner) { throw "Node zip layout unexpected (no inner folder)" }
  New-Item -ItemType Directory -Path $nodeOut -Force | Out-Null
  Copy-Item -Path (Join-Path $inner.FullName "*") -Destination $nodeOut -Recurse -Force
  if (-not (Test-Path (Join-Path $nodeOut "node.exe"))) { throw "node.exe not found after extract" }
  Write-Host "OK -> $nodeOut"

  Write-Host "Downloading MinGit $MinGitVer ..."
  $gitZip = Join-Path $tmp $MinGitZip
  Invoke-WebRequest -Uri $MinGitUrl -OutFile $gitZip -UseBasicParsing
  $gStage = Join-Path $tmp "git-expand"
  New-Item -ItemType Directory -Path $gStage -Force | Out-Null
  Expand-Zip $gitZip $gStage
  New-Item -ItemType Directory -Path $gitOut -Force | Out-Null
  if (Test-Path (Join-Path $gStage "cmd\git.exe")) {
    Copy-Item -Path (Join-Path $gStage "*") -Destination $gitOut -Recurse -Force
  } else {
    $gd = Get-ChildItem $gStage -Directory | Select-Object -First 1
    if (-not $gd) { throw "MinGit zip layout unexpected" }
    Copy-Item -Path (Join-Path $gd.FullName "*") -Destination $gitOut -Recurse -Force
  }
  if (-not (Test-Path (Join-Path $gitOut "cmd\git.exe"))) { throw "MinGit cmd\git.exe not found" }
  Write-Host "OK -> $gitOut"
}
finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "完成。下一步："
Write-Host "  1) （可选）.\prepare-bundled-standalone.ps1"
Write-Host "  2) 用 Inno 编译 OpenClawOneClick.Full.iss -> Output\ONECLAW-OneClick-Full-Setup.exe"
