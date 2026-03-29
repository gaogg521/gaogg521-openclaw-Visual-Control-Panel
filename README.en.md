**Languages / 语言:** [← 简体中文（默认 README）](README.md) · **English (this file)**

---

<div align="center">

<img src="docs/readme-logo.png" alt="ONE CLAW brand mascot" width="168" />

# OpenClaw Dashboard — Lobster visualization console

**1one Lobster Office** — a **full-stack local control plane** for [OpenClaw](https://github.com/openclaw/openclaw), built with [Next.js](https://nextjs.org/): not one screen, but a **coherent toolbox** of dashboards, labs, wizards, and visual surfaces that stay in sync with your real `openclaw.json`, agents, sessions, and gateway.

</div>

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

> **Note:** Full-page UI screenshots are **not embedded** in README anymore (legacy sidebar showed the old lobster/mascot; they will be replaced after the **new logo** ships). Re-export PNGs into [`docs/`](docs/) and add `![](docs/...)` back when ready. Chinese README has the same file checklist.

**File checklist (what each asset is for):**

### Dashboard & expert team
- `bot_dashboard.png` — main dashboard: gateway, trends, sync, agent tasks, top action bar.
- `dashboard.png`, `dashboard-preview.jpg` — expert team grid (+ optional session preview popover).

### Models, sessions, memory
- `models-preview.png`, `会话列表.png`, `记忆管理.png`

### Expert Studio & game scenes
- `pixel-office.png`, `游戏场景-办公室.png`, `游戏场景-星际剑桥.png`, `游戏场景-蘑菇林地.png`

### Expert roster & files
- `专家战队.png`, `专家战队2.png`, `专家文件管理.png`, `专家文件管理1.png`

### Expert team chat
- `快速聊天对话.png`, `快速聊天对话2.png`

### Diagnostics
- `claw诊断.png`, `查看claw运行状态.png`

### Themes & locales
- `主题变化.png`, `繁体.png`, `马来语.png`, `印尼语.png`, `泰语.png`

### Alerts, models, stats, channels
- `告警中心.png`, `模型切换.png`, `消息统计.png`, `通道管理.png`

### Setup wizard
- `极简的安装.png` … `极简安装4.png`

### Docs in `docs/` (text)
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows packaging / installer handoff (zh-CN)  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — `models.providers` alignment with the dashboard  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — stability & polling / OpenClaw CLI notes

## Installation handbook (read this first)

There are **two different things** people call “install”. Pick the row that matches you:

| Track | What gets installed | Typical user |
|-------|---------------------|--------------|
| **A — Lobster panel only** | The **web console** on **http://localhost:3003** (Next.js). **Does not** include the OpenClaw CLI or Gateway binaries inside the same package (except you already installed them yourself). | You want **only the dashboard**; OpenClaw is already on the machine, or you will install it **separately** (official installer / package manager). |
| **B — One-click bundle (OpenClaw + lobster)** | A **scripted or custom-installer** flow: install/detect **OpenClaw CLI**, run **onboard**, start **Gateway**, then start the **lobster standalone** server and open URLs. | **New machine** or you want **one documented pipeline** for CLI + panel + wizard. |

---

### A — Lobster panel only (independent install)

**What “supported” means:** the **Next.js app runs** on your OS. Full features (agents, gateway health, `/setup` writing config) still need a valid **`OPENCLAW_HOME`** and usually a running **OpenClaw Gateway** — install OpenClaw **separately** if you do not already have it.

| OS | Supported? | How users install **this repo’s panel** (what we maintain) |
|----|--------------|--------------------------------------------------------------|
| **Windows** | **Yes** | **End users (no separate Node):** install **`ONE Claw … Setup ….exe`** (NSIS) built by [`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1) → output [`packaging/electron/dist/`](packaging/electron/). Electron embeds Node and runs **standalone Next** on **3003**; see [`packaging/electron/README.md`](packaging/electron/README.md). **Developers:** install **Node 18+**, clone repo, `npm install`, `npm run dev`. **Portable:** `npm run packaging:prepare-standalone`, then `node server.js` under `.next/standalone` (set **PORT=3003** if you need the same port as dev). |
| **macOS** | **Yes** | **No** prebuilt **`.dmg` / `.app`** in this repository ([`electron-builder.config.js`](packaging/electron/electron-builder.config.js) is **Windows NSIS only**). Use **Node 18+** + clone + `npm install` / `npm run dev`, or **Docker** (see **Docker Deployment**). To ship a Mac desktop bundle, add an electron-builder **`mac`** target and build **on macOS**. |
| **Linux** (Ubuntu, Debian, etc.) | **Yes** | Same as macOS: **Node 18+** + source (**nvm** / NodeSource recommended on Ubuntu) or **Docker**. No Linux **AppImage/.deb** is produced here unless you add a **`linux`** target. |

**After the panel is running:** open **http://localhost:3003**. If OpenClaw is missing, either install the **official CLI** first or use **`/setup`** inside the panel (it will guide you once the UI is up). Configure **`OPENCLAW_HOME`** in `.env.local` if your tree is not `~/.openclaw` (see **Configuration**).

---

### B — One-click bundle (OpenClaw CLI + lobster panel)

This track is **not** the same as “double-click the lobster `.exe` only”. It lives under **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)** and wires:

1. **Conflict checks** — skip reinstall if `openclaw` is already on PATH; optional strict checks for **gateway port (default 18789)** and **lobster port 3003**.  
2. **Install OpenClaw** — wrappers around the **official** `install.sh` / `install.ps1` (see table in [`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)).  
3. **Onboarding** — `wizard.env` + **`run-onboard-from-env`**, or the browser wizard **`http://localhost:3003/setup`** after the panel is up.  
4. **Start lobster** — **`start-lobster-standalone`**.ps1 / .sh (needs a built **standalone** tree from **`npm run packaging:prepare-standalone`**).  
5. **Open dashboards** — **`wait-gateway-open-dashboards`**.ps1 / .sh when you want to auto-open OpenClaw Web + lobster URLs.

