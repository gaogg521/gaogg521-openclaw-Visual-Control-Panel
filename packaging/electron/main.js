'use strict';

/**
 * ONE Claw 龙虾可视化控制台 — Electron 主进程
 *
 * 工作模式：
 *  1. 首次启动（或传入 --open-setup 参数）→ 等待 Next.js 就绪后用系统默认
 *     浏览器打开 /setup 完成初始化。
 *  2. 后续点击桌面/开始菜单快捷方式 → 默认打开 /setup，确保先走初始化体验。
 *  3. 系统托盘常驻，右键菜单可打开/退出。
 *  4. 单实例锁定：重复启动时聚焦已有实例。
 */

const { app, Tray, Menu, shell, utilityProcess, ipcMain, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const fs   = require('fs');

// ── 配置 ─────────────────────────────────────────────────────────────────────
const PORT     = parseInt(process.env.LOBSTER_PORT || '3003', 10);
const HOSTNAME = '127.0.0.1';
const BASE_URL = `http://${HOSTNAME}:${PORT}`;

// ── 全局状态 ──────────────────────────────────────────────────────────────────
let tray       = null;
let serverProc = null;
let serverReady = false;
let lastOpenUrl = '';
let lastOpenAt = 0;
let logDirPath = '';
let logFilePath = '';

// ── 单实例锁 ──────────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // 已有实例运行：不重复弹浏览器，直接退出
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  // 重复启动时仅在明确传参时打开 setup；否则静默忽略，避免反复弹窗
  if (argv && argv.includes('--open-setup')) {
    openInBrowser(`${BASE_URL}/setup`);
  }
});

// ── 路径辅助 ─────────────────────────────────────────────────────────────────
function getStandaloneDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '../../.next/standalone');
}

function getIconPath() {
  return path.join(__dirname, 'build', 'icon.ico');
}

function initLogPaths() {
  try {
    logDirPath = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDirPath, { recursive: true });
    const now = new Date();
    const stamp =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
      `_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    logFilePath = path.join(logDirPath, `oneclaw-electron-${stamp}.log`);
  } catch (e) {
    console.error('[ONE Claw] init logs path failed:', e);
  }
}

function appendLog(line) {
  if (!logFilePath) return;
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${ts}] ${line}\n`, 'utf8');
  } catch {}
}

function openLogsDir() {
  if (!logDirPath) return;
  shell.openPath(logDirPath).catch(err => {
    console.error('[ONE Claw] open log dir error:', err);
  });
}

// ── 启动 Next.js 服务（utilityProcess 独立沙箱） ────────────────────────────
function startNextServer() {
  const standaloneDir = getStandaloneDir();
  const serverJs      = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(serverJs)) {
    console.error('[ONE Claw] standalone/server.js not found:', serverJs);
    appendLog(`[FATAL] standalone/server.js not found: ${serverJs}`);
    return;
  }

  serverProc = utilityProcess.fork(serverJs, [], {
    env: {
      ...process.env,
      PORT:     String(PORT),
      HOSTNAME,
      NODE_ENV: 'production',
    },
    cwd:   standaloneDir,
    stdio: 'pipe',
  });

  appendLog(`[BOOT] starting Next.js utility process: ${serverJs}`);
  if (serverProc.stdout) serverProc.stdout.on('data', d => {
    const s = String(d);
    process.stdout.write('[Next] ' + s);
    appendLog(`[Next] ${s.replace(/\r?\n$/, '')}`);
  });
  if (serverProc.stderr) serverProc.stderr.on('data', d => {
    const s = String(d);
    process.stderr.write('[Next:err] ' + s);
    appendLog(`[Next:err] ${s.replace(/\r?\n$/, '')}`);
  });
  serverProc.on('exit', code => {
    console.log(`[ONE Claw] Next.js server exited (code=${code})`);
    appendLog(`[EXIT] Next.js server exited (code=${code})`);
    serverProc  = null;
    serverReady = false;
  });
}

// ── 轮询等待服务就绪 ──────────────────────────────────────────────────────────
function waitForServer(maxRetries = 90, intervalMs = 800) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const probe = () => {
      const req = http.get(BASE_URL, res => { res.resume(); resolve(); });
      req.setTimeout(700, () => req.destroy());
      req.on('error', () => {
        if (++attempts >= maxRetries) reject(new Error('Server startup timeout'));
        else setTimeout(probe, intervalMs);
      });
    };
    probe();
  });
}

// ── 打开浏览器 ────────────────────────────────────────────────────────────────
function openInBrowser(url, force = false) {
  const now = Date.now();
  const sameUrl = lastOpenUrl === url;
  const tooSoon = now - lastOpenAt < 8000;
  if (!force && sameUrl && tooSoon) {
    return;
  }
  lastOpenUrl = url;
  lastOpenAt = now;
  shell.openExternal(url).catch(err => console.error('[ONE Claw] openExternal error:', err));
}

// ── 托盘菜单 ─────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label:   serverReady ? 'ONE Claw 运行中' : '正在启动服务…',
      enabled: false,
    },
    { type: 'separator' },
    {
      label:   '打开控制台',
      click:   () => openInBrowser(BASE_URL),
      enabled: serverReady,
    },
    {
      label:   '初始化向导 (/setup)',
      click:   () => openInBrowser(`${BASE_URL}/setup`),
      enabled: serverReady,
    },
    {
      label: '打开日志目录',
      click: () => openLogsDir(),
      enabled: Boolean(logDirPath),
    },
    { type: 'separator' },
    {
      label: '退出 ONE Claw',
      click: () => {
        if (serverProc) { serverProc.kill(); serverProc = null; }
        app.quit();
      },
    },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('ONE Claw 龙虾可视化控制台');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (serverReady) openInBrowser(BASE_URL);
  });
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!gotLock) return;
  // 不出现在 Dock（macOS）或任务栏
  if (app.dock) app.dock.hide();

  initLogPaths();
  appendLog('[APP] Electron app ready');
  createTray();

  // 默认自动打开 /setup；仅显式传 --open-home 时打开首页
  const openSetup = !process.argv.includes('--open-home');
  const shouldAutoOpen = true;

  startNextServer();
  tray.setToolTip('ONE Claw — 正在启动…');
  let startupOk = false;

  try {
    await waitForServer();
    startupOk = true;
  } catch (err) {
    console.error('[ONE Claw]', err.message);
    appendLog(`[ERROR] waitForServer failed: ${err.message}`);
    tray.setToolTip('ONE Claw — 服务启动超时');
  }

  serverReady = startupOk;
  tray.setToolTip(
    startupOk
      ? 'ONE Claw 龙虾可视化控制台 — 运行中'
      : 'ONE Claw 龙虾可视化控制台 — 启动失败（请查看日志）'
  );
  refreshTray();

  if (shouldAutoOpen && startupOk) {
    // 默认打开 /setup（初始化向导）；传 --open-home 时打开首页
    openInBrowser(openSetup ? `${BASE_URL}/setup` : BASE_URL, true);
  }
});

app.on('window-all-closed', () => {
  // 托盘模式：不因所有窗口关闭而退出
});

app.on('before-quit', () => {
  appendLog('[APP] before-quit');
  if (serverProc) { serverProc.kill(); serverProc = null; }
});
