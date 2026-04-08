# 专家工作室「下班了」与飞书「已上线」不一致 — 说明与修复记录

## 现象

- 飞书里主 Agent 已通知子 Agent，群内也有回复，界面显示「已查岗 / 在响应」。
- **像素办公室（专家工作室）** 仍显示多数专家 **「下班了」**（`offline`），仅个别为「摸鱼中」等。

## 原因（数据口径不同）

- 专家工作室轮询 **`GET /api/agent-activity`**，用 `lastActive` 推导 `idle | working | offline`（约 2 分钟 / 10 分钟窗口）。
- 修复前，`lastActive` 的本机部分 **只取** `sessions` 目录与 **`sessions.json` 文件的 stat mtime**。
- 飞书回复后，OpenClaw 通常会在对应会话的 **`.jsonl`** 里写入 `type: "message"`（含用户侧），并可能更新 **`sessions.json` 内各条的 `updatedAt`**；这些 **不一定** 让目录或整文件 mtime 及时反映出来。
- 因此：**IM 层已活跃**，但 **活动接口仍认为「很久没动」** → 显示下班。

## 修复（与 agent-status / 告警对齐）

在 **`app/api/agent-activity/route.ts`** 中，本机活跃时间改为：

1. **`getAgentLastActivityMs(agentId)`**（`lib/agent-session-activity.ts`）：合并 `sessions.json` 内所有 **`updatedAt`**，以及近期 **`.jsonl`** 中任意 **`message` 的时间戳**（**飞书用户回复即会计入**）。
2. 与 **`getAgentSessionsDirMaxMtimeMs(agentId)`** 取 **`Math.max`**，再与 **Gateway** 提示时间取大（逻辑不变）。

## 安全注意（避免历史事故）

- **禁止**为刷活动数据而 **并行多路** `callOpenclawGateway` / `openclaw` 子进程；历史上曾导致 **大量 Node 进程** 堆积。Gateway 侧须保持 **`lib/gateway-agent-activity-hint.ts`** 的 **串行** 策略。
- 本修复 **仅增加同步读盘与 JSON 解析**，**不**新增子进程。

## 仍可能不一致的情况

若飞书消息 **未写入该 `agentId` 目录下**的 session/jsonl（例如会话挂在别的 agent、或网关未落盘），活动接口仍无法显示在线——需检查 OpenClaw 的 session 归属与落盘路径。

## 2026-04：按飞书群合并到「专家」Agent

当 **所有 OC 群会话都落在总指挥（如 `main`）目录**、而 `agents.list` 里仍有各「专家」id 时，仅靠各专家自己的 `sessions/` 会一直显示 **下班**。

**`/api/agent-activity`** 会：

1. 汇总 **所有** 已配置 Agent 的会话目录中，`sessions.json` / 近期 `.jsonl` 里形如 `agent:*:feishu:group:<open_chat_id>` 的 **最后活跃时间**（按群 id 聚合）；
2. 对每个专家，读取 **`openclaw.json` → `bindings`** 中该 `agentId` 且 `channel === "feishu"` 的条目，尝试解析 **群 open_chat_id**（如 `oc_…`，见 `lib/feishu-group-activity-boost.ts` 的多种字段兼容）；
3. 将对应群的活跃时间 **合并进** 该专家的 `lastActive`，再算 `working / idle / offline`。

若 bindings 里 **没有** 群 id（只有账号级绑定），可在 **`agents.list` 对应条** 上增加可选字段（与 OpenClaw 官方 schema 无关，仅本面板读取）：

- `feishuOpenChatId` 或 `feishuGroupId`，或  
- `identity.feishuOpenChatId` / `identity.feishuGroupId`  

值为该专家负责的飞书群 **open_chat_id**（与 session key 中段一致）。

---

*记录日期：2026-03（与代码注释一致时可随提交更新）；2026-04 补充群合并逻辑说明*
