<div align="center">

<h1><img src="docs/readme-logo.png" alt="" height="44" style="vertical-align: middle;" /> ONE CLAW 龙虾可视化控制台</h1>

**本地优先的 OpenClaw 可视化工具箱** — 仪表盘 · 专家战队 · 像素工作室 · 模型探测 · 极简部署，全部对齐本机 `openclaw.json` 与 Gateway（[Next.js](https://nextjs.org/) + [OpenClaw](https://github.com/openclaw/openclaw)）。

<p>
  <strong>Language / 语言</strong><br />
  <b>简体中文（本页）</b> · <a href="README.en.md">English → README.en.md</a>
</p>

<p>
  <a href="#capabilities">核心能力</a>
  &nbsp;·&nbsp;
  <a href="#preview">界面预览</a>
  &nbsp;·&nbsp;
  <a href="#install-guide">安装说明</a>
  &nbsp;·&nbsp;
  <a href="#quick-start">快速开始</a>
  &nbsp;·&nbsp;
  <a href="#tech-stack">技术栈</a>
  &nbsp;·&nbsp;
  <a href="#community">交流</a>
</p>

</div>

---

> **不想先啃长文档？** **只装面板** 三系统一致：**Windows** 可装 **NSIS `.exe`**；**macOS** 可在本机打 **`.dmg` / `.zip`**；**Linux** 可打 **AppImage**（均为 Electron、内嵌 Node、默认 **3003**，与源码跑同一套 `main.js`）。也可不装桌面包，直接用 **Node 18+**（`npm run dev` / `npm run start`）或 **Docker**。完整能力仍依赖本机 **OpenClaw**；与 **「OpenClaw + 龙虾一键流水线」** 的差别见 **[安装说明](#install-guide)**。

### ✨ 为什么选这套控制台？

| 🚀 亮点 | 说明 |
|--------|------|
| 🎯 **一站式运维** | 网关健康、Token/耗时趋势、告警、会话、专家战队同屏可达 |
| 🖥️ **专家工作室** | 经典办公室 / 星际舰桥 / 蘑菇林地三套像素场景，热力图与摸鱼榜 |
| 🤖 **模型实验台** | 谁在用什么模型、探测、内网预设、通过后写入 `openclaw.json` |
| 🌍 **六语五主题** | 简繁英 + 马来 / 印尼 / 泰；五套全局皮肤持久化 |
| 📦 **双轨安装** | **A** 独立龙虾面板（Win `.exe` / 源码 / Docker）· **B** [`openclaw-oneclick`](packaging/openclaw-oneclick/) 一键脚本与 Inno 骨架 |
| 🔧 **CLI 友好** | 不替代官方终端；需要时照常使用 `openclaw` |

---

<a id="capabilities"></a>

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

<a id="routes"></a>

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

<a id="preview"></a>

## 预览

以下按功能块做**图文对照**：先读一两句说明再看截图，便于把界面与上文 **[路由与页面](#routes)** 对应起来。

### 仪表盘总览与专家战队

**OneOne 仪表盘总览。** 版本与网关健康、配置路径/端口、全局 Token 与耗时趋势、渠道/会话分布、最近同步与 Agent 任务；顶栏可进 CLAW 诊断、重启 OneOneClaw、查看运行状态。

![仪表盘总览](docs/bot_dashboard.png)

**专家战队 · 标准视图。** 卡片墙展示各 Agent 在线/空闲/离线、绑定模型与平台（如飞书）、会话/消息/Token 与小趋势图。

![专家战队卡片墙](docs/dashboard.png)

**专家战队 · 宽屏与浮层。** 同一块能力在更宽布局下的展示，可叠加入口或会话预览类浮层（以你本地导出图为准）。

![专家战队宽图与会话预览](docs/dashboard-preview.jpg)

### 模型、会话与记忆

**模型页。** 接入模型列表、与 Agent 的绑定关系、单模型探测与（探测通过后）写回 `openclaw.json` 等入口。

![模型列表与探测](docs/models-preview.png)

**会话列表。** 按 Agent 查看主会话、飞书/定时任务等通道，以及上下文占用与连通性测试。

![会话列表](docs/会话列表.png)

**会话 · 另一视角。** 与上一张互补的列表或详情布局，方便对照不同分辨率下的同一能力。

![会话列表（补充）](docs/sessions-preview.png)

**记忆管理。** Markdown 归档与 SQLite 实时双轨、`MEMORY.md` 等在本页的编辑与浏览方式。

![记忆管理](docs/记忆管理.png)

### 专家工作室与游戏场景

**像素办公室（Expert Studio）。** 地图、热力、布局编辑与场景切换等可视化表面。

![像素办公室](docs/pixel-office.png)

**三套可切换场景 · 办公室。** 默认办公主题场景。

![游戏场景 · 办公室](docs/游戏场景-办公室.png)

**三套可切换场景 · 星际剑桥。** 星舰/科幻主题场景。

![游戏场景 · 星际剑桥](docs/游戏场景-星际剑桥.png)

**三套可切换场景 · 蘑菇林地。** 自然/林地主题场景。

![游戏场景 · 蘑菇林地](docs/游戏场景-蘑菇林地.png)

### 专家战队与专家文件

**专家战队 · 卡片墙一。** 群聊、Fallback、定时任务等监控入口在卡片上的分布。

![专家战队](docs/专家战队.png)

**专家战队 · 卡片墙二。** 与上一张同一能力区的另一张截图，便于看全不同 Agent 或状态。

![专家战队 2](docs/专家战队2.png)

**专家文件管理。** 文件合规清单、缺失补全与批量操作入口。

![专家文件管理](docs/专家文件管理.png)

**专家文件管理 · 详情。** 单文件或子流程的放大视图（与上一张互补）。

![专家文件管理 1](docs/专家文件管理1.png)

### 快速聊天

**浏览器内会话。** 在面板里直接拉起与网关的对话，适合验收长回复与格式。

![快速聊天对话](docs/快速聊天对话.png)

**浏览器内会话 · 续。** 同能力的另一张示例图（多轮或不同 Agent）。

![快速聊天对话 2](docs/快速聊天对话2.png)

### Claw 诊断与运行状态

**CLAW 诊断弹窗。** Doctor / 自检类信息在仪表盘中的呈现方式。

![Claw 诊断](docs/claw诊断.png)

**查看 CLAW / 网关运行状态。** 日志或状态摘要，便于与网关、本机 CLI 对照排错。

![查看 Claw 运行状态](docs/查看claw运行状态.png)

### 主题与多语言

**主题切换。** 多套配色/明暗主题在设置或顶栏中的切换效果。

![主题切换](docs/主题变化.png)

**界面语言 · 繁体中文。**

![繁体中文](docs/繁体.png)

**界面语言 · Bahasa Melayu。**

![马来语](docs/马来语.png)

**界面语言 · Bahasa Indonesia。**

![印尼语](docs/印尼语.png)

**界面语言 · ไทย。**

![泰语](docs/泰语.png)

### 告警、模型、统计与通道

**告警中心。** 规则、历史与对外通知（如飞书 Webhook）相关视图。

![告警中心](docs/告警中心.png)

**模型切换 / 路由。** 在运维视角下查看或调整模型使用面的入口（以截图为准）。

![模型切换](docs/模型切换.png)

**消息统计。** Token、消息量与时序图表。

![消息统计](docs/消息统计.png)

**通道管理。** 各 IM/通道的配置与连通性一览。

![通道管理](docs/通道管理.png)

### 极简安装向导

**`/setup` · 步骤 1。** 预检或欢迎页：提示本机是否已具备 OpenClaw CLI 等。

![极简安装 · 步骤 1](docs/极简的安装.png)

**`/setup` · 步骤 2。** 选择厂商 / 填写 Key 等引导。

![极简安装 · 步骤 2](docs/极简安装2.png)

**`/setup` · 步骤 3。** 确认与后台执行 `openclaw onboard` 前后的界面。

![极简安装 · 步骤 3](docs/极简安装3.png)

**`/setup` · 步骤 4。** 完成页或后续操作建议。

![极简安装 · 步骤 4](docs/极简安装4.png)

### `docs/` 目录下的说明文档（非截图）
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows 打包与安装器交接说明  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — 模型与 `openclaw.json` 字段对齐说明  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — 近期稳定性与轮询 / OpenClaw 调用优化记录

<a id="install-guide"></a>

## 安装说明

两条都叫「安装」，但**装的不是同一套东西**。建议顺序：**① 看对照表 → ② 看「我该选哪条」→ ③ 只展开你选中的路线小节**。

### 路线对照（先选 A 还是 B）

| | **路线 A — 只要龙虾面板** | **路线 B — OpenClaw + 面板一条龙** |
|--|--|--|
| **你得到什么** | 本仓库的 **Web 控制台**（默认 **http://localhost:3003**） | **脚本 / 安装器流程**：检测或安装 CLI → **onboard** → 起网关 → 再起 standalone 面板 |
| **是否自带 OpenClaw** | **否**（需本机另有 OpenClaw，或起面板后按 **`/setup`** 引导） | **按文档执行**：流程里会装或复用 **openclaw** |
| **典型场景** | 已有 OpenClaw；或 **自己** 用官方方式装 CLI | **新环境**、**集成商** 要一条固定顺序交付 **CLI + 面板** |

**易混点：** **路线 A** 的 **桌面包**（Win **`.exe`** / Mac **`.dmg`**·`.zip` / Linux **AppImage**）都是 **只装面板**、同一套 Electron 行为。**路线 B** = **CLI 与面板按脚本串起来**，和「只装上述桌面包」**不是同一条路**。

### 我该选哪条？

1. 机器上 **已有** `openclaw` 与配置，只要自己管网关 → **路线 A**。  
2. **只要面板（任意系统）：** **路线 A**。可选 **① 桌面包**（与 Windows 同等：Electron 内嵌 Node、托盘、浏览器开 **`/setup`**）：在 **对应系统上** 于项目根执行 **`npm run electron:dist`**（或 `packaging/electron/build-electron.js` / `.sh`），产出 **Windows `.exe` / macOS `.dmg`·`.zip` / Linux AppImage**；**② 源码跑**：**Node 18+** 的 `npm run dev` / `npm run start`；**③ Docker**。  
3. **从零搭一套**，愿意按 **`packaging/openclaw-oneclick/`** 里的顺序走 → **路线 B**。

---

### 路线 A — 独立安装龙虾面板

**三系统均支持「只装面板」：** 同一套 Next 应用 + 同一套 Electron **`main.js`**（托盘、**`utilityProcess`** 起 standalone、浏览器默认打开 **`/setup`**），默认端口 **3003**。安装形态可选：**桌面包**（内嵌 Node，用户不必单独装 Node）或 **本机 Node / Docker**。

**重要（原生模块）：** 项目依赖 **better-sqlite3** 等原生绑定。**打桌面包或生产 standalone 时，必须在目标操作系统上执行 `npm run build`**（直接跑 `npm run electron:dist` 会在本机先 build）。勿把在 Windows 上构建的 `.next/standalone` 复制到 Mac/Linux 再打包，否则运行时会加载错平台的 `.node`。

读 Agent、网关健康、`/setup` 写配置等，仍需要合法的 **`OPENCLAW_HOME`**（含 **`openclaw.json`**）且通常需要 **网关**；若还没有，请 **单独安装** 官方 OpenClaw，或先起面板再跟 **`/setup`** 与官方文档补齐。

#### Windows

| 角色 | 做法 |
|------|------|
| **最终用户（不必单独装 Node）** | 在 **Windows** 上构建安装包：项目根 **`npm run electron:dist`**，或 [`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1) / [`build-electron.js`](packaging/electron/build-electron.js)。产物 **NSIS `.exe`** 在 [`packaging/electron/dist/`](packaging/electron/dist/)（历史版本可归档在 `dist/releases/`）。说明见 [`packaging/electron/README.md`](packaging/electron/README.md)。 |
| **开发者** | **Node 18+** → `npm install` → `npm run dev`。 |
| **本机生产 / 绿色部署** | `npm run build` 后 **`npm run start`**（或 `npm run packaging:prepare-standalone`；与 `.next/standalone` 下 **`node server.js`** 且 **PORT=3003** 一致）。 |

#### macOS

**支持。** **桌面包：** 在 **macOS 本机** 项目根执行 **`npm run electron:dist`**（或 `cd packaging/electron && ./build-electron.sh`），[`electron-builder.config.js`](packaging/electron/electron-builder.config.js) 会产出 **`.dmg` 与 `.zip`**（x64 / arm64）。行为与 Windows 安装版一致（内嵌 Node、托盘、浏览器 **`/setup`**）。未签名应用首次打开可能需在「隐私与安全性」中放行或使用右键打开。可选在 `packaging/electron/build/` 放置 **`icon.icns`** 或 **`icon.png`**（512×512 级）作为应用与托盘图标。  
**不用桌面包：** `npm run dev` / `npm run start`，或 **Docker 部署**。

#### Linux（含 Ubuntu）

**支持。** **桌面包：** 在 **Linux 本机** 项目根 **`npm run electron:dist`**（或 `packaging/electron/build-electron.sh`），默认产出 **AppImage**（[`electron-builder.config.js`](packaging/electron/electron-builder.config.js)）。行为同样与 Windows 一致。建议 **nvm** / **NodeSource** 安装 **Node 18+**（勿用过旧的 `apt nodejs`）。可选 `packaging/electron/build/icon.png` 作为图标。  
**不用桌面包：** 与 macOS 相同，**Node** 或 **Docker**。

**面板起来之后：** 浏览器打开 **http://localhost:3003**。配置目录非默认时，在项目根 **`.env.local`** 设置 **`OPENCLAW_HOME`**（见 **自定义配置路径**）。

---

### 路线 B — 一键流水线（OpenClaw + 龙虾面板）

**目录：** **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)**。

**流程概要：**

1. **冲突预检** — 已安装 `openclaw` 可跳过重复安装；可选检测网关端口（默认 **18789**）、龙虾 **3003**（详见该目录 README）。  
2. **安装 OpenClaw** — 封装调用官方 **`install.sh` / `install.ps1`**。  
3. **初始化** — 浏览器 **`http://localhost:3003/setup`**，或 **`wizard.env` + `run-onboard-from-env`** → **`openclaw onboard --non-interactive`**。  
4. **启动龙虾** — 先在本仓库 **`npm run packaging:prepare-standalone`**，再用 **`start-lobster-standalone`**.ps1 / .sh。  
5. **自动开页** — **`wait-gateway-open-dashboards`**.ps1 / .sh 等（见脚本说明）。

**按系统先读：**

| 系统 | 文档 |
|------|------|
| **Windows** | **[`WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)**（传统 EXE 向导 vs 先起 3003 再走 `/setup`）；维护者另见 **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)**、**[`docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md`](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)**。 |
| **macOS / Linux** | 同上 README：**`install-openclaw-macos-linux.sh`**、**`start-lobster-standalone.sh`**、**`wait-gateway-open-dashboards.sh`** 等。 |

**范围说明：**「双击一个安装器就内置便携 Node + CLI + 龙虾」的**成品**需在 **CI / 签名环境** 用 Inno、pkg、create-dmg 等整合；本仓库提供 **脚本与 ISS 骨架**，详见 openclaw-oneclick README 中 **DMG/EXE** 相关段落。

---

<a id="quick-start"></a>

## 快速开始

**还没选定路线时，请先读 [安装说明](#install-guide)。** 选定后的速查：**只要面板** → 路线 A（三系统均可 **`npm run electron:dist`** 打桌面包，或 **Node** / **Docker** 直接跑）；**从零装 CLI + 面板** → 路线 B 的 **`packaging/openclaw-oneclick/`**（Windows 务必读 **`WINDOWS_USER_JOURNEY`**）。

更多方式（提示词 / Skill 等）见：[快速启动文档](quick_start.md)。

本应用在 monorepo 中的路径为 **`软件SOFT/龙虾可视化控制面板`**。克隆 [Openclaw-SKILLS-OneOne-](https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git) 后：

```bash
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板

npm install
npm run dev
```

若你**只下载了本文件夹**，则直接进入该目录执行 `npm install` 与 `npm run dev` 即可。

- **默认端口 `3003`**（见 `package.json`）。
- **`npm run dev`（日常开发）** — 执行 **`next dev`**，带热更新；启动前会跑 **`scripts/check-dev-port.mjs`**，若 **3003** 已被占用则直接退出。
- **`npm run start`（生产模式）** — 本仓库 **`next.config`** 使用 **`output: "standalone"`**，**不要**单独使用 `next start -p 3003`（与 standalone 不匹配）。正确流程：
  1. **首次或改代码后**执行 **`npm run build`**（已包含将 `static` / `public` 同步进 **`.next/standalone`**）；
  2. 再执行 **`npm run start`**（实际由 **`scripts/start-prod.mjs`** 启动 **`.next/standalone/server.js`**，默认 **`PORT=3003`**、**`HOSTNAME=0.0.0.0`**）。
  - **仅停服务再开、代码未变**时，**不必**每次 `start` 前都 `build`。
- **`npm run stop`** — 结束占用 **3003** 的监听进程（`scripts/kill-port.mjs`）。
- **`npm run restart`** — **固定**先释放 **3003**，再以 **`PORT=3003`** 拉起生产服务（**`scripts/restart-prod.mjs`**）；**不会**自动执行 `build`，需已构建过。
- **浏览器访问：** 请优先使用 **`http://localhost:3003`** 或 **`http://127.0.0.1:3003`**。若用 **`http://192.168.x.x:3003`** 等局域网地址打开，敏感接口（如 **`/api/config`**）会校验 Host；需在项目根 **`.env.local`** 设置 **`CONFIG_ALLOW_LAN=1`**（见 **`.env.example`**）。**公网暴露**勿随意开启 **`SETUP_ALLOW_REMOTE=1`**。

其它命令：`npm run generate-pixel-assets`（像素资源）、`npm run i18n:merge-sea`（维护者合并东南亚语言分包）。更细的端口与重启说明见 **[quick_start.md](quick_start.md)**。

**路线 B / 维护者：** 一键包流程、环境变量与 Inno 说明见 **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)**。同类桌面体验可参考社区 **[OneClaw](https://github.com/oneclaw/oneclaw)**。

<a id="tech-stack"></a>

## 技术栈

- **Next.js 16**（App Router）+ **React 19** + TypeScript  
- **Tailwind CSS v4**  
- 主数据源：本地文件与 `OPENCLAW_HOME` 下的 `openclaw.json`  
- **可选：** `mysql2`，配置 MySQL 后可用同步与指标接口（见 `.env.example`）

## 环境要求

- **路线 A（源码跑）：** Node.js **18+**。  
- **路线 A（Windows `.exe`）：** 不要求用户单独安装 Node（运行时打在 Electron 内）。  
- **OpenClaw：** 完整功能需要本机已部署 OpenClaw（CLI + 通常需网关）；配置树通过 **`OPENCLAW_HOME`** 指向含 **`openclaw.json`** 的目录（默认 Unix 为 `~/.openclaw`，Windows 为 `%USERPROFILE%\.openclaw`）。

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

<a id="community"></a>

## 交流与社群

使用问题、安装排错、功能建议或合作交流，可扫码加入 **飞书群** 或添加 **微信**（二维码图片在仓库 [`docs/`](docs/) 目录，更新后请同步替换文件）。

| 飞书群 | 微信 |
|--------|------|
| ![飞书群二维码，扫码加入交流群](docs/飞书群.png) | ![微信二维码，扫码添加作者](docs/微信.png) |

也可在 GitHub 提 Issue / 私信作者。

## 作者联系方式（contact）
GitHub：[gaogg521](https://github.com/gaogg521)

感谢初始代码作者 [xmanrui](https://github.com/xmanrui)。

