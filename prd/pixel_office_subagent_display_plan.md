# 像素办公室 Subagent 展示方案（仅设计）

## 1. 背景与现状

当前像素办公室已有部分 subagent 基础能力：

- `/api/agent-activity` 已能返回 `subagents[]`（基于 session 日志里的 `tool_use/tool_result` 推断）。
- `syncAgentsToOffice` 已支持 subagent 的创建与移除（`addSubagent/removeSubagent`）。
- 但页面顶部 Agent 区域只展示主 Agent，不展示 subagent。
- subagent 在画布中虽可创建，但名称未统一为“外包”。

因此用户感知上仍是“看不到 subagent 生命周期”。

## 2. 目标

- 像素办公室页面显式展示 subagent。
- subagent 统一命名为：`外包`。
- subagent 在像素办公室中始终以 `working` 状态像素人展示（不进入 idle/waiting/offline）。
- subagent 创建时开始显示，结束时立即消失（以当前轮询粒度为准）。
- 同时兼容手机端与桌面端现有布局逻辑。

## 3. 非目标

- 不改动机器人主页（`/`）的卡片结构。
- 不新增复杂权限模型或独立 subagent 配置页。
- 不重构现有渲染引擎/寻路逻辑。

## 4. 核心方案

## 4.1 数据层（API）

继续使用 `/api/agent-activity` 返回 `subagents`，但规范为“只返回活跃 subagent”：

- 创建判定：出现 `tool_use` 且匹配 subtask/subagent 模式。
- 结束判定：出现对应 `tool_result` 后从活跃集合移除。
- 当父 Agent 进入 `idle/offline` 时，强制返回 `subagents = []`（避免残留）。

建议返回结构保持不变（最小改动）：

```ts
subagents?: Array<{
  toolId: string
  label: string // 前端暂不使用，统一展示“外包”
}>
```

## 4.2 同步层（agentBridge / officeState）

- 保持现有 `toolId` 作为 subagent 生命周期主键。
- `syncAgentsToOffice` 继续基于 diff 执行：
  - 新出现 `toolId` => `addSubagent`
  - 消失 `toolId` => `removeSubagent`
- 在创建 subagent 后统一设置 `ch.label = '外包'`。
- 在创建 subagent 后强制设置为工作态：
  - `office.setAgentActive(subId, true)`
  - 不设置 waiting bubble
  - 不接入主 Agent 的 idle/offline 状态流转
- 移除时沿用现有 despawn 动画与 seat 释放逻辑。

## 4.3 展示层（像素办公室页面）

顶部 Agent 区域新增“主 Agent + subagent”的统一展示流：

- 将 `agents` 扁平化为 `displayAgents`：
  - 主 Agent：沿用当前显示。
  - subagent：生成虚拟展示项，建议 key 为 `${agentId}:${toolId}`。
- subagent 展示规范：
  - 名称固定：`外包`
  - 状态固定映射：`working`
  - 样式可与 working Agent 相同，但加轻量标识（如 `SUB` 小角标，非必须）。

移动端 3x3 分页与桌面端换行逻辑均直接消费 `displayAgents`，不需要额外分支。

## 5. 生命周期定义

- “开始显示”：本轮 `agent-activity` 轮询返回该 `toolId`。
- “结束消失”：本轮轮询不再返回该 `toolId`，或父 Agent 非 working。
- “状态定义”：subagent 在存在期间始终视为 `working`，不做中间态切换。
- 一致性策略：前端不做长缓存，不做延迟保留，严格跟随轮询结果。

## 6. 边界情况

- 同一父 Agent 多个 subagent 并发：显示多个“外包”条目（允许重名）。
- 父 Agent 离线：主 Agent 与其 subagent 全部移除。
- 日志解析失败：该轮 subagent 为空，不阻塞主 Agent 展示。
- 快速创建/结束（小于轮询间隔）：可能被跳过；属于轮询制约，非功能错误。

## 7. 验收标准（DoD）

- 父 Agent 产生 subtask 后，像素办公室顶部出现“外包”条目。
- subtask 完成后，“外包”条目消失。
- 画布中对应 subagent 名称显示为“外包”。
- subagent 在画布和顶部列表中始终显示为 working 态（无 idle/waiting/offline）。
- 手机端和桌面端都可见且布局不乱。
- 不影响现有主 Agent 状态、提示气泡、统计面板与性能。

## 8. 实施步骤（建议）

1. API：校准活跃 subagent 集合输出与父 Agent 状态联动。  
2. Bridge/Office：创建时统一命名 `外包`，结束即移除。  
3. Pixel Office UI：引入 `displayAgents` 扁平渲染。  
4. 联调与回归：手机/桌面、单 subagent/多 subagent、切页返回场景。  

---

本方案为设计稿，当前不包含代码实现。