| OS | What to read / run |
|----|--------------------|
| **Windows** | User journey: **[`WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)** (EXE wizard vs “start 3003 first”). Maintainer: **`install-openclaw-windows.ps1`**, Inno **`OpenClawOneClick.iss` / Full** — see **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)** and **[`docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md`](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)**. |
| **macOS / Linux** | Same README: **`install-openclaw-macos-linux.sh`**, **`start-lobster-standalone.sh`**, **`wait-gateway-open-dashboards.sh`**. |

**Honest scope:** a polished **single** “double-click installer” that bundles **portable Node + CLI + lobster** for every OS is **your packaging/CI** work; this repo ships **scripts + ISS skeletons** and documents the intended order of operations (see openclaw-oneclick README, section on DMG/EXE).

---

## Getting Started

### Which row from the handbook?

- **Windows · panel only · no Node:** Track **A** → lobster **`.exe`**.  
- **macOS / Linux · panel only:** Track **A** → **Node + npm** or **Docker**.  
- **Fresh stack · CLI + panel:** Track **B** → **`packaging/openclaw-oneclick/`** (+ **`WINDOWS_USER_JOURNEY`** on Windows).

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

**Track B / maintainers:** full one-click narrative, conflict env vars, and ISS notes are in **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)**. Comparable desktop UX: community **[OneClaw](https://github.com/oneclaw/oneclaw)**.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript  
- **Tailwind CSS v4**  
- Primary data: filesystem + `openclaw.json` under `OPENCLAW_HOME`  
- **Optional:** `mysql2` — sync/metrics APIs if MySQL is configured (`.env.example`)

## Requirements

- **Track A (from source):** Node.js **18+**.  
- **Track A (Windows `.exe`):** no global Node required; runtime is bundled in Electron.  
- **OpenClaw:** required for **full** dashboard behaviour (Gateway, agents, `/setup` writes). Point **`OPENCLAW_HOME`** at the directory that contains **`openclaw.json`** (default `~/.openclaw` on Unix, `%USERPROFILE%\.openclaw` on Windows).

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

## Community (Feishu & WeChat)

Questions, install help, or feedback: scan the **Feishu group** or **WeChat** QR codes below (PNG files live under [`docs/`](docs/); replace them when your codes rotate).

| Feishu group | WeChat |
|--------------|--------|
| ![Feishu group QR](docs/飞书群.png) | ![WeChat QR](docs/微信.png) |

You can also open a GitHub Issue or reach the author on GitHub.

## Author & credits

- GitHub: [gaogg521](https://github.com/gaogg521)  
- Thanks to initial code author [xmanrui](https://github.com/xmanrui).
