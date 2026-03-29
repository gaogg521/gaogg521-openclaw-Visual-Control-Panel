# 1ONE 龙虾控制台 — Electron 桌面版打包

## 原理

```
Electron (主进程)
  └─ utilityProcess.fork(standalone/server.js)   ← Node.js 进程，运行 Next.js HTTP 服务
        │  port 3003
        └─ shell.openExternal → 三系统默认站点根（仪表盘）；--open-setup 可打开 /setup
```

- **无需用户单独安装 Node.js** —— Electron 自带 Node.js 运行时，通过 `utilityProcess` 直接跑 Next.js standalone。  
- **无 PowerShell 依赖** —— 完全绕过旧方案的 `.cmd → .ps1 → Start-Process` 链，消除执行策略失败风险。  
- **Windows：NSIS 安装** —— 用户级安装；**macOS / Linux**：dmg / AppImage 等；启动后默认页按 `main.js` 区分平台（见上）。

## 目录结构

```
packaging/electron/
├── main.js                  # Electron 主进程
├── preload.js               # 渲染进程安全隔离
├── loading.html             # 启动等待动画
├── package.json             # electron + electron-builder 依赖
├── electron-builder.config.js
├── build-electron.js        # 跨平台构建入口（推荐）
├── build-electron.ps1       # Windows 包装调用 build-electron.js
├── build-electron.sh        # macOS / Linux 包装
└── build/
    └── icon.ico             # 应用图标（需手动放置，见下）
```

## 快速构建（三系统）

主入口为跨平台的 **`build-electron.js`**（`npm run electron:dist` 从**项目根**调用）。**必须在目标操作系统上执行**（含 `npm run build`），以便 **better-sqlite3** 等原生模块与当前平台一致。

**Windows**

```powershell
cd <项目根目录>
npm run electron:dist
# 或 cd packaging\electron 后 .\build-electron.ps1
```

**macOS / Linux**

```bash
cd <项目根目录>
npm run electron:dist
# 或 cd packaging/electron && chmod +x build-electron.sh && ./build-electron.sh
```

- **Windows** 产物：**NSIS `.exe`**（`dist/`，可选归档 `dist/releases/`）  
- **macOS** 产物：**`.dmg`**、**`.zip`**（x64 / arm64）  
- **Linux** 产物：**AppImage**

已有最新 **`.next/standalone`** 时跳过 Next 构建：

```bash
npm run electron:dist:skip-next
# 或 node packaging/electron/build-electron.js --skip-next-build
```

显式指定 electron-builder 目标（一般不必）：

```bash
node packaging/electron/build-electron.js -- --win
node packaging/electron/build-electron.js -- --mac
node packaging/electron/build-electron.js -- --linux
```

## 图标（可选但推荐）

- **Windows / NSIS：** `packaging/electron/build/icon.ico`（多尺寸 `.ico`）  
- **macOS：** `icon.icns`，或 **`icon.png`**（约 512×512，electron-builder 可转换）  
- **Linux / 托盘：** `icon.png` 优先（`main.js` 在 Mac/Linux 托盘会优先找 `.icns` / `.png`）

生成 `.ico` 示例（ImageMagick）：
```bash
magick convert icon-256.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `LOBSTER_PORT` | `3003` | Next.js 监听端口（端口冲突时修改） |
| `OPENCLAW_HOME` | `~/.openclaw` | OpenClaw 数据目录 |

## 开发调试

```powershell
# 安装依赖
cd packaging\electron
npm install

# 直接运行（不打包）
npm start
```

此时会连接本机 `npm run dev`（port 3003）运行的 Next.js，方便调试 UI。
