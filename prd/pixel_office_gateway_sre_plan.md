# Pixel Office - Gateway 健康态 SRE 像素人方案（仅设计）

## 1. 目标
- 在像素办公室增加一个与 OpenClaw `gateway` 健康状态强绑定的像素人类型：`SRE 值班工程师（救火队长）`。
- 通过可视化行为让用户一眼识别网关状态变化（正常/退化/故障），提升可观测性与“游戏化”反馈。
- 本方案只做设计，不做实现。

## 2. 非目标
- 不在本次引入自动重启 gateway、自动修复策略。
- 不修改现有 agent/subagent 业务状态语义。
- 不改变 PC/手机端现有布局结构（只加角色和行为层）。

## 3. 角色定义
- 角色名：`值班SRE`
- 显示文案：
  - 中文：`值班SRE`
  - 英文：`On-call SRE`
- 唯一性：每个像素办公室页面仅 1 个该类型像素人（系统角色，不占普通 agent 名额）。

## 4. 状态模型（Gateway -> 像素人）
定义三态：

1. `healthy`（健康）
- 条件：`/api/gateway-health` 返回 `ok=true`，且请求耗时低于阈值。
- 行为：低速巡检（固定区域慢速走动），绿色标签。

2. `degraded`（退化）
- 条件（建议）：
  - 连续 N 次（建议 2 次）请求超时接近上限；或
  - `ok=true` 但响应耗时超过阈值（建议 >1500ms）。
- 行为：警戒巡检（更快移动 + 黄色闪烁），优先靠近 gateway 区域。

3. `down`（故障）
- 条件：`ok=false`（如 ECONNREFUSED/超时/HTTP 非 2xx）。
- 行为：快速冲刺到“救火点”（gateway 工位附近）并停留，红色闪烁标签。

恢复策略：
- `down/degraded -> healthy` 需满足连续 M 次（建议 2 次）健康结果，避免抖动。

## 5. 数据流设计
当前已有接口：`GET /api/gateway-health` 返回 `{ ok, error?, data?, webUrl? }`。  
建议扩展（向后兼容）：
- `checkedAt`：毫秒时间戳
- `responseMs`：本次健康检查耗时
- `status`：`healthy | degraded | down`（若后端不算，则前端根据 `ok + responseMs + 连续失败计数`计算）

轮询策略：
- 复用现有 10s 轮询节奏（避免额外压力）。
- 像素办公室内部与顶部网关状态组件共享同一份健康态缓存（单次请求，多处消费）。

## 6. 像素办公室行为设计
### 6.1 出生与常驻
- 页面加载后创建系统角色 `sre-gateway-1`。
- 若 gateway 状态未知：角色在“待命位”静止（灰色标签“监控中”）。

### 6.2 行为区域
- 巡检区：右办公室上半区 + 通道口（避免进入休息区造成干扰）。
- 救火点：右办公室 gateway 相关工位附近（建议现有 `pc-r` 附近 tile）。

### 6.3 动画与速度
- `healthy`：`moveSpeedMultiplier=0.9`
- `degraded`：`moveSpeedMultiplier=1.4` + 标签闪烁
- `down`：`moveSpeedMultiplier=2.2`，优先直达救火点，短暂停留后小范围折返

### 6.4 标签与提示
- 头顶标签：
  - healthy：`救火队长`（绿色）
  - degraded：`救火队长`（黄色）
  - down：`救火队长`（深红+闪烁）
- hover tooltip：
  - `Gateway healthy`
  - `Gateway degraded: latency high`
  - `Gateway down: <error message>`

## 7. 代码落点（实施指引）
仅列设计，不执行：

1. `app/api/gateway-health/route.ts`
- 增加 `responseMs/checkedAt`（可选 `status`）。

2. `app/pixel-office/page.tsx`
- 引入 gateway 健康态轮询（或复用共享 store）。
- 把健康态喂给 office engine。

3. `lib/pixel-office/engine/officeState.ts`
- 新增系统角色创建/更新入口：`ensureGatewaySre()`、`updateGatewaySreState()`。
- 增加 gateway 三态行为状态机与目标点选择。

4. `lib/pixel-office/engine/characters.ts`
- 复用已有 WALK/IDLE 框架，增加 SRE 特定行为策略（巡检 vs 救火）。

5. `lib/pixel-office/engine/renderer.ts`
- 根据 SRE 状态渲染标签颜色和闪烁。

6. `lib/i18n.tsx`
- 新增文案键：`pixelOffice.gatewaySre.*`。

## 8. 配置与阈值（建议可配置）
- `gatewaySre.pollMs = 10000`
- `gatewaySre.degradedLatencyMs = 1500`
- `gatewaySre.downConsecutiveFailures = 2`
- `gatewaySre.recoverConsecutiveSuccess = 2`
- `gatewaySre.patrolRadiusTiles = 5`

## 9. 测试方案
功能测试：
- 手动停 gateway：应在 1~2 个轮询周期内进入 `down` 行为。
- 恢复 gateway：应在连续成功后回到 `healthy`。
- 人为注入慢响应：应进入 `degraded`。

回归测试：
- 不影响普通 agent/subagent 的移动、选座、标签与 tooltip。
- 手机端与桌面端都能显示 SRE 角色且不卡顿。

## 10. 风险与规避
- 状态抖动风险：使用连续计数和滞后恢复。
- 渲染性能风险：仅 1 个系统角色，复用现有帧循环，影响可控。
- 语义冲突风险：SRE 角色使用独立 `id` 与 `isSystemRole` 标记，避免和业务 agent 混淆。

## 11. 验收标准
- 进入像素办公室后可见 SRE 角色。
- Gateway 健康状态变化时，SRE 行为在可接受延迟内切换。
- 整体页面 FPS 无明显下降，现有交互无回归。
