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

---

*记录日期：2026-03（与代码注释一致时可随提交更新）*
