<#
.SYNOPSIS
  一键构建 1ONE 龙虾控制台 Electron 安装包（NSIS .exe）。

.DESCRIPTION
  步骤：
    1. 在 Next.js 项目根目录执行 npm run build（生成 .next/standalone）
    2. 将 .next/static  复制到 standalone/.next/static（静态资源必须存在）
    3. 将 public/       复制到 standalone/public（音乐、图片等）
    4. 在 packaging/electron/ 安装 Electron/electron-builder
    5. 调用 electron-builder 输出 dist/*.exe

.EXAMPLE
  cd <项目根目录>/packaging/electron
  .\build-electron.ps1

  加 -SkipNextBuild 可跳过 Next.js 构建（已有最新 standalone 时节省时间）：
  .\build-electron.ps1 -SkipNextBuild
#>
param(
  [switch]$SkipNextBuild,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../")).Path
)

$ErrorActionPreference = "Stop"

# ── 路径 ─────────────────────────────────────────────────────────────────────
$ElectronDir    = $PSScriptRoot
$StandaloneDir  = Join-Path $ProjectRoot ".next\standalone"
$StaticSrc      = Join-Path $ProjectRoot ".next\static"
$StaticDst      = Join-Path $StandaloneDir ".next\static"
$PublicSrc      = Join-Path $ProjectRoot "public"
$PublicDst      = Join-Path $StandaloneDir "public"

Write-Host "`n=== 1ONE 龙虾控制台 Electron 打包工具 ===" -ForegroundColor Cyan
Write-Host "项目根目录  : $ProjectRoot"
Write-Host "Electron 目录: $ElectronDir"

# ── Step 1：构建 Next.js ─────────────────────────────────────────────────────
if (-not $SkipNextBuild) {
  Write-Host "`n[1/5] 构建 Next.js standalone..." -ForegroundColor Yellow
  Push-Location $ProjectRoot
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build 失败（exit $LASTEXITCODE）" }
  } finally {
    Pop-Location
  }
} else {
  Write-Host "`n[1/5] 跳过 Next.js 构建（-SkipNextBuild）" -ForegroundColor DarkGray
}

# ── Step 2：验证 standalone ───────────────────────────────────────────────────
Write-Host "`n[2/5] 验证 standalone..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $StandaloneDir "server.js"))) {
  throw "未找到 $StandaloneDir\server.js。请先运行 npm run build 或去掉 -SkipNextBuild。"
}
Write-Host "  server.js 存在 ✓"

# ── Step 3：同步静态资源（.next/static 和 public/）──────────────────────────
Write-Host "`n[3/5] 同步静态资源..." -ForegroundColor Yellow

Write-Host "  复制 .next/static → standalone/.next/static"
if (Test-Path $StaticSrc) {
  if (-not (Test-Path $StaticDst)) { New-Item -ItemType Directory -Force $StaticDst | Out-Null }
  Copy-Item "$StaticSrc\*" -Destination $StaticDst -Recurse -Force
  Write-Host "  .next/static 已同步 ✓"
} else {
  Write-Warning "  .next/static 不存在，跳过（静态资源可能加载失败）"
}

Write-Host "  复制 public/ → standalone/public/"
if (Test-Path $PublicSrc) {
  if (-not (Test-Path $PublicDst)) { New-Item -ItemType Directory -Force $PublicDst | Out-Null }
  Copy-Item "$PublicSrc\*" -Destination $PublicDst -Recurse -Force
  Write-Host "  public/ 已同步 ✓"
} else {
  Write-Warning "  public/ 不存在，跳过"
}

# ── Step 4：安装 Electron 依赖 ────────────────────────────────────────────────
Write-Host "`n[4/5] 安装 Electron 依赖..." -ForegroundColor Yellow
Push-Location $ElectronDir
try {
  if (-not (Test-Path "node_modules\electron")) {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install 失败（electron dir）" }
  } else {
    Write-Host "  node_modules 已存在，跳过 npm install（如需更新请手动删除 node_modules）"
  }
} finally {
  Pop-Location
}

# ── Step 5：构建 EXE（保留历史产物） ─────────────────────────────────────────
Write-Host "`n[5/5] 构建 NSIS 安装包（保留历史版本）..." -ForegroundColor Yellow

$distDir = Join-Path $ElectronDir "dist"
$iconPath = Join-Path $ElectronDir "build\icon.ico"
if (-not (Test-Path $iconPath)) {
  Write-Warning "  build\icon.ico 不存在，将使用 Electron 默认图标。"
  Write-Warning "  建议：把 256x256 的 PNG 转换成 .ico 放到 packaging\electron\build\icon.ico"
}

Push-Location $ElectronDir
try {
  & npx electron-builder --config electron-builder.config.js
  if ($LASTEXITCODE -ne 0) { throw "electron-builder 失败（exit $LASTEXITCODE）" }
} finally {
  Pop-Location
}

# ── Step 6：统一归档到固定目录（版本号 + 时间戳）─────────────────────────────
$releaseDir = Join-Path $ElectronDir "dist\releases"
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Force $releaseDir | Out-Null }

$pkgJsonPath = Join-Path $ElectronDir "package.json"
$pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
$pkgVersion = [string]$pkg.version
if ([string]::IsNullOrWhiteSpace($pkgVersion)) { $pkgVersion = "0.0.0" }

$builtExes = @()
if (Test-Path $distDir) {
  $builtExes = Get-ChildItem $distDir -Filter "*.exe" -File | Sort-Object LastWriteTime -Descending
}

if ($builtExes.Count -eq 0) {
  Write-Warning "未在 dist/ 下找到 .exe，跳过归档。"
} else {
  foreach ($exe in $builtExes) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $safeBaseName = ($exe.BaseName -replace '[^a-zA-Z0-9._-]', '_')
    $archiveName = "$safeBaseName-v$pkgVersion-$stamp$($exe.Extension)"
    $archivePath = Join-Path $releaseDir $archiveName
    Copy-Item $exe.FullName -Destination $archivePath -Force
    Write-Host "  归档：$archivePath" -ForegroundColor DarkCyan
  }
}

Write-Host "`n=== 构建完成 ✓ ===" -ForegroundColor Green
if (Test-Path $releaseDir) {
  Get-ChildItem $releaseDir -Filter "*.exe" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    Write-Host "  输出：$($_.FullName)  ($([math]::Round($_.Length/1MB,1)) MB)" -ForegroundColor Cyan
  }
}
Write-Host ""
Write-Host "统一输出目录：packaging\electron\dist\releases"
Write-Host "下一步：把 releases\*.exe 复制到目标机器双击安装，安装完毕后自动启动控制台窗口。"
