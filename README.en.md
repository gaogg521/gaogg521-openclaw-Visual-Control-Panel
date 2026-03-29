**Languages / 语言:** [← 简体中文（默认 README）](README.md) · **English (this file)**

---

<div align="center">

<h1><img src="docs/readme-logo.png" alt="" height="44" style="vertical-align: middle;" /> OpenClaw Dashboard — Lobster visualization console</h1>

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

<a id="routes"></a>

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

Each block below pairs **short copy with a screenshot** so you can map UI to the **[routes / pages](#routes)** table above.

### Dashboard & expert team

**OneOne dashboard.** Version + gateway health, config paths/ports, global token & latency trends, channel/session mix, recent syncs, agent task status; top bar links for CLAW diagnostics, restart OneOneClaw, and runtime status.

![Main dashboard](docs/bot_dashboard.png)

**Expert team · default grid.** Per-agent online/idle/offline, bound models & platforms (e.g. Feishu), session/message/token counts and mini trend charts.

![Expert team grid](docs/dashboard.png)

**Expert team · wide layout.** Same surface with more horizontal room; may include overlays such as session preview (depends on your exported capture).

![Expert team wide / session preview](docs/dashboard-preview.jpg)

### Models, sessions, memory

**Models workspace.** Provider/model list, agent bindings, per-model probe, and (after a successful probe) writing `openclaw.json` via the dashboard APIs.

![Models list & probe](docs/models-preview.png)

**Sessions list.** Primary sessions per agent, Feishu/cron-style channels, context usage, and connectivity tests.

![Sessions list](docs/会话列表.png)

**Sessions · alternate view.** Complementary list/detail layout for the same capability at another breakpoint.

![Sessions list (alt)](docs/sessions-preview.png)

**Memory management.** Dual track: Markdown archive + live SQLite, editing `MEMORY.md` and related views.

![Memory management](docs/记忆管理.png)

### Expert Studio & game scenes

**Pixel office (Expert Studio).** Map, heatmap, layout tools, and scene switching.

![Pixel office](docs/pixel-office.png)

**Playable scene · office.**

![Game scene · office](docs/游戏场景-办公室.png)

**Playable scene · starship.**

![Game scene · starship](docs/游戏场景-星际剑桥.png)

**Playable scene · grove.**

![Game scene · grove](docs/游戏场景-蘑菇林地.png)

### Expert roster & files

**Expert roster · view A.** Cards for group chat, fallback, cron monitoring, etc.

![Expert roster](docs/专家战队.png)

**Expert roster · view B.** Second capture of the same area for more agents/states.

![Expert roster 2](docs/专家战队2.png)

**Expert files.** Compliance checklist, gap filling, batch actions.

![Expert files](docs/专家文件管理.png)

**Expert files · detail.** Zoomed or follow-up step (pairs with the previous shot).

![Expert files 1](docs/专家文件管理1.png)

### Quick chat

**In-browser chat.** Gateway-backed conversation inside the panel—useful for long replies and formatting checks.

![Quick chat](docs/快速聊天对话.png)

**In-browser chat · follow-up.** Another example (multi-turn or different agent).

![Quick chat 2](docs/快速聊天对话2.png)

### Diagnostics

**CLAW diagnostics modal.** Doctor/self-check style output from the dashboard shell.

![Claw diagnostics](docs/claw诊断.png)

**Runtime / gateway status.** Logs or status summary to cross-check with the gateway and local CLI.

![Gateway / runtime status](docs/查看claw运行状态.png)

### Themes & locales

**Theme switcher.** Multiple palettes / light-dark variants from settings or the header.

![Theme switcher](docs/主题变化.png)

**UI locale · Traditional Chinese.**

![Traditional Chinese](docs/繁体.png)

**UI locale · Bahasa Melayu.**

![Malay](docs/马来语.png)

**UI locale · Bahasa Indonesia.**

![Indonesian](docs/印尼语.png)

**UI locale · Thai.**

![Thai](docs/泰语.png)

### Alerts, models, stats, channels

**Alerts.** Rules, history, outbound hooks (e.g. Feishu).

![Alerts](docs/告警中心.png)

**Model switching / routing.** Ops-oriented view of how models are used (per your screenshot).

![Model switcher](docs/模型切换.png)

**Message statistics.** Tokens, volumes, time-series charts.

![Message stats](docs/消息统计.png)

**Channels.** IM/channel configuration and connectivity overview.

![Channels](docs/通道管理.png)

### Setup wizard

**`/setup` · step 1.** Precheck / welcome: whether OpenClaw CLI is present, etc.

![Setup step 1](docs/极简的安装.png)

**`/setup` · step 2.** Provider selection and credentials.

![Setup step 2](docs/极简安装2.png)

**`/setup` · step 3.** Confirm and background `openclaw onboard --non-interactive`.

![Setup step 3](docs/极简安装3.png)

**`/setup` · step 4.** Done screen and next-step hints.

![Setup step 4](docs/极简安装4.png)

### Docs in `docs/` (text)
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows packaging / installer handoff (zh-CN)  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — `models.providers` alignment with the dashboard  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — stability & polling / OpenClaw CLI notes

<a id="install-guide"></a>

## Installation

Both are called “install”, but they **install different stacks**. Suggested reading order: **① comparison table → ② “Which track?” → ③ only the subsection you need**.

### Track comparison (A vs B)

| | **Track A — Lobster panel only** | **Track B — OpenClaw + panel pipeline** |
|--|--|--|
| **What you get** | This repo’s **web console** (default **http://localhost:3003**) | **Scripts / installer flow**: detect or install CLI → **onboard** → start Gateway → start standalone panel |
| **Includes OpenClaw?** | **No** (you need OpenClaw on the machine, or follow **`/setup`** after the UI is up) | **Yes, when you run the docs**: the flow installs or reuses **openclaw** |
| **Typical use** | OpenClaw already there; or you install the CLI **yourself** | **Greenfield** or integrators who want **one ordered delivery** for **CLI + panel** |

**Common confusion:** Track **A** **desktop bundles** (Windows **`.exe`**, macOS **`.dmg` / `.zip`**, Linux **AppImage**) are all **panel only** with the same Electron behavior. Track **B** **wires CLI + panel** — not the same as installing only those bundles.

### Which track?

1. You **already** have `openclaw` and config and you manage the Gateway → **Track A**.  
2. **Panel only (any OS):** **Track A**. Choose **① Desktop bundle** (same as Windows: Electron + embedded Node, tray, browser **`/setup`**): on the **target OS** run **`npm run electron:dist`** from the repo root (or `packaging/electron/build-electron.js` / **`build-electron.sh`**), producing **Windows `.exe`**, **macOS `.dmg` / `.zip`**, or **Linux AppImage**; **② From source:** **Node 18+** `npm run dev` / `npm run start`; **③ Docker**.  
3. **Greenfield** and you will follow **`packaging/openclaw-oneclick/`** end-to-end → **Track B**.

---

### Track A — Install the lobster panel only

**All three OSes support “panel only”:** same Next.js app, same Electron **`main.js`** (tray, **`utilityProcess`** standalone server, browser opens **`/setup`** by default), port **3003**. Install either as a **desktop bundle** (no separate Node for end users) or with **local Node / Docker**.

**Native modules:** this app uses **better-sqlite3**. **Always run `npm run build` on the OS you ship for** (or run full **`npm run electron:dist`**, which builds first). **Do not** copy a Windows-built **`.next/standalone`** onto macOS/Linux and package it — the wrong **`.node`** binary will load.

Agents, gateway health, `/setup` writing config still need a valid **`OPENCLAW_HOME`** (with **`openclaw.json`**) and usually a running **Gateway**; install OpenClaw **separately** if needed, or use **`/setup`** plus official docs.

#### Windows

| Role | What to do |
|------|------------|
| **End users (no separate Node)** | Build the installer **on Windows**: from repo root **`npm run electron:dist`**, or [`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1) / [`build-electron.js`](packaging/electron/build-electron.js). Output **NSIS `.exe`** under [`packaging/electron/dist/`](packaging/electron/dist/) (optional copies in **`dist/releases/`**). See [`packaging/electron/README.md`](packaging/electron/README.md). |
| **Developers** | **Node 18+** → `npm install` → `npm run dev`. |
| **Local prod / portable** | After **`npm run build`**, run **`npm run start`** (or **`npm run packaging:prepare-standalone`** first; same idea as **`node server.js`** under **`.next/standalone`** with **PORT=3003**). |

#### macOS

**Supported.** **Desktop:** on **macOS**, run **`npm run electron:dist`** (or `cd packaging/electron && ./build-electron.sh`). [`electron-builder.config.js`](packaging/electron/electron-builder.config.js) emits **`.dmg` and `.zip`** (x64 + arm64). Behavior matches the Windows installer build. Unsigned builds may require **Open Anyway** in Privacy & Security or right-click → Open. Optional icons: **`packaging/electron/build/icon.icns`** or **`icon.png`** (~512px).  
**Without desktop bundle:** `npm run dev` / `npm run start`, or **Docker**.

#### Linux (incl. Ubuntu)

**Supported.** **Desktop:** on **Linux**, **`npm run electron:dist`** or **`packaging/electron/build-electron.sh`** → **AppImage** by default. Same runtime behavior as Windows. Prefer **nvm** / NodeSource for **Node 18+**. Optional **`packaging/electron/build/icon.png`**.  
**Without desktop bundle:** **Node** or **Docker**, same as macOS.

**When the panel is up:** open **http://localhost:3003**. Set **`OPENCLAW_HOME`** in **`.env.local`** if not using the default tree (see **Configuration**).

---

### Track B — One-click pipeline (OpenClaw + lobster panel)

**Folder:** **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)**.

**Flow outline:**

1. **Conflict checks** — skip reinstall if `openclaw` is on PATH; optional checks for gateway (**18789**) and lobster (**3003**) (see that README).  
2. **Install OpenClaw** — wrappers around official **`install.sh` / `install.ps1`**.  
3. **Onboarding** — **`http://localhost:3003/setup`**, or **`wizard.env` + `run-onboard-from-env`** → **`openclaw onboard --non-interactive`**.  
4. **Start lobster** — run **`npm run packaging:prepare-standalone`** in this repo, then **`start-lobster-standalone`**.ps1 / .sh.  
5. **Open dashboards** — **`wait-gateway-open-dashboards`**.ps1 / .sh, etc.

**Read first by OS:**

| OS | Docs |
|----|------|
| **Windows** | **[`WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)**; maintainers: **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)**, **[`docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md`](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)**. |
| **macOS / Linux** | Same README: **`install-openclaw-macos-linux.sh`**, **`start-lobster-standalone.sh`**, **`wait-gateway-open-dashboards.sh`**, etc. |

**Scope:** a single polished “double-click” installer with **portable Node + CLI + lobster** is **your CI/signing** work (Inno, pkg, create-dmg, …). This repo ships **scripts + ISS skeletons**; see openclaw-oneclick README (**DMG/EXE**).

---

## Getting Started

**If you have not picked a track yet, read [Installation](#install-guide) first.** Short map: **panel only** → Track **A** (all OSes: **`npm run electron:dist`** for a desktop bundle, or **Node** / **Docker**); **fresh CLI + panel** → Track **B** **`packaging/openclaw-oneclick/`** (on Windows, read **`WINDOWS_USER_JOURNEY`**).

See [Quick Start Guide](quick_start.md) for prompt / git / skill install options.

This app lives under the monorepo folder **`软件SOFT/龙虾可视化控制面板`**. After cloning [Openclaw-SKILLS-OneOne-](https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git):

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

- **Port `3003` by default** (see `package.json`).
- **`npm run dev`** — `next dev` with HMR; runs **`scripts/check-dev-port.mjs`** first and exits if **3003** is in use.
- **`npm run start`** — this repo uses **`output: "standalone"`** in **`next.config`**. Do **not** use raw **`next start -p 3003`** (not compatible with standalone). Instead:
  1. Run **`npm run build`** when sources or deps change (build already copies **`static`** / **`public`** into **`.next/standalone`**).
  2. Then **`npm run start`**, which runs **`scripts/start-prod.mjs`** → **`.next/standalone/server.js`** with default **`PORT=3003`**, **`HOSTNAME=0.0.0.0`**.
  - You **do not** need **`build`** before every **`start`** if you only stopped the process and changed nothing.
- **`npm run stop`** — kills whatever is **LISTENING on 3003** (`scripts/kill-port.mjs`).
- **`npm run restart`** — always frees **3003**, then starts production with **`PORT=3003`** (`scripts/restart-prod.mjs`); it does **not** run **`build`**.
- Open **`http://localhost:3003`** or **`http://127.0.0.1:3003`**. If you use a **LAN IP** (e.g. **`http://192.168.x.x:3003`**), set **`CONFIG_ALLOW_LAN=1`** in **`.env.local`** so `/api/config` and related guards accept private RFC1918 hosts (see **`.env.example`**). Avoid **`SETUP_ALLOW_REMOTE=1`** on public networks.

Other scripts: `npm run generate-pixel-assets`, `npm run i18n:merge-sea` (maintainers). More detail: **[quick_start.md](quick_start.md)**.

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
