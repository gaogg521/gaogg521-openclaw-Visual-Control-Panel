# OpenClaw Dashboard（English）

**1one Lobster Office** — a **full-stack local control plane** for [OpenClaw](https://github.com/openclaw/openclaw), built with [Next.js](https://nextjs.org/): not one screen, but a **coherent toolbox** of dashboards, labs, wizards, and visual surfaces that stay in sync with your real `openclaw.json`, agents, sessions, and gateway.

## Capability map — what ships in this repo

| Area | Tools & surfaces you get |
|------|---------------------------|
| **Operations & SRE-style views** | Home + **OneOne dashboard**, **Gateway health** polling, **streaming `openclaw gateway restart`**, **alerts** (rules + Feishu hooks), **token & latency stats** with charts, **auto-refresh** (manual → 10m). |
| **Agent work & “expert studio”** | **Agent Task Tracking** (subagents + cron from live `/api/agent-activity`), **Pixel Office** with **three** distinct game scenes (classic office, starship, grove), layout editor, heatmap, idle rank, gateway SRE mascot, **Expert squad** / **expert files** flows in the UI. |
| **Models & config lab** | **Models** page: who uses which model, **per-model probe**, **temporary API keys**, **internal gateway presets**, **add model → write `openclaw.json`** via API; documented JSON shape in **`docs/openclaw-models-config.md`**. |
| **Channels, sessions, chat** | **Channels** view, **Sessions** (DM / group / cron, tokens, connectivity tests), **Web `/chat`** against your gateway, **platform tests** (e.g. Feishu / Discord / DM flows). |
| **Skills & onboarding** | **Skills** browser (search/filter), **`/setup` wizard** (precheck CLI → provider → `openclaw onboard --non-interactive`). |
| **Global UX** | **Six UI languages** (zh / zh-TW / en / ms / id / th), **five themes** (not just light/dark), shared **ThemeSwitcher** + `localStorage`. |
| **Data & deploy** | **Filesystem-first** (no DB required); **optional MySQL** mirror + sync/metrics APIs; **Docker** standalone image; **packaging** under `packaging/openclaw-oneclick/` + Windows journey docs. |

If you only read one thing: this project is meant to be the **place you run OpenClaw day-to-day** — monitor, tune models, watch agents, play with Pixel Office, and operate the gateway — **without** abandoning the official CLI when you still need it.

## Background

When running multiple OpenClaw agents across different platforms (Feishu, Discord, etc.), managing and monitoring them becomes increasingly complex — which bot uses which model? Are the platforms connected? Is the gateway healthy? How are tokens being consumed?

The UI is driven by your **local OpenClaw tree** (`openclaw.json`, agents, sessions). **No MySQL is required** for day-to-day use. Optionally, you can enable **MySQL** to mirror config/agents/channels/sessions and inspect sync status (see **Optional MySQL (sync & metrics)** below).

Recent UX work includes **six UI languages** (with SEA packs in `lib/locales/`), **five visual themes** (not just dark/light), **three Pixel Office “game” scenes** (classic office, starship bridge, mushroom grove — each with its own map topology and atmosphere), and a richer **Models** page (who uses which model, probes, presets, add-to-config). Details below.

## Features

- **Home / Bot overview (`/`)** — Agent cards (model, platforms, session stats), gateway health, **same theme switcher as sidebar**, group-chat hints, **Agent Task Tracking** (subagents + cron jobs from `/api/agent-activity`; keeps the last “live” snapshot when everyone is idle/offline or the API returns an empty list)
- **OneOne dashboard (`/oneone-dashboard`)** — Compact dashboard variant with the same data family as home
- **Pixel Office (`/pixel-office`)** — Canvas “game” with **Classic / Starship / Grove** scenes, edit-save layout, optional critters, heatmap & idle rank, Gateway SRE character; see **Languages, themes, pixel worlds & live data**
- **Models (`/models`)** — Providers/models, **used-by agents**, context limits, per-model test, presets, **add model → config** after a successful probe; see **Languages, themes, pixel worlds & live data**
- **Channels (`/channels`)** — Channel-oriented view
- **Sessions (`/sessions`)** — Per-agent sessions (DM / group / cron), tokens, connectivity test
- **Statistics (`/stats`)** — Token usage and response-time trends (day/week/month) with SVG charts
- **Alerts (`/alerts`)** — Rules (e.g. model down, bot silent) with Feishu notifications
- **Skills (`/skills`)** — Installed skills with search/filter
- **Web Chat (`/chat`)** — Browser chat against your OpenClaw Gateway (not in the main sidebar; open by URL)
- **Gateway health** — Polling + link to OpenClaw web UI
- **Platform tests** — Feishu/Discord bindings and DM sessions
- **Auto refresh** — Manual, 10s, 30s, 1m, 5m, 10m

### Recent stability & UX updates (Mar 2026)

Polling and OpenClaw CLI usage were tightened so a slow `/api/agent-activity` or `/api/gateway-health` does **not** spawn **hundreds of `node` processes**: **serial client polling**, **single-flight** request coalescing on the server, **sequential** gateway RPCs (no parallel `openclaw` bursts), **`AbortController`** where early timeouts apply, and **`npm run dev` checks port 3003** via `scripts/check-dev-port.mjs` before starting Next. **Restart OneOneClaw** on `/oneone-dashboard` uses **streaming stdout/stderr** (terminal-like). Technical changelog: **[docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md)** (Chinese).

### Languages, themes, pixel worlds & live data

- **Internationalization** — Sidebar language selector: **简体中文**, **繁體中文**, **English**, **Bahasa Melayu**, **Bahasa Indonesia**, **ไทย**. Large zh / zh-TW / en tables live in `lib/i18n.tsx`; **ms / id / th** ship as `lib/locales/ms.json`, `id.json`, `th.json`. Missing keys **fall back** to English, then Simplified Chinese. Maintainers can run **`npm run i18n:merge-sea`** to merge SEA locale chunk files.

- **Themes (five skins)** — Not “Chinese vs English” and not only two modes: **dark (deep sea)**, **light (minimal)**, **cyber blue**, **warm orange**, and **forest green** — the same `ThemeSwitcher` as the home page, applied via **`data-theme`** on `<html>` and stored in **`localStorage`**.

- **Pixel Office — three game scenes** — **Classic office** (original pixel art + office floorplan), **Starship bridge** (ship topology, **starfield**, cyan frame / glow), **Mushroom grove** (forest topology, **walkable stream** tiles, green ambience). Implemented in `lib/pixel-office/layout/alternateLayouts.ts` and `gameThemes.ts`. The page supports **layout edit, undo/redo, save**, optional **“bugs”** critter overlay, **agent activity heatmap**, **slacking leaderboard**, **Gateway on-call SRE** character tied to health checks, HUD / nameplate polish, and **decorative floating code** while agents work. Layout file: **`$OPENCLAW_HOME/pixel-office/layout.json`**. After changing the art pipeline, run **`npm run generate-pixel-assets`** to regenerate sprites.

- **Models workspace** — Shows **which agents use each model**, **per-model test** (with optional **temporary API key**), **model-probe presets** for internal gateways, and **Add model** writing through **`/api/config/add-provider-model`** once the probe succeeds. JSON alignment is documented in **`docs/openclaw-models-config.md`**.

- **Live configuration** — The dashboard still reads **`openclaw.json`**, per-agent dirs, and session files under **`OPENCLAW_HOME`**. The UI does **not** need a database; **MySQL** is optional for sync/metrics only (see below).

## Main routes

| Path | Purpose |
|------|---------|
| `/` | Home — agents + task tracking |
| `/oneone-dashboard` | Alternate dashboard |
| `/pixel-office` | Pixel office / game-style scene |
| `/models` | Models & probes |
| `/channels` | Channels |
| `/sessions` | Sessions |
| `/stats` | Statistics |
| `/alerts` | Alerts |
| `/skills` | Skills |
| `/chat` | Gateway web chat |
| `/setup` | **Setup wizard** (precheck CLI → provider → credentials → confirm → done; calls `openclaw onboard --non-interactive`) |

API routes live under `app/api/` (e.g. `agent-activity`, `config`, `openclaw/*`, `pixel-office/*`, `storage/*`, `setup/onboard`).

### Windows installer UX (user-centric, Chinese)

If you ship a **Windows `.exe` / zip** bundle, see **[packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)** for two recommended flows: **classic setup wizard** vs **start local port 3003 first, then browser `/setup`**. It clarifies when `http://localhost:3003/setup` appears and how it relates to installing the `openclaw` CLI.

**Handoff / progress log (deploy wizard + Full installer, zh-CN):** **[docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)** — `OpenClawOneClick.Full.iss`, redist scripts, PATH helper, `FULL_INSTALL.md`, and suggested next steps. Same-day scratch notes: **[WORK_SESSION_2026-03-17.md](WORK_SESSION_2026-03-17.md)**.

## Preview

All screenshots below live in **[`docs/`](docs/)** (paths are relative to this README). Refresh these assets when the UI changes so the README stays current.

### Home & dashboards
![Bot dashboard](docs/bot_dashboard.png)
![Dashboard](docs/dashboard.png)
![Dashboard wide preview](docs/dashboard-preview.jpg)

### Models & sessions
![Models](docs/models-preview.png)
![Sessions](docs/sessions-preview.png)

### Pixel Office & game scenes
![Pixel Office](docs/pixel-office.png)
![Game scene — classic office](docs/游戏场景-办公室.png)
![Game scene — starship bridge](docs/游戏场景-星际剑桥.png)
![Game scene — mushroom grove](docs/游戏场景-蘑菇林地.png)

### Expert squad & expert files
![Expert squad](docs/专家战队.png)
![Expert files](docs/专家文件管理.png)
![Expert files (alternate)](docs/专家文件管理1.png)

### Themes & locales (5 themes · 6 UI languages)
![Theme switching](docs/主题变化.png)
![Traditional Chinese UI](docs/繁体.png)
![Malay UI](docs/马来语.png)
![Indonesian UI](docs/印尼语.png)
![Thai UI](docs/泰语.png)

### Alerts, model switch, stats, channels
![Alert center](docs/告警中心.png)
![Model switch](docs/模型切换.png)
![Message statistics](docs/消息统计.png)
![Channel management](docs/通道管理.png)

### Setup wizard (minimal install / 极简安装)
![Setup wizard overview](docs/极简的安装.png)
![Setup wizard step 2](docs/极简安装2.png)
![Setup wizard step 3](docs/极简安装3.png)
![Setup wizard step 4](docs/极简安装4.png)

### Docs in `docs/` (text)
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows packaging / installer handoff (zh-CN)  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — `models.providers` alignment with the dashboard  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — stability & polling / OpenClaw CLI notes

## Getting Started

### Fastest paths (pick one)

1. **Windows `.exe` (end users — no separate Node install)** — Run **`ONE Claw … Setup ….exe`** from your release, or build it with [`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1) (output: [`packaging/electron/dist/`](packaging/electron/)). After install, Electron starts the bundled Next server on **3003** and opens the browser (typically **`/setup`**). How it works: [`packaging/electron/README.md`](packaging/electron/README.md).
2. **From source (developers)** — Clone this folder → `npm install` → `npm run dev` → open **http://localhost:3003** (commands below). If your OpenClaw tree is not `~/.openclaw`, set **`OPENCLAW_HOME`** in `.env.local` (see **Configuration**).
3. **OpenClaw onboarding only** — With the dashboard already running, open **http://localhost:3003/setup** and finish the wizard (CLI precheck → provider → credentials → `openclaw onboard`).

For **install order** on Windows (classic installer vs “start port 3003 first, then `/setup`”), read **[`packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)** (Chinese; still useful for English readers planning Windows rollouts).

**macOS / Linux (e.g. Ubuntu):** use **from source** (path 2) or **Docker** below. Install **Node.js 18+** (on Ubuntu, distro `nodejs` packages are often too old — prefer [nvm](https://github.com/nvm-sh/nvm) or [NodeSource](https://github.com/nodesource/distributions)), then the same `npm install` / `npm run dev` flow as on Windows. The **`.exe`** installer is **Windows-only**. [`electron-builder.config.js`](packaging/electron/electron-builder.config.js) targets **NSIS on Windows** only — no **`.dmg`** (macOS) or **AppImage / `.deb`** (Linux) is built here unless you add `mac` / `linux` targets.

See [Quick Start Guide](quick_start.md) for prompt / git / skill install options.

This app lives under the monorepo folder **`软件SOFT/龙虾可视化控制面板`**. After cloning [Openclaw-SKILLS-OneOne-](https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git):

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

- **Dev / local production** (`npm run dev` / `npm run start`) uses **port `3003`** (see `package.json`).
- **`npm run dev`** runs **`node scripts/check-dev-port.mjs`** first: if **3003** is already in use, the command exits — stop the old Next.js process before starting another.
- Open **http://localhost:3003** in your browser.

Other scripts:

- `npm run build` — production build  
- `npm run start` — serve production build on port **3003**  
- `npm run generate-pixel-assets` — regenerate pixel-office asset sprites  
- `npm run i18n:merge-sea` — merge SEA locale chunks (maintainers)

### One-click installer (OpenClaw + Lobster)

Experimental packaging lives in **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)**: official **silent** `install.sh` / `install.ps1`, **skip reinstall if `openclaw` is already on PATH**, **gateway / lobster port conflict checks**, `openclaw onboard --non-interactive` via `config/wizard.env`, then open **OpenClaw Web** and **`http://localhost:3003/oneone-dashboard`**. See also the community desktop app **[OneClaw](https://github.com/oneclaw/oneclaw)** for a comparable “conflict detection” UX. Full **DMG/EXE** still needs bundling **Node 22** + Inno / macOS pkg (`windows/OpenClawOneClick.iss`).

Run **`npm run packaging:prepare-standalone`** (runs `next build` + copies `.next/static` and `public` into `.next/standalone`) for portable **`node server.js`**.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript  
- **Tailwind CSS v4**  
- Primary data: filesystem + `openclaw.json` under `OPENCLAW_HOME`  
- **Optional:** `mysql2` — sync/metrics APIs if MySQL is configured (`.env.example`)

## Requirements

- Node.js 18+
- OpenClaw installed with config at `~/.openclaw/openclaw.json`

## Configuration

By default, the dashboard reads config from `~/.openclaw/openclaw.json`. That file must be **strict JSON** (OpenClaw uses `JSON.parse`): **no** `//` or `/* */` comments and **no** trailing commas. The dashboard’s save path uses `JSON.stringify` and never injects comments.

To use a custom path:

- **Option A**: Create `.env.local` in the project root (recommended):
  ```env
  OPENCLAW_HOME=C:/Users/YourUsername/.openclaw
  ```
  (Use forward slashes on Windows. See `.env.example`.)

- **OpenClaw CLI path** (needed for **Save to config** / Gateway `config.patch` when your IDE’s `npm run dev` does not inherit npm global `PATH` on Windows): set `OPENCLAW_CLI` in `.env.local`, e.g. `C:/Users/You/AppData/Roaming/npm/openclaw.cmd`. See `.env.example`.

- **Models JSON shape** (`models.providers`, merge with `agents/*/agent/models.json`, `agents.defaults.models` aliases): see **[docs/openclaw-models-config.md](docs/openclaw-models-config.md)** (no secrets; describes how the dashboard aligns writes with typical `openclaw.json`).

- **Option B**: Set the environment variable when running:
  ```bash
  # Linux/macOS
  OPENCLAW_HOME=/opt/openclaw npm run dev
  # Windows PowerShell
  $env:OPENCLAW_HOME="C:\Users\YourUsername\.openclaw"; npm run dev
  ```

### Model probe presets (internal gateways)

To test with a JSON-defined **base URL + protocol + key** (same idea as an internal “chat debug” console) and your **model id**:

1. Copy `model-probe-presets.example.json` to `model-probe-presets.json` in the **project root** or **`$OPENCLAW_HOME`**, or add a `modelProbePresets.presets` array in `openclaw.json`.
2. On the **Models** page, pick a preset, then use **Test** on a row (or test inside **Add model**). Optional **temporary API key** overrides the preset key for that request only.

Supported `protocol` values: `anthropic`, `openai`. (`gemini` is not supported for direct probe yet.)

### Optional MySQL (sync & metrics)

Optional **mirror** of OpenClaw config/agents/channels/sessions into MySQL (tables are created on sync: `oc_*`). Configure in `.env.local` (see `.env.example`): `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` (default DB name `openclaw_visualization`).

- `POST /api/storage/sync` — run sync  
- `GET /api/storage/sync` — latest sync run status  
- `GET /api/storage/metrics` — row counts / storage-oriented metrics  

The rest of the dashboard does **not** depend on MySQL.

## Docker Deployment

The **Dockerfile** runs the Next **standalone** server with **`PORT=3000`** inside the container (unlike `npm run dev`, which uses **3003** on the host).

### Build Docker Image

```bash
cd 软件SOFT/龙虾可视化控制面板   # or your checkout root containing this folder
docker build -t openclaw-dashboard .
```

### Run Container

```bash
# Basic run (host 3000 -> container 3000)
docker run -d -p 3000:3000 openclaw-dashboard

# With custom OpenClaw config path
docker run -d --name openclaw-dashboard -p 3000:3000 -e OPENCLAW_HOME=/opt/openclaw -v /path/to/openclaw:/opt/openclaw openclaw-dashboard
```

---

# OpenClaw Bot Dashboard（中文）

**1one 龙虾办公室** — 面向 [OpenClaw](https://github.com/openclaw/openclaw) 的 **本地优先一体化控制台**（[Next.js](https://nextjs.org/)）：不是单一页面，而是一套 **互相打通的工具矩阵**——仪表盘、模型实验台、极简安装、像素化「专家工作室」、会话与通道、告警与统计等，全部对齐你本机的 **`openclaw.json`、Agent 目录、会话文件与 Gateway**。

## 能力总览 — 这套系统里有什么

| 维度 | 内置能力与页面 |
|------|----------------|
| **运维与可观测** | 首页 + **OneOne 仪表盘**、**Gateway 健康**轮询、**流式重启 OpenClaw**（接近终端输出）、**告警中心**（规则 + 飞书）、**消息统计**（Token / 响应时间趋势图）、**自动刷新**（手动～10 分钟多档）。 |
| **Agent 工作与专家向体验** | **Agent 任务追踪**（子任务 + 定时任务，联动 `/api/agent-activity`）、**像素办公室** 三套独立场景（经典写字楼 / 星际舰桥 / 蘑菇林地）、布局编辑与保存、热力图与摸鱼榜、Gateway **值班 SRE** 小人、**专家战队** 与 **专家文件管理** 等界面能力。 |
| **模型与配置实验台** | **模型页**：谁在用哪张卡、**单模型探测**、**临时 Key**、**内网探测预设**、探测通过后 **写入 `openclaw.json`**；字段说明见 **`docs/openclaw-models-config.md`**。 |
| **通道、会话与对话** | **通道管理**、**会话**（私聊/群聊/定时、Token、连通性测试）、浏览器 **网页对话 `/chat`**、**平台一键测试**（飞书 / Discord / DM 等场景）。 |
| **技能与上线** | **技能**列表检索、**`/setup` 极简向导**（CLI 预检 → 选厂商与 Key → 后台 `openclaw onboard`）。 |
| **全球化体验** | **六种界面语言**（简/繁/英/马来/印尼/泰）、**五套全局主题**（非仅深浅色）、侧栏统一 **ThemeSwitcher** + 本地持久化。 |
| **数据与交付** | **默认零数据库**即可完整使用；可选 **MySQL 镜像**与同步/指标接口；**Docker** 独立镜像；**`packaging/openclaw-oneclick/`** 下一键安装与 **Windows 用户路径**文档。 |

一句话：**把 OpenClaw 的日常运维、排障、玩界面、改模型配置** 尽量收进 **一个 3003 端口里的工具箱**；需要时仍可与官方 **CLI** 配合使用。

## 背景

当你在多个平台（飞书、Discord 等）上运行多个 OpenClaw Agent 时，管理和监控会变得越来越复杂——哪个机器人用了哪个模型？平台连通性如何？Gateway 是否正常？Token 消耗了多少？

界面数据主要来自本机 **OpenClaw 目录**（`openclaw.json`、agents、sessions 等）。**日常使用不依赖 MySQL**。可选启用 **MySQL**，把配置与 Agent/通道/会话镜像到库中并查看同步情况（见下文 **可选 MySQL（同步与指标）**）。

近期在 **语言（6 种界面语言 + 东南亚分包）**、**风格（5 套全局主题皮肤，非仅深浅两色）**、**像素「游戏」场景（经典办公室 / 星际舰桥 / 蘑菇林地三套独立拓扑与氛围）**、**模型页（谁在用哪张卡、探测预设、探测通过后写入配置）** 等方面做了较多改造；细项见下文 **「语言、风格、像素场景与实时配置」**。

## 功能

- **首页 / 机器人总览（`/`）** — Agent 卡片（模型、平台、会话统计）、Gateway 状态、与侧栏 **一致的五套主题切换**、群聊提示；**Agent 任务追踪**（子任务 + 定时任务，数据来自 `/api/agent-activity`；长时间无任务或接口返回空列表时，**保留上一次有活动时的展示**并提示为快照）
- **OneOne 仪表盘（`/oneone-dashboard`）** — 另一套紧凑仪表盘布局，数据维度与首页同类
- **像素办公室（`/pixel-office`）** — **经典办公室 / 星际舰桥 / 蘑菇林地** 三套场景，各自独立地图与视觉；支持布局编辑与小虫装饰、热力图与摸鱼榜、Gateway SRE 小人等；详见 **「语言、风格、像素场景与实时配置」**
- **模型（`/models`）** — Provider/模型列表、**各模型被哪些 Agent 使用**、上下文与 **单模型探测**、**内网 model-probe 预设**、探测成功后 **新增模型并写入配置**；详见 **「语言、风格、像素场景与实时配置」**
- **通道管理（`/channels`）** — 以通道为维度的管理视图
- **会话（`/sessions`）** — 按 Agent 浏览会话（私聊/群聊/定时等）、Token、连通性测试
- **消息统计（`/stats`）** — Token 与响应时间趋势（日/周/月），SVG 图表
- **告警中心（`/alerts`）** — 规则与飞书通知
- **技能（`/skills`）** — 已安装技能，支持搜索/筛选
- **网页对话（`/chat`）** — 浏览器直连 Gateway 的对话页（未放在主导航，需手动输入地址）
- **Gateway / 平台测试** — 健康轮询、飞书/Discord 与 DM 等一键测试
- **自动刷新** — 手动、10 秒、30 秒、1 分钟、5 分钟、10 分钟

### 近期稳定性与体验优化（约 2026-03）

针对 **`/api/agent-activity`、`/api/gateway-health`** 等慢接口，已避免 **短时间叠出大量并发请求与 `openclaw` 子进程**（任务管理器里曾出现数百个 Node）：前端 **串行轮询**、服务端 **single-flight 合并**、Gateway 活动 **串行 RPC**、关键路径 **`AbortController`**，以及 **`npm run dev` 前检测 3003 端口**（`scripts/check-dev-port.mjs`）。**OneOne 仪表盘「重启 OneOneClaw」** 已改为 **流式输出**（接近 CMD 观感）。完整说明见 **[docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md)**。

### 语言、风格、像素场景与实时配置

- **国际化（远不止中英文切换）** — 侧栏语言下拉 **六种**：**简体中文、繁體中文、English、Bahasa Melayu、Bahasa Indonesia、ไทย**。简/繁/英主体文案在 **`lib/i18n.tsx`**；**马来语、印尼语、泰语** 使用独立文件 **`lib/locales/ms.json`、`id.json`、`th.json`**。缺键时按 **英文 → 简体中文** 回退。维护东南亚文案分包可运行 **`npm run i18n:merge-sea`** 合并分块。

- **界面风格（五套主题皮肤）** — 不是「只有中英文」或「只有深色/浅色」两种：当前提供 **深海暗夜、极简浅色、蓝色科技风、橙色暖调、森林绿境** 五套皮肤，与首页共用同一 **`ThemeSwitcher`**，通过 **`data-theme`** 作用于整站，并写入 **`localStorage`** 持久化。

- **像素办公室 = 多套「小游戏」场景** — **经典办公室**（原版像素美术 + 写字楼拓扑）、**星际舰桥**（飞船结构、**星空背景**、青蓝霓虹相框）、**蘑菇林地**（林间拓扑、**溪流可走水格**、森系光晕）。地图与主题实现见 **`lib/pixel-office/layout/alternateLayouts.ts`**、**`gameThemes.ts`**。页面支持 **布局编辑、撤销/重做、保存**，可选 **小虫（Bugs）** 装饰层，以及 **Agent 活跃热力图、摸鱼榜、Gateway 健康联动的值班 SRE 小人、HUD 名牌与画布描边** 等；Agent 工作中还有 **装饰性漂浮代码** 动效。布局文件：**`$OPENCLAW_HOME/pixel-office/layout.json`**。调整素材管线后可用 **`npm run generate-pixel-assets`** 重生成精灵图。

- **模型页能力** — 除列表与探测外，展示 **每个模型被哪些 Agent 主用**，支持 **临时 API Key**、**model-probe 预设**，以及探测通过后通过 **`/api/config/add-provider-model`** **写入 openclaw 配置**；字段形态见 **`docs/openclaw-models-config.md`**。

- **实时配置与数据** — 仍以 **`OPENCLAW_HOME` 下的 `openclaw.json`、agents、sessions** 等本地文件为权威来源；**不配数据库即可完整使用**。**MySQL** 仅为可选镜像与指标（见后文）。

## 主要路由

| 路径 | 说明 |
|------|------|
| `/` | 首页：总览 + 任务追踪 |
| `/oneone-dashboard` | OneOne 仪表盘 |
| `/pixel-office` | 像素办公室 |
| `/models` | 模型与探测 |
| `/channels` | 通道管理 |
| `/sessions` | 会话 |
| `/stats` | 统计 |
| `/alerts` | 告警 |
| `/skills` | 技能 |
| `/chat` | 网页对话 |
| `/setup` | **极简部署向导**（选厂商 + Key → 后台执行 `openclaw onboard`） |

后端接口位于 `app/api/`（如 `agent-activity`、`config`、`openclaw/*`、`pixel-office/*`、`storage/*`、`setup/onboard` 等）。

## 预览

以下截图均来自本仓库 **[`docs/`](docs/)** 目录（与上方英文 **Preview** 对应）。**更新界面后请同步替换 `docs/` 内图片**，README 中路径均为相对路径 `docs/文件名`。

### 首页与仪表盘
![机器人总览仪表盘](docs/bot_dashboard.png)
![仪表盘主界面](docs/dashboard.png)
![仪表盘宽屏预览](docs/dashboard-preview.jpg)

### 模型与会话
![模型列表](docs/models-preview.png)
![会话列表](docs/sessions-preview.png)

### 像素办公室与三套游戏场景
![像素办公室](docs/pixel-office.png)
![游戏场景 · 经典办公室](docs/游戏场景-办公室.png)
![游戏场景 · 星际舰桥](docs/游戏场景-星际剑桥.png)
![游戏场景 · 蘑菇林地](docs/游戏场景-蘑菇林地.png)

### 专家战队与专家文件管理
![专家战队](docs/专家战队.png)
![专家文件管理](docs/专家文件管理.png)
![专家文件管理（备选截图）](docs/专家文件管理1.png)

### 主题与多语言（五套主题 · 六种界面语言）
![主题切换](docs/主题变化.png)
![繁体中文界面](docs/繁体.png)
![马来语界面](docs/马来语.png)
![印尼语界面](docs/印尼语.png)
![泰语界面](docs/泰语.png)

### 告警、模型切换、统计、通道
![告警中心](docs/告警中心.png)
![模型切换](docs/模型切换.png)
![消息统计](docs/消息统计.png)
![通道管理](docs/通道管理.png)

### 极简安装向导
![极简安装总览](docs/极简的安装.png)
![极简安装步骤 2](docs/极简安装2.png)
![极简安装步骤 3](docs/极简安装3.png)
![极简安装步骤 4](docs/极简安装4.png)

### `docs/` 目录下的说明文档（非截图）
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows 打包与安装器交接说明  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — 模型与 `openclaw.json` 字段对齐说明  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — 近期稳定性与轮询 / OpenClaw 调用优化记录

## 快速开始

### 最快上手（三选一）

1. **Windows 安装包（最终用户，不必单独装 Node）** — 双击 **`ONE Claw … Setup ….exe`**（你方发布的安装包；或在仓库里执行 [`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1)，产物在 [`packaging/electron/dist/`](packaging/electron/)）。安装完成后会自动启动内嵌的 **3003** 服务并在浏览器打开 **部署向导（`/setup`）**。原理与构建说明：[`packaging/electron/README.md`](packaging/electron/README.md)。
2. **源码 / 开发者** — 克隆本仓库（或只拷贝本目录）→ `npm install` → `npm run dev` → 浏览器打开 **http://localhost:3003**（具体命令见下一段）。若 OpenClaw 配置不在 `~/.openclaw`，在项目根 **`OPENCLAW_HOME`** 写到 `.env.local`（见下文 **自定义配置路径**）。
3. **只缺 OpenClaw 初始化** — 面板已经在跑时，直接访问 **http://localhost:3003/setup**，按向导完成 CLI 预检与厂商/Key。

**安装顺序、先起 3003 再走网页向导**等场景说明：**[`packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)**。

**macOS / Linux（如 Ubuntu）：**请用上面 **「源码 / 开发者」** 或下文 **Docker**。Linux 上先装好 **Node.js 18+**（Ubuntu 自带 `apt` 的 `nodejs` 版本常偏旧，建议 **`nvm`** 或 **NodeSource** 装新 LTS），再在项目目录执行 `npm install`、`npm run dev`，浏览器访问 **http://localhost:3003**。**`.exe` 仅 Windows**。当前 [`electron-builder.config.js`](packaging/electron/electron-builder.config.js) 只有 **Windows NSIS**，**没有**现成的 **`.dmg`（Mac）** 或 **AppImage / `.deb`（Linux）** 安装包；需要桌面包时要自己在对应系统上加 electron-builder 的 `mac` / `linux` 目标并构建。

更多方式（提示词 / Skill 等）见：[快速启动文档](quick_start.md)。

本应用在 monorepo 中的路径为 **`软件SOFT/龙虾可视化控制面板`**。克隆 [Openclaw-SKILLS-OneOne-](https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git) 后：

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

若你**只下载了本文件夹**，则直接进入该目录执行 `npm install` 与 `npm run dev` 即可。

- **`npm run dev` / `npm run start` 默认端口为 `3003`**（见 `package.json`）。
- **`npm run dev`** 会先执行 **`node scripts/check-dev-port.mjs`**：若 **3003** 已被占用则直接退出，请先结束占用该端口的旧 **Next** 进程再启动。
- 浏览器访问：**http://localhost:3003**

其它命令：`npm run build`（构建）、`npm run start`（生产模式，端口 3003）、`npm run generate-pixel-assets`（像素资源）、`npm run i18n:merge-sea`（维护者合并东南亚语言分包）。

### 一键安装包（OpenClaw + 龙虾面板）

实验性方案见 **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)**：官方**静默**安装脚本前会 **检测是否已有 `openclaw`（有则跳过安装避免覆盖）**，并检测 **网关端口 / 龙虾 3003 占用**；`wizard.env` 驱动 **`openclaw onboard --non-interactive`**；网关就绪后打开 **OpenClaw 网页**与 **`http://localhost:3003/oneone-dashboard`**。同类体验可参考社区桌面端 **[OneClaw](https://github.com/oneclaw/oneclaw)**。完整 **DMG/EXE** 需自行打入 **Node 22** 并用 Inno / macOS 安装器打包。

执行 **`npm run packaging:prepare-standalone`**（`next build` + 将 `.next/static` 与 `public` 拷入 `.next/standalone`），便于单独用 `node server.js` 启动龙虾面板。

## 技术栈

- **Next.js 16**（App Router）+ **React 19** + TypeScript  
- **Tailwind CSS v4**  
- 主数据源：本地文件与 `OPENCLAW_HOME` 下的 `openclaw.json`  
- **可选：** `mysql2`，配置 MySQL 后可用同步与指标接口（见 `.env.example`）

## 环境要求

- Node.js 18+
- 已安装 OpenClaw，配置文件位于 `~/.openclaw/openclaw.json`

## 自定义配置路径

默认读取 `~/.openclaw/openclaw.json`。该文件须为 **标准 JSON**（OpenClaw 用 `JSON.parse`）：**不能**写 `//`、`/* */` 注释，**不能**有尾随逗号；仪表盘经 Gateway 写入时使用 `JSON.stringify`，**不会**往文件里加注释。

若要指定其他目录：

- **方式一**：在项目根目录创建 `.env.local`（推荐）：
  ```env
  OPENCLAW_HOME=C:/Users/你的用户名/.openclaw
  ```
  （Windows 建议用正斜杠。可参考 `.env.example`。）

- **OpenClaw CLI 路径**：在 Cursor/IDE 里跑 `npm run dev` 时，若 **写入配置** / 调用 Gateway 报 `spawn openclaw ENOENT`，请在 `.env.local` 设置 `OPENCLAW_CLI`（或 `OPENCLAW_MJS` 指向 `openclaw.mjs`）。详见 `.env.example`。

- **方式二**：启动时设置环境变量：
  ```bash
  # Linux/macOS
  OPENCLAW_HOME=/opt/openclaw npm run dev
  # Windows PowerShell
  $env:OPENCLAW_HOME="C:\Users\你的用户名\.openclaw"; npm run dev
  ```

### 模型探测预设（内网网关）

用 JSON 固定 **网关地址、协议、Key**，再与列表里的 **模型 ID** 组合做直连探测（类似内网 Chat 调试台）：

1. 将 `model-probe-presets.example.json` 复制为项目根目录或 `$OPENCLAW_HOME` 下的 `model-probe-presets.json`，或在 `openclaw.json` 顶层增加 `modelProbePresets.presets` 数组。
2. 在 **模型** 页选择预设后，对单行点 **测试**（或 **新增模型** 内测试）。**临时 API Key** 仅覆盖当次请求。

`protocol` 支持：`anthropic`、`openai`（`gemini` 暂不做直连探测）。

**模型 JSON 结构说明**（与 `openclaw.json` 写入对齐）：[docs/openclaw-models-config.md](docs/openclaw-models-config.md)。

### 可选 MySQL（同步与指标）

可选将 OpenClaw 配置与 Agent/通道/会话 **镜像** 到 MySQL（首次同步会建表 `oc_*`）。在 `.env.local` 中配置 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`（默认库名 `openclaw_visualization`），说明见 `.env.example`。

- `POST /api/storage/sync` — 执行同步  
- `GET /api/storage/sync` — 最近一次同步状态  
- `GET /api/storage/metrics` — 存储相关指标  

**其它页面不依赖 MySQL**，不配库亦可完整使用仪表盘。

### Docker 说明

与本地 `npm run dev`（**3003**）不同，**Dockerfile** 内进程使用 **`PORT=3000`**，映射端口时请使用 `-p 3000:3000`（或自行改 Dockerfile / 环境变量）。

## 作者联系方式（contact）
GitHub：[gaogg521](https://github.com/gaogg521)

感谢初始代码作者 [xmanrui](https://github.com/xmanrui)。
