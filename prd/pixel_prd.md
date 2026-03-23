我想把/Users/manruixie/code/pixel_agent/pixel-agents的功能复刻到/Users/manruixie/code/pixel_agent/OpenClaw-bot-review项目，在OpenClaw-bot-review项目新增一个页面实现该功能，请设计技术方案，先不用实现
技术方案如下：
## Pixel Agents 页面移植到 OpenClaw Bot Dashboard — 技术方案

### 一、目标

在 OpenClaw-bot-review（Next.js Web Dashboard）中新增一个 `/pixel-office` 页面，复刻 pixel-agents 的核心功能：像素风虚拟办公室，每个 OpenClaw Agent 对应一个动画角色，实时反映 Agent 工作状态。

### 二、核心差异与适配

| 维度 | 原版 (VS Code 插件) | 移植版 (Next.js Web) |
|---|---|---|
| 数据来源 | 监听 `~/.claude/projects/` 下的 JSONL 文件 | 通过 API 读取 OpenClaw 的 session 状态和 Agent 配置 |
| Agent 发现 | 手动创建终端 / 扫描 JSONL | 从 `openclaw.json` 读取所有 Agent 列表 |
| 状态推送 | VS Code Webview postMessage | SSE (Server-Sent Events) 或 WebSocket 轮询 |
| 运行环境 | VS Code Webview (受限浏览器) | 标准浏览器，无限制 |
| 资产加载 | 内嵌 base64 sprite data | 同样内嵌，或放 `/public` 静态资源 |

### 三、架构设计
app/
  pixel-office/
    page.tsx              ← 页面入口（client component）
    components/
      PixelOffice.tsx     ← 主组件，管理 Canvas + 游戏循环
      ToolOverlay.tsx     ← 工具状态浮层（复用原版逻辑）
      OfficeToolbar.tsx   ← 底部工具栏（布局编辑、缩放等）
  api/
    agent-activity/
      route.ts            ← SSE 端点，推送 Agent 实时状态
lib/
  pixel-office/
    engine/
      officeState.ts      ← 办公室状态管理（直接移植）
      characters.ts       ← 角色状态机（直接移植）
      gameLoop.ts         ← Canvas 游戏循环（直接移植）
      renderer.ts         ← 渲染器（直接移植）
    sprites/
      spriteData.ts       ← 像素精灵数据（直接移植）
      spriteCache.ts      ← 精灵缓存（直接移植）
    layout/
      tileMap.ts          ← 地图寻路 BFS（直接移植）
      layoutSerializer.ts ← 布局序列化（直接移植）
      furnitureCatalog.ts ← 家具目录（直接移植）
    types.ts              ← 类型定义（移植 + 适配）
    agentBridge.ts        ← 🆕 核心适配层：将 OpenClaw Agent 状态映射为角色动作

### 四、关键模块设计

#### 1. Agent 状态桥接层 (`agentBridge.ts`)

这是移植的核心适配层。原版通过解析 Claude Code 的 JSONL transcript 获取 Agent 状态，移植版需要改为从 OpenClaw 获取：
// Agent 活动状态（替代 JSONL 解析）
interface AgentActivity {
  agentId: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTool?: string        // 当前使用的工具名
  toolStatus?: string         // 工具状态描述
  lastActive: number          // 最后活跃时间戳
}

数据获取方式（两种方案选一）：
方案 A — 轮询：前端每 10s 调用 `/api/agent-activity`，后端读取 OpenClaw session 文件解析最新状态
方案 B — SSE 推送：后端 watch session 文件变化，通过 SSE 实时推送状态变更
建议用方案 A 起步（简单可靠），后续可升级为 SSE。

#### 2. 后端 API (`/api/agent-activity/route.ts`)
// 读取每个 Agent 的最新 session 状态
// 数据来源：
//   1. ~/.openclaw/sessions/ 目录下的 session 文件
//   2. 解析最近的消息记录判断 Agent 当前状态
//   3. 从 openclaw.json 获取 Agent 列表和模型信息

