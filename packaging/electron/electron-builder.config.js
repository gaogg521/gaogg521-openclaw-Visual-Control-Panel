'use strict';

const fs = require('fs');
const path = require('path');

const buildRes = path.join(__dirname, 'build');
function exists(name) {
  return fs.existsSync(path.join(buildRes, name));
}

/** macOS / Linux 打包优先 .icns / .png；Windows 仍用 .ico（见 win.icon） */
const iconMac = exists('icon.icns') ? 'build/icon.icns' : exists('icon.png') ? 'build/icon.png' : undefined;
const iconLinux = exists('icon.png') ? 'build/icon.png' : undefined;

/**
 * electron-builder 配置 — ONE Claw 龙虾可视化控制台
 * - Windows：多步 NSIS（参考 WorkBuddy）
 * - macOS：dmg + zip（须在 macOS 上构建）；安装后行为与 Windows 一致（托盘 + 浏览器）
 * - Linux：AppImage（须在 Linux 上构建）
 */
module.exports = {
  appId:         'com.openclaw.lobster.dashboard',
  productName:   'ONE Claw 龙虾控制台',
  copyright:     'Copyright © 2026 1ONE',

  // ── 打包文件 ──────────────────────────────────────────────────────────────
  files: [
    'main.js',
    'preload.js',
    'loading.html',
    'package.json',
    'build/**/*',
  ],

  // ── Next.js standalone 打包为 resources/standalone ────────────────────────
  extraResources: [
    {
      from:   '../../.next/standalone',
      to:     'standalone',
      filter: [
        '**/*',
        '!**/*.map',
        '!packaging/**',
        '!docs/**',
        '!prd/**',
        '!scripts/**',
        '!**/*.ts',
        '!**/*.tsx',
        '!**/.git/**',
        '!**/node_modules/.cache/**',
        '!**/*.md',
      ],
    },
  ],

  // ── Windows ────────────────────────────────────────────────────────────────
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    ...(exists('icon.ico') ? { icon: 'build/icon.ico' } : {}),
    signingHashAlgorithms: null,
    sign:   null,
  },

  // ── macOS（仅能在 darwin 上产出；未放 icon 时使用 Electron 默认图标）────────
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: false,
    identity: null,
    ...(iconMac ? { icon: iconMac } : {}),
  },

  dmg: {
    title: '${productName} ${version}',
  },

  // ── Linux（AppImage；建议在 Ubuntu 等环境构建）──────────────────────────────
  linux: {
    target: ['AppImage'],
    category: 'Utility',
    maintainer: '1ONE',
    ...(iconLinux ? { icon: iconLinux } : {}),
  },

  // ── NSIS 多步向导（WorkBuddy 风格） ───────────────────────────────────────
  nsis: {
    // ---- 向导模式（非一键静默）----
    oneClick:                           false,
    perMachine:                         false,
    allowElevation:                     false,
    allowToChangeInstallationDirectory: true,

    // ---- 快捷方式 ----
    createDesktopShortcut:    true,
    createStartMenuShortcut:  true,
    shortcutName:             'ONE Claw 龙虾控制台',
    uninstallDisplayName:     'ONE Claw 龙虾可视化控制台',

    // ---- 品牌图片（164×314 sidebar + 150×57 header）----
    installerSidebar:  'build/sidebar.bmp',
    uninstallerSidebar:'build/sidebar.bmp',
    installerHeader:   'build/banner.bmp',

    // ---- 图标（无 icon.ico 时省略，避免 NSIS 报错）----
    ...(exists('icon.ico')
      ? { installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico' }
      : {}),

    // ---- 许可协议页 ----
    license:          'build/license.txt',

    // ---- 安装完成后：选中「立即运行」启动 Electron（Electron 内部会打开浏览器） ----
    runAfterFinish:   true,

    // ---- 自定义 NSIS 脚本片段：向安装界面添加中文提示 ----
    include: 'build/installer.nsh',
  },

  // ── 输出目录 ───────────────────────────────────────────────────────────────
  directories: {
    output:         'dist',
    buildResources: 'build',
  },

  publish: null,

  // 更新文件是否生成（安装包交付不依赖这些文件）
  // 注意：Windows 下 .exe 另由 build-electron.js 归档到 dist/releases
  generateUpdatesFilesForAllChannels: false,
};
