# 近期优化与问题修复记录（约 2026-03-27）

本文档汇总本轮针对 **Node 进程暴增**、**轮询堆叠**、**OpenClaw 网关探测** 与 **仪表盘重启体验** 的修改，便于回溯与 Code Review。

**位置：** 与本目录其它说明文档一同存放在 **`docs/`**；根目录 **[README.md](../README.md)** 中有摘要与链接。

---

## 一、背景与根因（摘要）

1. **任务管理器出现数百个 Node、内存飙升**  
   - 专家工作室等对 `/api/agent-activity` 使用 **`setInterval(1s)` 且不等待上一轮 `fetch` 结束**，接口单次常需数秒，导致 **HTTP 请求无限堆叠**。  
   - `lib/gateway-agent-activity-hint.ts` 中 **`fetchGatewayAgentActivityMap` 曾用 `Promise.allSettled` 并行 6 路 `callOpenclawGateway`**，单次请求最多同时拉起 **6 个 openclaw/node 子进程**；再叠加上层 **`withTimeout(1200ms)` 提前返回** 时，后台 Promise 仍继续跑满多路，子进程 **持续堆积**。  
   - `/api/gateway-health` 单次可达十余秒，但多处 **`setInterval(10s~15s)`** 同样不等待完成，会 **叠多单** 并重复 `exec openclaw`。

2. **重启 OneOneClaw 体验差**  
   - 原 `/api/openclaw/restart` 为 **整段执行完再 JSON 返回**，浮层长时间停在「执行中…」。  
   - 成功后 **`await fetchStatus()`** 会间接拉很慢的 **`/api/openclaw/status` → `/api/gateway-health`**，`finally` 迟迟不执行，按钮一直 **「重启中…」**。

3. **说明**  
   - 调试过程中对 **3003 端口** 的 `taskkill` 仅针对 **Next.js 开发服务**，**不是**故意结束 OpenClaw Gateway（通常为 **18789** 等端口）。

---

## 二、已落地修改（按模块）

### 1. 开发启动与端口

| 文件 | 变更 |
|------|------|
| `scripts/check-dev-port.mjs` | 启动前检测 **3003** 是否占用，避免重复 `next dev` 叠多棵进程树；可通过环境变量 `LOBSTER_DEV_PORT` 覆盖端口。 |
| `package.json` | `dev` 脚本改为：`node scripts/check-dev-port.mjs && next dev -p 3003`。 |

### 2. 专家工作室（Pixel Office）— `/api/agent-activity` 轮询

| 文件 | 变更 |
|------|------|
| `app/pixel-office/page.tsx` | 将 **`setInterval(fetchAgents, 1000)`** 改为 **`while` + 上一轮结束后再 `sleep(间隔)`** 的串行轮询；**`AbortController`**：组件卸载时 `abort` 进行中的 `fetch`，减轻 Strict Mode 双挂载时的重叠请求。 |

### 3. 服务端 — 合并并发、减少重复计算

| 文件 | 变更 |
|------|------|
| `app/api/agent-activity/route.ts` | **Single-flight**：重叠的 `GET` 共用一次 `computeAgentActivityPayload()`，各请求再各自 `NextResponse.json`（避免多个 `Response` 共享同一 body 流）。 |
| `app/api/gateway-health/route.ts` | 将计算逻辑抽为 `computeGatewayHealthPayload()`，同样 **single-flight** 合并重叠请求。 |

### 4. Gateway 活动时间 — 进程扇出治理（核心）

| 文件 | 变更 |
|------|------|
| `lib/gateway-agent-activity-hint.ts` | **`fetchGatewayAgentActivityMap`**：由 **6 路并行** 改为 **串行** 调用各 RPC，任意时刻 **最多 1 个** openclaw 子进程；支持可选 **`AbortSignal`**，超时后不再启动后续方法。 |
| `app/api/agent-activity/route.ts` | 用 **`AbortController` + `Promise.race(1200ms)`** 替代原先「超时即返回空 Map、后台仍跑满 6 路」的 `withTimeout` 用法。 |
| `lib/openclaw-cli.ts` | **`callOpenclawGateway`**：为 **`execOpenclaw` 传入 `timeoutMs`**（在 CLI `--timeout` 之外增加 Node 侧硬超时，避免子进程悬挂）。 |

### 5. 其它页面的轮询与网关健康

