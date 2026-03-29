# 1ONE 龙虾控制台 — Electron 桌面版打包

## 原理

```
Electron (主进程)
  └─ utilityProcess.fork(standalone/server.js)   ← Node.js 进程，运行 Next.js HTTP 服务
        │  port 3003
        └─ BrowserWindow.loadURL("http://127.0.0.1:3003/setup")
```

- **无需用户单独安装 Node.js** —— Electron 自带 Node.js 运行时，通过 `utilityProcess` 直接跑 Next.js standalone。  
- **无 PowerShell 依赖** —— 完全绕过旧方案的 `.cmd → .ps1 → Start-Process` 链，消除执行策略失败风险。  
- **一键 NSIS 安装** —— 与 LobsterAI / WorkBuddy 相同打包方式，用户级安装无需管理员。

## 目录结构

```
packaging/electron/
├── main.js                  # Electron 主进程
├── preload.js               # 渲染进程安全隔离
├── loading.html             # 启动等待动画
├── package.json             # electron + electron-builder 依赖
├── electron-builder.config.js
├── build-electron.ps1       # 一键构建脚本
└── build/
    └── icon.ico             # 应用图标（需手动放置，见下）
```

## 快速构建

```powershell
cd packaging\electron
.\build-electron.ps1
# 产物在 packaging\electron\dist\*.exe
```

已有最新 standalone 时跳过 Next.js 构建（更快）：
```powershell
.\build-electron.ps1 -SkipNextBuild
```

## 图标（可选但推荐）

将 256×256 PNG 转为 `.ico` 文件，放到：
```
packaging/electron/build/icon.ico
```
可使用在线工具 [favicon.io](https://favicon.io/favicon-converter/) 或 ImageMagick：
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
