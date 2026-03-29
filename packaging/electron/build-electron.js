#!/usr/bin/env node
'use strict';

/**
 * 跨平台 Electron 打包入口（与 build-electron.ps1 步骤一致）。
 * - 默认按当前 OS 构建：win → NSIS，darwin → dmg，linux → AppImage
 * - 显式指定：node build-electron.js -- --mac | --win | --linux
 *
 * 注意：Next standalone 内含 better-sqlite3 等原生模块，须在「目标平台或同架构」
 * 上先执行 npm run build，再打包 Electron（勿在 Windows 上构建的 standalone 直接打进 Mac 包）。
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electronDir = __dirname;
const projectRoot = path.resolve(electronDir, '../..');
const skipNext = process.argv.includes('--skip-next-build') || process.argv.includes('-SkipNextBuild');

function log(msg, c) {
  const colors = { y: '\x1b[33m', c: '\x1b[36m', g: '\x1b[32m', d: '\x1b[90m', x: '\x1b[0m' };
  const p = c && colors[c] ? colors[c] : '';
  console.log(p + msg + (c ? colors.x : ''));
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} 失败 (exit ${r.status})`);
  }
}

function syncStandaloneAssets() {
  const standaloneDir = path.join(projectRoot, '.next', 'standalone');
  const serverJs = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(`未找到 ${serverJs}。请先 npm run build 或去掉 --skip-next-build`);
  }
  log('  server.js ✓', 'g');

  const staticSrc = path.join(projectRoot, '.next', 'static');
  const staticDst = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDst), { recursive: true });
    fs.cpSync(staticSrc, staticDst, { recursive: true, force: true });
    log('  .next/static → standalone/.next/static ✓', 'g');
  } else log('  警告: .next/static 不存在', 'y');

  const publicSrc = path.join(projectRoot, 'public');
  const publicDst = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDst, { recursive: true, force: true });
    log('  public/ → standalone/public ✓', 'g');
  } else log('  警告: public/ 不存在', 'y');
}

function ensureElectronDeps() {
  const nm = path.join(electronDir, 'node_modules', 'electron');
  if (fs.existsSync(nm)) {
    log('  Electron 依赖已存在', 'd');
    return;
  }
  log('\n[4/5] npm install (packaging/electron)...', 'y');
  run('npm', ['install'], { cwd: electronDir });
}

function builderArgs() {
  const dash = process.argv.indexOf('--');
  let pass = dash >= 0 ? process.argv.slice(dash + 1) : [];
  pass = pass.filter((a) => a !== '--skip-next-build' && a !== '-SkipNextBuild');
  if (pass.length) return pass;

  switch (process.platform) {
    case 'win32':
      return ['--win'];
    case 'darwin':
      return ['--mac'];
    case 'linux':
      return ['--linux'];
    default:
      throw new Error(`不支持的平台: ${process.platform}，请使用 node build-electron.js -- --mac|--win|--linux`);
  }
}

function archiveWindowsExeIfAny() {
  if (process.platform !== 'win32') return;

  const distDir = path.join(electronDir, 'dist');
  const releaseDir = path.join(distDir, 'releases');
  fs.mkdirSync(releaseDir, { recursive: true });

  const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const ver = pkg.version || '0.0.0';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (!fs.existsSync(distDir)) return;
  const exes = fs.readdirSync(distDir).filter((f) => f.endsWith('.exe'));
  for (const f of exes) {
    const base = f.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dest = path.join(releaseDir, `${base}-v${ver}-${stamp}.exe`);
    fs.copyFileSync(path.join(distDir, f), dest);
    log(`  归档: ${dest}`, 'c');
  }
}

function main() {
  log('\n=== 1ONE 龙虾控制台 Electron 打包（跨平台）===', 'c');
  log(`项目根: ${projectRoot}`, 'd');
  log(`Electron: ${electronDir}`, 'd');

  if (!skipNext) {
    log('\n[1/5] Next.js build (standalone)...', 'y');
    run('npm', ['run', 'build'], { cwd: projectRoot });
  } else {
    log('\n[1/5] 跳过 Next 构建 (--skip-next-build)', 'd');
  }

  log('\n[2–3/5] 校验 standalone 并同步静态资源...', 'y');
  syncStandaloneAssets();

  log('\n[4/5] Electron 依赖...', 'y');
  ensureElectronDeps();

  const args = builderArgs();
  log(`\n[5/5] electron-builder ${args.join(' ')} ...`, 'y');
  run('npx', ['electron-builder', '--config', 'electron-builder.config.js', ...args], { cwd: electronDir });

  archiveWindowsExeIfAny();

  log('\n=== 构建完成 ✓ ===', 'g');
  log(`产物目录: ${path.join(electronDir, 'dist')}`, 'c');
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
