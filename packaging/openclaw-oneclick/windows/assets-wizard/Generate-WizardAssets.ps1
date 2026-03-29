#Requires -Version 5.1
<#
  生成「常见商业桌面软件」安装向导风格资源（VS Code / Slack / Office 系常见做法）：
  - 浅色、高对比：淡灰白渐变背景，无文字、无产品界面截图
  - 底部极细品牌色条（可选识别度，不抢正文）
  - 角标：白底 + 品牌图形，适配浅色标题栏

  禁止：网页控制台整页截图作 WizardBackImageFile（叠字不可读）

  参考：Microsoft Win32 安装体验
  https://learn.microsoft.com/windows/win32/uxguide/exper-setup

  输出：WizardBack-994/596.png、WizardBackDark.png（实为浅色底，文件名保留兼容）、WizardCorner55.png、SetupApp.ico

  Logo：默认与网页首页一致 — 龙虾面板仓库根目录 public\\brand-mark.png（npm run brand:mark 生成）；
  若不存在则回退同目录 game-logo.png；再不行用占位图。角标 55×55 内等比居中，白底（适配浅色向导）。
#>
param(
  [string]$OutDir = $PSScriptRoot,
  [string]$LogoPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Save-Png([System.Drawing.Bitmap]$Bmp, [string]$Path) {
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-CleanWizardBackground {
  param([int]$W, [int]$H)
  # 接近 Win11 / 常见 MSI 向导：近白 + 极浅灰，利于深色系统字体渲染
  $cTop = [System.Drawing.Color]::FromArgb(255, 0xFC, 0xFC, 0xFC)
  $cBot = [System.Drawing.Color]::FromArgb(255, 0xF0, 0xF1, 0xF3)
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(0, $H)),
    $cTop,
    $cBot
  )
  $g.FillRectangle($brush, 0, 0, $W, $H)
  $brush.Dispose()
  # 品牌红细条（与网页强调色一致，面积小）
  $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0xE5, 0x00, 0x12))
  $g.FillRectangle($red, 0, $H - 3, $W, 3)
  $red.Dispose()
  $g.Dispose()
  return $bmp
}

function New-LogoCorner55 {
  param([string]$Path)
  $n = 55
  $pad = 3
  $inner = $n - 2 * $pad
  $src = [System.Drawing.Image]::FromFile($Path)
  try {
    $sw = $src.Width
    $sh = $src.Height
    if ($sw -lt 1 -or $sh -lt 1) { throw "Invalid logo size" }
    $scale = [math]::Min($inner / $sw, $inner / $sh)
    $dw = [int][math]::Max(1, [math]::Round($sw * $scale))
    $dh = [int][math]::Max(1, [math]::Round($sh * $scale))
    $dx = [int](($n - $dw) / 2)
    $dy = [int](($n - $dh) / 2)
    $bmp = New-Object System.Drawing.Bitmap($n, $n)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.DrawImage($src, $dx, $dy, $dw, $dh)
    $g.Dispose()
    return $bmp
  } finally {
    $src.Dispose()
  }
}

function New-PlaceholderCorner55 {
  $n = 55
  $bmp = New-Object System.Drawing.Bitmap($n, $n)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0xFF, 0xFF, 0xFF))
  $g.FillRectangle($bg, 0, 0, $n, $n)
  $bg.Dispose()
  $border = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0xE0, 0xE2, 0xE6), 1)
  $g.DrawRectangle($border, 0, 0, $n - 1, $n - 1)
  $border.Dispose()
  $gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0xD4, 0x9A, 0x00))
  $g.FillEllipse($gold, 12, 13, 20, 20)
  $gold.Dispose()
  $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0xE5, 0x00, 0x12))
  $g.FillRectangle($red, 0, $n - 4, $n, 4)
  $red.Dispose()
  $g.Dispose()
  return $bmp
}

$sizes = @(
  @{ W = 596; H = 432; Name = "WizardBack-596.png" },
  @{ W = 994; H = 720; Name = "WizardBack-994.png" }
)
foreach ($s in $sizes) {
  $b = New-CleanWizardBackground -W $s.W -H $s.H
  Save-Png $b (Join-Path $OutDir $s.Name)
  $b.Dispose()
  Write-Host "Wrote $($s.Name)"
}

Copy-Item -LiteralPath (Join-Path $OutDir "WizardBack-994.png") -Destination (Join-Path $OutDir "WizardBackDark.png") -Force
Write-Host "Wrote WizardBackDark.png (light theme, name kept for script compatibility)"

if (-not $LogoPath) {
  $repoRoot = $null
  try {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
  } catch { }
  $brandMark = if ($repoRoot) { Join-Path $repoRoot "public\brand-mark.png" } else { "" }
  $fallbackGame = Join-Path $OutDir "game-logo.png"
  if ($brandMark -and (Test-Path -LiteralPath $brandMark)) {
    $LogoPath = $brandMark
  } elseif (Test-Path -LiteralPath $fallbackGame) {
    $LogoPath = $fallbackGame
  }
}
if ($LogoPath -and (Test-Path -LiteralPath $LogoPath)) {
  $corner = New-LogoCorner55 -Path $LogoPath
  Write-Host "WizardCorner55 from: $LogoPath"
} else {
  Write-Warning "未找到 public\brand-mark.png 或 game-logo.png ，使用占位角标。请在面板根目录执行 npm run brand:mark 或用 -LogoPath 指定。"
  $corner = New-PlaceholderCorner55
}
Save-Png $corner (Join-Path $OutDir "WizardCorner55.png")
$corner.Dispose()
Write-Host "Wrote WizardCorner55.png"

$ico32 = New-Object System.Drawing.Bitmap(32, 32)
$gi = [System.Drawing.Graphics]::FromImage($ico32)
$gi.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gi.DrawImage([System.Drawing.Image]::FromFile((Join-Path $OutDir "WizardCorner55.png")), 0, 0, 32, 32)
$gi.Dispose()
$icoPath = Join-Path $OutDir "SetupApp.ico"
$fs = [System.IO.File]::Create($icoPath)
try {
  $icon = [System.Drawing.Icon]::FromHandle($ico32.GetHicon())
  $icon.Save($fs)
  $icon.Dispose()
} finally { $fs.Close() }
$ico32.Dispose()
Write-Host "Wrote SetupApp.ico"
