'use strict';

/**
 * electron-builder 配置 — ONE Claw 龙虾可视化控制台
 * 多步向导式 NSIS 安装（参考 WorkBuddy 风格）
 * 安装完成后用系统默认浏览器打开 http://localhost:3003/setup 完成初始化
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
    icon:   'build/icon.ico',
    signingHashAlgorithms: null,
    sign:   null,
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

    // ---- 图标 ----
    installerIcon:    'build/icon.ico',
    uninstallerIcon:  'build/icon.ico',

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
  // 注意：历史 .exe 由 build-electron.ps1 统一归档到 dist/releases 保留
  generateUpdatesFilesForAllChannels: false,
};