| 文件 | 变更 |
|------|------|
| `app/gateway-status.tsx` | **`/api/gateway-health`**：由 `setInterval` 改为 **串行循环**（完成后再等待间隔）。 |
| `app/pixel-office/page.tsx` | **`refreshGatewayHealthSnapshot`**：同样改为 **串行循环**。 |
| `app/setup/page.tsx` | 安装向导步骤 4 的网关健康轮询改为 **串行**（先拉一次再每 15s）。 |
| `app/page.tsx`、`app/oneone-dashboard/page.tsx` | **`fetchAgentActivity`**：由 `setInterval(30s)` 改为 **串行 + 30s 间隔**，避免慢请求叠单。 |

### 6. 仪表盘 — 状态刷新与重启 OpenClaw

| 文件 | 变更 |
|------|------|
| `app/oneone-dashboard/page.tsx` | **`fetchAgentActivity` / `fetchStatus`** 上移至 **`restartOneOneClaw` 之前**；**`fetchStatus`** 使用 **`useCallback([t, fetchAgentActivity])`**；重启成功后 **`void fetchStatus(true)`** 后台刷新，**不再 `await`**，避免卡住「重启中…」；首屏 `useEffect` 依赖 **`fetchStatus`**。 |
| `app/api/openclaw/restart/route.ts` | **流式实现**：与 `gateway-status` / `doctor` 一致，**`spawn` + `ReadableStream`** 推送 stdout/stderr；**stdout/stderr 原样合并转发**（不加 `[stderr]` 前缀）、**继承环境变量**（不再强制 `FORCE_COLOR: "0"`）；子进程结束后若疑似 **健康检查超时** 则 **`probeGatewayChatReachable`**，必要时追加 **`[note]`** 并将 **`[exit_code]`** 视为成功以便前端不误判。 |
| `app/oneone-dashboard/page.tsx` | 重启按钮改为 **`streamShellFromApi("/api/openclaw/restart")`**；**`openShell` 初始行**仅保留 **`$ openclaw gateway restart`**（去掉占位说明文案）。 |
| `app/oneone-dashboard/page.tsx` — `streamShellFromApi` | 流式解码：按 **`\r\n|\n|\r`** 切行；**不展示**协议行 **`[exit_code]`**（仍解析用于成功/失败）；改善 **`\r` 进度行** 与 CMD 观感不一致的问题。 |

（历史中间态曾为 **`execOpenclawWithExitCode` + 180s 超时** 的 JSON 版重启接口，已由 **流式路由** 替代。）

---

## 三、行为与权衡

| 项目 | 说明 |
|------|------|
| **稳定性** | 显著降低 **并发 openclaw 子进程** 与 **重复磁盘/网关计算**，避免任务管理器出现 **上百 Node**。 |
| **延迟** | Gateway 活动改为 **串行** 后，单次合并 RPC **总耗时可能变长**；与健康检查、告警等场景需接受 **略慢换稳**。 |
| **开发体验** | `npm run dev` 若 3003 已被占用会直接失败，需先停旧实例。 |
| **重启输出** | 流式仍受 **子进程自身缓冲**（非 TTY）影响；与真实 CMD 完全一致需 **伪终端** 等更重方案，当前为 **尽力对齐**。 |
| **端口冲突** | 若 **18789** 已被其它 `node` 占用，`gateway restart` 在 CMD 与仪表盘均会失败，需单独排查占用进程。 |

---

## 四、主要涉及路径速查

```
scripts/check-dev-port.mjs
package.json
app/pixel-office/page.tsx
app/api/agent-activity/route.ts
app/api/gateway-health/route.ts
lib/gateway-agent-activity-hint.ts
lib/openclaw-cli.ts
app/gateway-status.tsx
app/setup/page.tsx
app/page.tsx
app/oneone-dashboard/page.tsx
app/api/openclaw/restart/route.ts
```

---

## 五、后续可选方向（未做）

- 为 **`execOpenclaw` 全局队列**（同一时间仅 1 个 CLI），进一步防止极端并发（会牺牲吞吐）。  
- **`/api/openclaw/status` 自拉 `/api/gateway-health`** 的链路是否改为直连探测，减少 **自引用 HTTP** 与排队。  
- 重启流式使用 **`node-pty`** 等伪终端，进一步贴近 CMD 的逐字输出（依赖与维护成本更高）。

---

*文档根据会话内实际修改整理；若与仓库后续提交不一致，以 Git 历史为准。*
