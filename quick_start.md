# 快速启动办法（中文）

**文档语言：** 主说明为 **[README.md](README.md)**（简体中文）。完整英文版（安装手册、Preview、API 说明等）见 **[README.en.md](README.en.md)**。

## 0. 指定 OpenClaw 目录（可选）

若 OpenClaw 不在默认的 `~/.openclaw`，在**本项目根目录**（`龙虾可视化控制面板` 文件夹）创建 `.env.local`，写入：

```env
OPENCLAW_HOME=C:/Users/你的用户名/.openclaw
```

（Windows 建议用正斜杠。可复制 `.env.example` 为 `.env.local` 后修改。）

- **写入配置 / 调 Gateway 报 `spawn openclaw ENOENT`**（常见于从 IDE 启动 `npm run dev`）：在 `.env.local` 配置 `OPENCLAW_CLI` 或 `OPENCLAW_MJS`，见 `.env.example`。
- **可选 MySQL 镜像**：配置 `MYSQL_HOST` 等，见 `.env.example`；不配也可完整使用仪表盘。

## 1. 仓库路径说明

完整 monorepo 克隆后，仪表盘在子目录 **`软件SOFT/龙虾可视化控制面板`**，请进入该目录再执行 `npm install` / `npm run dev`。

若你**只持有本文件夹**，则直接进入该目录即可。

## 2. 访问地址与界面说明

- 默认端口：**`3003`**（见 `package.json`）。
- 浏览器请优先使用 **http://localhost:3003** 或 **http://127.0.0.1:3003**。若用局域网地址 **http://192.168.x.x:3003** 打开，需在 `.env.local` 设置 **`CONFIG_ALLOW_LAN=1`**（见 `.env.example`），否则 Config 等 API 会返回 **`localhost-only`**。
- **生产模式**：`next.config` 为 **`output: "standalone"`**，应 **`npm run build` 后执行 `npm run start`**（会启动 `.next/standalone/server.js` 并同步 static/public）。不要单独使用 `next start -p 3003`（与 standalone 不匹配）。
- 生产启动可设环境变量 **`PORT`**（默认 3003）、**`HOSTNAME`**（默认 `0.0.0.0`）。
- 端口被占用：可执行 **`npm run stop`**（固定结束占用 **3003** 的监听进程）；或用 `netstat -ano | findstr :3003` 手动查 PID。其它端口：`node scripts/kill-port.mjs 4000`。
- **生产重启**：`npm run restart` — **固定释放 3003** 后再以 **`PORT=3003`** 拉起 standalone（需已 `npm run build`；不受本机其它 `PORT` 环境变量影响）。

```bash
npm run build
npm run start
```

- **语言**：侧栏可选 **简中 / 繁中 / English / 马来语 / 印尼语 / 泰语**（不仅是中英文）。
- **主题**：侧栏与首页共用 **五套皮肤**（深浅 + 科技蓝 + 暖橙 + 森绿），不仅是「深色/浅色」两种。
- **极简部署**：装好 `openclaw` 后，在浏览器打开 **`http://localhost:3003/setup`**，按三步向导填写厂商与 API Key（无需手改 env 文件）。

更完整的功能说明见根目录 **[README.md](README.md)**；英文读者请用 **[README.en.md](README.en.md)**。

## 3. 通过 Prompt 安装

```
在 OpenClaw 中输入如下提示词，让 OpenClaw 协助安装并启动：
请帮我安装并运行这个 GitHub 项目，并把服务访问地址发给我：https://github.com/gaogg521/Openclaw-SKILLS-OneOne-
```

（若对方克隆的是完整仓库，请提醒进入 `软件SOFT/龙虾可视化控制面板` 再 `npm run dev`，访问 **http://localhost:3003**。）

## 4. 通过 Git 安装

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

浏览器访问 **http://localhost:3003**。

## 5. 通过 Skill 安装

```
npx clawhub install openclaw-bot-dashboard
或者：npx skills add gaogg521/openclaw-bot-dashboard

安装后可通过这些关键词触发启动服务：
- "打开 OpenClaw-bot-review"
- "打开 Openclaw dashboard"
- "打开 bot review"
- "打开机器人大盘"
- "打开 bot-review"
- "打开openclaw机器人大盘"
- "open openclaw dashboard"
- "open OpenClaw-bot-review"
- "open openclaw dashboard"
- "launch bot review"
- "start dashboard"
```

---

# Quick Start (English)

## 0. Custom OpenClaw path (optional)

If OpenClaw is not in `~/.openclaw`, create `.env.local` in **this project root** (the `龙虾可视化控制面板` / dashboard folder) with:

```env
OPENCLAW_HOME=C:/Users/YourUsername/.openclaw
```

(Use forward slashes on Windows. Copy `.env.example` to `.env.local` and edit.)

- If **`spawn openclaw ENOENT`** when saving config or calling the Gateway from IDE-started `npm run dev`, set **`OPENCLAW_CLI`** or **`OPENCLAW_MJS`** in `.env.local` (see `.env.example`).
- **Optional MySQL** for sync/metrics: set `MYSQL_*` vars; the UI works without it.

## 1. Repository path

After cloning the full monorepo, the dashboard lives under **`软件SOFT/龙虾可视化控制面板`** — `cd` there before `npm install` / `npm run dev`.

If you **only have this folder**, stay in it and run the same commands.

## 2. URL & UI notes

- Default dev/port: **`3003`** (see `package.json`).
- Open **http://localhost:3003**
- **Languages**: sidebar offers **zh / zh-TW / en / ms / id / th** — not “Chinese vs English” only.
- **Themes**: **five skins** (dark, light, cyber blue, warm orange, forest green) — not only two modes.
- **Quick setup**: With `openclaw` installed, open **`http://localhost:3003/setup`** for a 3-step provider + API key wizard.

Full details: **[README.md](README.md)**.

## 3. Install via Prompt

```
In OpenClaw, send:
Please help me install and run this GitHub project, and send me the service URL: https://github.com/gaogg521/Openclaw-SKILLS-OneOne-
```

(If the repo is cloned fully, use folder `软件SOFT/龙虾可视化控制面板`, then `npm run dev` → **http://localhost:3003**.)

## 4. Install via Git

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

Open **http://localhost:3003** in your browser.

## 5. Install via Skill

```
npx clawhub install openclaw-bot-dashboard
or: npx skills add gaogg521/openclaw-bot-dashboard

After installation, use these trigger phrases to start the service:
- "打开 OpenClaw-bot-review"
- "打开 Openclaw dashboard"
- "打开 bot review"
- "打开机器人大盘"
- "打开 bot-review"
- "打开openclaw机器人大盘"
- "open openclaw dashboard"
- "open OpenClaw-bot-review"
- "open openclaw dashboard"
- "launch bot review"
- "start dashboard"
```