interface AgentActivityResponse {
  agents: Array<{
    id: string
    name: string
    emoji: string
    state: 'idle' | 'working' | 'waiting' | 'offline'
    currentTool?: string
    toolStatus?: string
  }>
}

#### 3. 游戏引擎层（直接移植）

以下模块可以几乎原封不动地移植，只需去掉 `vscode` 依赖：
`officeState.ts` — 办公室状态管理，角色增删、座位分配、碰撞检测
`characters.ts` — 角色状态机 (IDLE → WALK → TYPE)，BFS 寻路
`gameLoop.ts` — requestAnimationFrame 游戏循环
`renderer.ts` — Canvas 2D 渲染，z-sorting，精灵绘制
`sprites/` — 像素精灵数据和缓存
`layout/` — 地图、家具、寻路
#### 4. 前端主组件 (`PixelOffice.tsx`)
// 核心流程：
// 1. 从 /api/config 获取 Agent 列表 → 为每个 Agent 创建角色
// 2. 轮询 /api/agent-activity 获取实时状态 → 更新角色动画
// 3. Canvas 游戏循环渲染像素办公室
// 4. 点击角色 → 显示 Agent 详情 / 跳转到 session 页面

function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const officeRef = useRef<OfficeState>(new OfficeState())
  
  // 初始化：加载 Agent 列表，创建角色
  // 轮询：定时获取 Agent 状态，更新角色
  // 渲染：启动 gameLoop
}

#### 5. 侧边栏集成

在 `sidebar.tsx` 的 NAV_ITEMS 中新增：
{
  group: "nav.monitor",
  items: [
    // ... 现有项
    { href: "/pixel-office", icon: "🎮", labelKey: "nav.pixelOffice" },
  ],
}

### 五、状态映射规则

| OpenClaw Agent 状态 | 角色行为 |
|---|---|
| `working` (有活跃 session) | 坐在工位打字动画 (TYPE) |
| `working` + 使用 Read/Grep 工具 | 坐在工位阅读动画 |
| `idle` (>5min 无活动) | 起身闲逛 (IDLE → WALK) |
| `waiting` (等待用户输入) | 显示气泡提示 (💬) |
| `offline` (无 session) | 不显示 / 灰色静止 |

### 六、布局持久化

原版存在 `~/.pixel-agents/layout.json`，移植版可以：
存到 `~/.openclaw/pixel-office/layout.json`
通过 `/api/pixel-office/layout` 读写
### 七、实施步骤（建议顺序）
搭建页面骨架 — `/pixel-office/page.tsx` + 侧边栏入口 + i18n
移植引擎层 — 把 `lib/pixel-office/` 下的纯逻辑代码搬过来，去掉 vscode 依赖
回复 bot主理人: 
我想把/Users/manruixie/code/pixel_agent/pixel-agents的功能复刻到/Users/manruixie/code/pixel_agent/OpenClaw-bot-review项目，在OpenClaw-bot-review项目新增一个pixel-agents页面实现该功能，请设计技术方案，先不用实现
实现 Agent 状态 API — `/api/agent-activity`，读取 OpenClaw session 数据
实现桥接层 — `agentBridge.ts`，将 API 数据映射为角色状态
组装主组件 — Canvas 渲染 + 状态轮询 + 交互
布局编辑器 — 移植编辑模式（可作为 Phase 2）
### 八、工作量估算
Phase 1（核心功能）：引擎移植 + API + 基础页面 → 约 2-3 天
Phase 2（完整体验）：布局编辑器 + 音效 + 子 Agent 可视化 → 约 1-2 天
---

这个方案的核心思路是：游戏引擎层几乎原样搬，重点工作在于用 OpenClaw 的 Agent/Session 数据替代原来的 Claude Code JSONL 解析。要开始实现吗？