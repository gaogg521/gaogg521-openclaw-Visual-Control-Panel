#Requires -Version 5.1
# 安装完成后：若 3003 已有服务则直接打开 /setup；否则尝试启动 {app}\standalone\server.js 再打开。
param(
  [int]$Port = 3003,
  [int]$WaitSeconds = 45
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$LauncherDir = $PSScriptRoot
$AppDir = Split-Path $LauncherDir -Parent
$StandaloneJs = Join-Path $AppDir "standalone\server.js"
$CheckPortScript = Join-Path $AppDir "scripts\check-lobster-port.ps1"

function Test-LobsterHttp {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Open-SetupPage {
  Start-Process "http://127.0.0.1:$Port/setup"
}

if (Test-LobsterHttp) {
  Open-SetupPage
  exit 0
}

if (-not (Test-Path -LiteralPath $StandaloneJs)) {
  [void][System.Windows.Forms.MessageBox]::Show(
    "未检测到内置控制台（standalone）。`n`n请先在本机项目目录运行： npm run dev `n或自行将 next standalone 复制到安装目录下的 standalone 文件夹后再点快捷方式。`n`n仍将尝试打开浏览器（若未启动服务会无法连接）。",
    "ONE CLAW OneClick",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  )
  Open-SetupPage
  exit 0
}

if (Test-Path -LiteralPath $CheckPortScript) {
  $chk = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $CheckPortScript, "-Port", "$Port"
  ) -Wait -PassThru -WindowStyle Hidden
  if ($chk.ExitCode -eq 30) {
    [void][System.Windows.Forms.MessageBox]::Show(
      "端口 $Port 已被占用。请关闭占用程序或设置环境变量 LOBSTER_PORT 与 OPENCLAW_ONECLICK_ALLOW_BUSY_LOBSTER=1 后重试。",
      "ONE CLAW OneClick",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 30
  }
}

$bundledNode = Join-Path $AppDir "tools\node\node.exe"
if (Test-Path -LiteralPath $bundledNode) {
  $nodeLaunch = $bundledNode
} else {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    [void][System.Windows.Forms.MessageBox]::Show(
      "未找到 Node。若已安装完整包，请确认 tools\node 存在；否则请安装 Node.js LTS 或使用 npm run dev。",
      "ONE CLAW OneClick",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    Open-SetupPage
    exit 1
  }
  $nodeLaunch = $nodeCmd.Source
}

$standaloneDir = Split-Path $StandaloneJs -Parent
$env:PORT = "$Port"
$env:HOSTNAME = "0.0.0.0"
$env:NODE_ENV = "production"
Start-Process -FilePath $nodeLaunch -ArgumentList "server.js" -WorkingDirectory $standaloneDir -WindowStyle Minimized

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 1
  if (Test-LobsterHttp) { break }
}

if (-not (Test-LobsterHttp)) {
  [void][System.Windows.Forms.MessageBox]::Show(
    "控制台未在 ${WaitSeconds}s 内就绪。请稍后手动访问 http://127.0.0.1:$Port/setup 或查看防火墙/日志。",
    "ONE CLAW OneClick",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  )
}

Open-SetupPage
exit 0
