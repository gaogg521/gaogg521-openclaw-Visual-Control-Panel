<div align="center">

# 🦞 ONE CLAW 龙虾可视化控制台

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
  <a href="#ecosystem">相关生态</a>
  &nbsp;·&nbsp;
  <a href="#community">交流</a>
</p>

<img src="docs/bot_dashboard.png" alt="ONE CLAW 仪表盘：网关、趋势、专家任务" width="780" />

</div>

---

> **不想先啃长文档？** **Windows** 可装 **NSIS `.exe`**（内嵌 Node，自动起 **3003**）；**Mac / Linux** 用 **Node 18+** 执行 `npm run dev` 或 **Docker**。完整能力依赖本机 **OpenClaw**；**「只装面板」** 与 **「OpenClaw + 龙虾一键流水线」** 两条路线见下文 **[安装说明](#install-guide)**。

### ✨ 为什么选这套控制台？

| 🚀 亮点 | 说明 |
|--------|------|
| 🎯 **一站式运维** | 网关健康、Token/耗时趋势、告警、会话、专家战队同屏可达 |
| 🖥️ **专家工作室** | 经典办公室 / 星际舰桥 / 蘑菇林地三套像素场景，热力图与摸鱼榜 |
| 🤖 **模型实验台** | 谁在用什么模型、探测、内网预设、通过后写入 `openclaw.json` |
| 🌍 **六语五主题** | 简繁英 + 马来 / 印尼 / 泰；五套全局皮肤持久化 |
| 📦 **双轨安装** | **A** 独立龙虾面板（Win `.exe` / 源码 / Docker）· **B** [`openclaw-oneclick`](packaging/openclaw-oneclick/) 一键脚本与 Inno 骨架 |
| 🔧 **CLI 友好** | 不替代官方终端；需要时照常使用 `openclaw` |

<a id="ecosystem"></a>

### 相关生态 · 同类优秀项目

| 项目 | 说明 |
|------|------|
| **[OpenClaw](https://github.com/openclaw/openclaw)** | 官方智能体网关与 CLI |
| **[OneClaw](https://github.com/oneclaw/oneclaw)** | 「一分钟装好」的 **桌面客户端**：内置 Gateway 与 Node，适合零命令行用户（与本仓库 **Web 控制台** 路线互补） |
| **[OpenClaw-Admin](https://github.com/itq5/OpenClaw-Admin)** | 基于 **Vue 3** 的网关管理台，另一种可视化实现 |

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

以下截图均来自本仓库 **[`docs/`](docs/)** 目录。**更新界面后请同步替换 `docs/` 内图片**。英文版说明与对照见 **[README.en.md](README.en.md)**。说明文字已按当前截图内容微调；**`dashboard.png` 等文件名是历史遗留，画面实为「专家战队」栅格而非纯数字首页**。

### 仪表盘总览与专家战队
**`bot_dashboard.png`** — **仪表盘**：版本与**网关**卡片、配置路径与端口、**全局 Token/耗时趋势**、渠道与会话类型分布、**最近同步**、**Agent 任务状态**；顶栏 **CLAW 诊断**、**重启 OneOneClaw**、**查看 CLAW 状态**。

**`dashboard.png` / `dashboard-preview.jpg`** — **专家战队**卡片墙：在线/空闲/离线、绑定**模型**、**飞书**等平台、会话/消息/Token、小趋势图；宽图常带 **会话预览** 浮层（群聊/私聊与 Token 提示）。

![OneOne 仪表盘 — 网关、趋势、分布、任务追踪](docs/bot_dashboard.png)
![专家战队 — 多 Agent 卡片、模型与平台指标](docs/dashboard.png)
![专家战队 — 宽屏布局与会话预览](docs/dashboard-preview.jpg)

### 模型、会话与记忆管理
**模型页** — **接入模型列表**：主模型/兜底、**各模型被哪些专家占用**、探测预设、临时 Key、**探测通过后写配置**、Provider 表格（如 LiteLLM）。**会话列表** — 按 Agent 查看 **主会话 / 飞书群私聊 / 定时任务**、上下文 **占用比例**、单条**测试**。**记忆管理** — **Markdown 归档** 与 **SQLite 实时** 双轨路径、在线编辑 **`MEMORY.md`** 并保存。

![模型 — Provider、Agent 绑定、新增与探测](docs/models-preview.png)
![会话 — Agent 维度、飞书/cron、上下文百分比](docs/会话列表.png)
![记忆 — 双路径说明与 MEMORY 编辑器](docs/记忆管理.png)

### 专家工作室（像素地图）与三套游戏场景
**`pixel-office.png`** — **专家工作室**画布：俯视**像素场景**、**游戏场景**下拉（如**星际舰桥**）、专家**名牌**（工作中/摸鱼/下班等）、值班 SRE 等装饰。下列三图为 **经典办公室 / 星际舰桥 / 蘑菇林地** 三套美术与拓扑。

![专家工作室 — 像素地图、场景切换、状态条](docs/pixel-office.png)
![游戏场景 · 经典办公室（原版素材）](docs/游戏场景-办公室.png)
![游戏场景 · 星际舰桥与星空背景](docs/游戏场景-星际剑桥.png)
![游戏场景 · 蘑菇林地溪流可走格](docs/游戏场景-蘑菇林地.png)

### 专家战队与专家文件合规
**专家战队** — 多专家卡片、**手动刷新**档位、**我要聊天**、默认模型说明。**备选图** 含 **群聊卡片**、**Fallback 模型**、**Agent 任务监控**（定时任务成功/失败）。**专家文件管理** — 各 Agent 必备 Markdown 清单、**合规率**、缺失 **ROLE.md** 等标红、**一键补全并部署**。

![专家战队 — 卡片墙与刷新策略](docs/专家战队.png)
![专家战队 — 群聊绑定、兜底模型、定时任务](docs/专家战队2.png)
![专家文件 — 清单合规与补全入口](docs/专家文件管理.png)
![专家文件 — 备选合规视图](docs/专家文件管理1.png)

### 专家战队聊天（浏览器内）
选择 **专家 + 会话** → **连接会话**，可选 **极速模式**（轻量短回复）。气泡内可出现总指挥的**长文战报/项目同步**。**清空本地记录** 仅清除**浏览器本地**聊天记录，不等于 OpenClaw 侧历史。

![专家战队聊天 — 会话就绪与回复流](docs/快速聊天对话.png)
![专家战队聊天 — 长文状态同步示例](docs/快速聊天对话2.png)

### Claw 诊断与运行状态（仪表盘入口）
**CLAW 诊断** — 弹窗内为类终端的 **`openclaw doctor`** 输出：网关地址、**端口占用** 与 **PID**（如 `node.exe`）。**查看 CLAW 状态** — 类似 **`openclaw gateway status`** 日志、RPC/stderr 提示与 **官方排障链接**。

![CLAW 诊断弹窗 — doctor、端口冲突](docs/claw诊断.png)
![查看运行状态 — gateway 日志与 PID](docs/查看claw运行状态.png)

### 主题与多语言（五套主题 · 六种界面语言）
侧栏 **语言** 与 **`data-theme`** 皮肤（如橙色暖调、极简暗黑）；下列为 **繁体中文** 与 **东南亚语言** 界面样例。

![主题 — 暖色外壳与切换器](docs/主题变化.png)
![界面 · 繁体中文](docs/繁体.png)
![界面 · 马来语](docs/马来语.png)
![界面 · 印尼语](docs/印尼语.png)
![界面 · 泰语](docs/泰语.png)

### 告警、模型切换、统计、通道
**告警中心** — 总开关、**接收告警的专家**列表、规则：**模型不可用**、**长时间无响应**、**消息失败率**、**定时任务连续失败**及静默时长。其余页：**切换模型**、**消息统计**图表、**通道管理**列表。

![告警中心 — 规则与接收专家](docs/告警中心.png)
![模型切换 — 单卡绑定/切换入口](docs/模型切换.png)
![消息统计 — Token 与耗时趋势](docs/消息统计.png)
![通道管理 — 通道绑定总览](docs/通道管理.png)

### 极简安装向导
**首屏** — 检测到 **CLI 版本**、五步路径说明（**提供商 → 密钥 → 确认 → Gateway**）、**密钥仅在本机** 提示。**极简安装2–4** 为后续步骤（选厂商、填 Key、确认摘要、完成与检查）。

![极简安装 — CLI 预检与开始配置](docs/极简的安装.png)
![极简安装 — 提供商与密钥步骤](docs/极简安装2.png)
![极简安装 — 确认摘要](docs/极简安装3.png)
![极简安装 — 完成与网关检查](docs/极简安装4.png)

### `docs/` 目录下的说明文档（非截图）
- [DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md) — Windows 打包与安装器交接说明  
- [openclaw-models-config.md](docs/openclaw-models-config.md) — 模型与 `openclaw.json` 字段对齐说明  
- [RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md](docs/RECENT_OPTIMIZATIONS_2026-03-27.zh-CN.md) — 近期稳定性与轮询 / OpenClaw 调用优化记录

<a id="install-guide"></a>

## 安装说明（两种路线，请先看清）

下面两种都叫「安装」，但**不是同一件事**，请按你的场景选一行：

| 路线 | 装的是什么 | 典型用户 |
|------|------------|----------|
| **A — 独立安装龙虾面板** | 只装 **Web 控制台**（本仓库 Next.js），默认访问 **http://localhost:3003**。**安装包本身不自带** OpenClaw CLI / 网关二进制（除非你另外做捆绑）。 | **只要可视化面板**；机器上 **已有** OpenClaw，或你会 **另外** 用官方方式装 OpenClaw。 |
| **B — 一键安装包（OpenClaw + 龙虾面板）** | 按文档/脚本顺序：**装或检测 OpenClaw CLI** → **onboard** → **起网关** → **起龙虾 standalone** → 打开页面（可配合 Inno 等打成「一个安装器」）。 | **新机一条龙**，或你要 **一条固定流水线** 把 CLI 与面板一起交付。 |

---

### A — 独立安装龙虾面板（仅控制台）

**「支持 Windows / Linux / macOS」** 在这里指：**龙虾面板这套 Next 应用能在该系统上跑起来**。完整能力（读 Agent、网关健康、`/setup` 写配置等）仍需要本机有合法的 **`OPENCLAW_HOME`**（含 **`openclaw.json`**）且通常需要 **OpenClaw 网关**在跑——OpenClaw 请 **单独安装**（官方脚本/包管理器），除非你走下面的 **路线 B**。

| 系统 | 是否支持独立面板 | 本仓库提供的安装方式 |
|------|------------------|----------------------|
| **Windows** | **支持** | **最终用户（不必单独装 Node）：** 安装 NSIS 产物 **`ONE Claw … Setup ….exe`**（[`packaging/electron/build-electron.ps1`](packaging/electron/build-electron.ps1) 构建，输出 [`packaging/electron/dist/`](packaging/electron/)）。Electron 内嵌 Node，跑 standalone Next，端口 **3003**；说明见 [`packaging/electron/README.md`](packaging/electron/README.md)。**开发者：** 安装 **Node 18+**，克隆后 `npm install`、`npm run dev`。**绿色运行：** `npm run packaging:prepare-standalone` 后，在 `.next/standalone` 下用 `node server.js`（需与 dev 一致可设 **PORT=3003**）。 |
| **macOS** | **支持** | 本仓库 **未** 提供现成 **`.dmg` / `.app`**（[`electron-builder.config.js`](packaging/electron/electron-builder.config.js) 当前仅 **Windows NSIS**）。请使用 **Node 18+** + 克隆 + `npm install` / `npm run dev`，或 **Docker**（见下文 **Docker 部署**）。若要 Mac 桌面包，需在 macOS 上为 electron-builder 增加 **`mac`** 目标自行构建。 |
| **Linux（含 Ubuntu）** | **支持** | 与 macOS 相同：**Node 18+** + 源码（Ubuntu 建议 **nvm** / **NodeSource**，勿依赖过旧的 `apt nodejs`）或 **Docker**。本仓库 **不** 默认产出 **AppImage / .deb**；需要时请增加 **`linux`** 目标自行打包。 |

**面板起来之后：** 浏览器打开 **http://localhost:3003**。若尚未安装 OpenClaw，请先按 **官方文档** 安装 CLI，或在面板已启动时使用 **`/setup`**（预检会提示剩余步骤）。配置目录非默认时，在项目根 **`.env.local`** 设置 **`OPENCLAW_HOME`**（见 **自定义配置路径**）。

---

### B — 一键安装包（OpenClaw + 龙虾面板）

这与「只装龙虾 `.exe`」**不是同一条路线**。实现与说明在 **[`packaging/openclaw-oneclick/`](packaging/openclaw-oneclick/)**，核心顺序是：

1. **冲突预检**：已安装 `openclaw` 可跳过重复安装；可选检测 **网关端口（默认 18789）**、**龙虾 3003**（详见该目录 README）。  
2. **安装 OpenClaw**：封装调用官方 **`install.sh` / `install.ps1`**。  
3. **初始化**：浏览器 **`http://localhost:3003/setup`**，或 **`wizard.env` + `run-onboard-from-env`** 执行 **`openclaw onboard --non-interactive`**。  
4. **启动龙虾**：需先在本仓库执行 **`npm run packaging:prepare-standalone`** 生成 standalone，再用 **`start-lobster-standalone`**.ps1 / .sh。  
5. **自动开页**：**`wait-gateway-open-dashboards`**.ps1 / .sh 等（见脚本说明）。

| 系统 | 用户/集成商应先读 |
|------|-------------------|
| **Windows** | **[`WINDOWS_USER_JOURNEY.zh-CN.md`](packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)**（传统 EXE 向导 vs 先起 3003 再走 `/setup`）；维护者另见 **[`packaging/openclaw-oneclick/README.md`](packaging/openclaw-oneclick/README.md)**、**[`docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md`](docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)**。 |
| **macOS / Linux** | 同上 README 中的 **`install-openclaw-macos-linux.sh`**、**`start-lobster-standalone.sh`**、**`wait-gateway-open-dashboards.sh`** 等。 |

**范围说明：**「双击一个 DMG/EXE 就包含便携 Node + CLI + 龙虾」的**成品安装器**需要你在 **CI/签名环境** 用 Inno、pkg、create-dmg 等整合；本仓库提供 **脚本与 ISS 骨架**，详见 openclaw-oneclick README 中关于 **DMG/EXE** 的段落。

---

<a id="quick-start"></a>

## 快速开始

### 对照「安装说明」怎么选？

- **只要面板、Windows、不想装 Node：** → **路线 A** → 龙虾 **`.exe`**。  
- **只要面板、Mac / Linux：** → **路线 A** → **Node + npm** 或 **Docker**。  
- **从零装 CLI + 面板：** → **路线 B** → **`packaging/openclaw-oneclick/`**（Windows 务必读 **`WINDOWS_USER_JOURNEY`**）。

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

