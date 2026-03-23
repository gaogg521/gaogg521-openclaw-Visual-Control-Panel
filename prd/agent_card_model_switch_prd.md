# 机器人卡片模型切换方案

## 一、背景

当前机器人总览页已经能展示每个 agent 当前使用的模型，但模型信息是只读的，用户如果想给某个 agent 切换模型，仍然需要手动修改配置。

目标是把这个操作前置到机器人卡片上，做到：

1. 用户可以直接在页面上切换某个 agent 的模型
2. 切换后配置被持久化保存
3. 页面立即显示新模型
4. 后续从 dashboard 发起的相关测试和展示都基于新模型

结合当前代码：

- 首页总览在 [app/page.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/page.tsx)
- 机器人卡片在 [app/components/agent-card.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/components/agent-card.tsx)
- 配置读取在 [app/api/config/route.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/api/config/route.ts)
- 配置文件路径来自 [lib/openclaw-paths.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/lib/openclaw-paths.ts)

进一步确认本机 OpenClaw 能力后，发现 OpenClaw 提供 Gateway 侧的 `config.patch` 能力，用于安全地做部分配置更新；并且该能力在写入后会自动触发 restart，使新配置真正生效。

因此，这个功能不能只改前端展示，也不应该由 dashboard 直接手写配置文件，而应该走 Gateway 的 `config.patch` 标准能力。

## 二、目标

本期目标：

1. 在机器人卡片中增加模型切换入口
2. 支持为单个 agent 选择一个新的模型
3. 通过 Gateway `config.patch` 更新指定 agent 的模型
4. 更新后自动触发 Gateway restart，使新模型真正生效
5. 重启完成后刷新 dashboard 数据，使页面显示最新状态

## 三、非目标

本期不做以下事情：

1. 不做批量切换多个 agent 模型
2. 不编辑全局默认模型和 fallback 模型
3. 不管理 provider 密钥或 auth profile
4. 不单独设计新的 reload 协议
5. 不在本期中处理 agent 不存在于 `agents.list` 但被自动扫描出来时的持久化写回

## 四、用户故事

作为 dashboard 使用者，我希望直接在机器人卡片里切换某个 agent 的模型，这样我就不需要再去手动改配置，并且切换后系统会自动应用新模型。

## 五、现状分析

## 1. 模型数据来源

当前 `/api/config` 会读取 `openclaw.json`，并整理出：

1. `agents[]`
2. `providers[]`
3. `defaults.model`
4. `defaults.fallbacks`

其中每个 `agent` 最终展示的 `model` 是这样来的：

- 优先使用 `agent.model`
- 如果没有，则 fallback 到全局默认模型

## 2. 卡片当前能力

当前 `AgentCard` 只负责展示：

1. agent 名称、ID、状态
2. 当前模型
3. 平台信息
4. session 统计

它没有任何“修改模型”的动作，也没有提交回调。

## 3. 真正生效的配置位置

如果要让“切换模型”真的生效，最终被修改的目标配置仍然是：

`config.agents.list[i].model`

也就是说，配置层面上最终需要更新的是：

- 如果 agent 原来已经显式配置了 `model`，则直接改掉它
- 如果 agent 原来没有 `model`，只是继承默认模型，也要为该 agent 显式补一条 `model`

但更新动作不由 dashboard 直接写文件，而是由 Gateway `config.patch` 负责执行。

## 六、交互方案

## 1. 机器人卡片中的模型区域改造

当前模型区域是：

- 模型 badge
- 模型测试状态

改造后建议为：

- 正常态：显示当前模型 badge + “切换模型”按钮
- 编辑态：显示模型选择器 + 保存 + 取消
- 保存中：按钮禁用，展示“保存并应用中”状态
- 失败态：保留编辑态，并显示错误信息

保存动作的用户心智应明确为：

- 不只是“改展示”
- 而是“更新配置并应用”

## 2. 推荐交互形式

采用“卡片内联编辑”，不要跳转单独页面，也不要打开重量级弹窗。

原因：

1. 操作上下文最清晰，用户就是在看某个 agent 时改它
2. 改动范围小，容易接入现有卡片结构
3. 不需要额外复杂的页面状态管理

## 3. 模型选择器内容

模型选择器从首页已有的 `data.providers` 构造，按 provider 分组。

每个选项建议展示：

- `providerId / model.name`
- 如果没有 `name`，则显示 `providerId / model.id`

最终提交值统一使用：

`providerId/modelId`

## 七、接口设计

新增一个专用写接口：

- `PATCH /api/config/agent-model`

请求体：

```json
{
  "agentId": "main",
  "model": "openai/gpt-4.1"
}
```

成功返回：

```json
{
  "ok": true,
  "agentId": "main",
  "model": "openai/gpt-4.1",
  "applied": true
}
```

失败返回：

```json
{
  "ok": false,
  "error": "Agent not found"
}
```

## 八、后端实现方案

新接口建议放在：

- [app/api/config/agent-model/route.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/api/config/agent-model/route.ts)

后端处理流程：

1. 读取当前配置快照
3. 校验 `agentId`
4. 校验 `model`
5. 校验目标模型是否存在于当前可用模型列表中
6. 基于当前配置构造最小 patch，只修改目标 agent 的 `model`
7. 调用 Gateway `config.patch`
8. 等待 Gateway 写入配置并自动重启
9. 清除 `/api/config` 的内存缓存
10. 在前端轮询或重试拉取 `/api/config` / gateway 健康状态
11. 返回成功结果

## 推荐调用方式

后端不要直接改 `openclaw.json`，而是调用 OpenClaw 的 Gateway 能力：

1. 先拿到当前配置快照与 `baseHash`
2. 再用 `config.patch` 提交最小补丁

这样有几个好处：

1. 只改一处，风险更低
2. 与 OpenClaw 自身配置写入机制保持一致
3. 写入后自动 restart，保证新模型真正生效
4. 避免 dashboard 自己维护复杂的配置并发写入逻辑

## patch 构造建议

后端应始终基于最新配置快照和 `baseHash` 构造 patch，不允许前端直接提交 patch 内容。

推荐做法：

1. 先调用 Gateway `config.get`
2. 从返回结果中提取：
   - 当前配置快照
   - `baseHash`
3. 在服务端内存中找到目标 agent
4. 只更新该 agent 的 `model`
5. 生成最小变更 patch
6. 调用 Gateway `config.patch`

patch 的目标是：

- 只修改 `agents.list` 中目标 agent 的 `model`
- 不改全局默认模型
- 不改 fallback
- 不改其他 agent 配置
- 不改 provider 配置

实现原则：

1. 前端只传 `agentId` 和 `model`
2. patch 完全在后端生成
3. 一切并发控制都依赖 `baseHash`

这样可以最大限度降低误改配置的风险。

## 九、校验规则

以下情况必须拒绝写入：

1. `agentId` 缺失
2. `model` 缺失
3. `agents.list` 不存在
4. 指定 agent 不存在
5. 模型不在当前已知 provider/model 列表中
6. 无法获取当前配置快照或 `baseHash`
7. Gateway `config.patch` 调用失败

## 十、前端实现方案

## 1. 首页 [app/page.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/page.tsx)

需要新增的职责：

1. 从 `data.providers` 整理出 `modelOptions`
2. 实现 `onModelChange(agentId, model)` 回调
3. 回调中调用 `PATCH /api/config/agent-model`
4. 成功后等待 Gateway 重启并恢复可用
5. 然后复用现有 `fetchData(true)` 刷新数据
6. 把 `modelOptions` 和 `onModelChange` 传给 `AgentCard`

## 2. 卡片组件 [app/components/agent-card.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/components/agent-card.tsx)

建议新增 props：

```ts
modelOptions?: Array<{
  providerId: string
  providerName: string
  accessMode?: "auth" | "api_key"
  models: Array<{ id: string; name: string }>
}>
onModelChange?: (agentId: string, model: string) => Promise<void>
```

建议新增本地状态：

1. `isEditingModel`
2. `draftModel`
3. `isSavingModel`
4. `modelSaveError`

## 3. 卡片行为建议

进入编辑态时：

1. 默认选中当前模型
2. 如果当前模型不在可选列表中，也要显示一个“当前模型（未知）”占位选项，避免用户失去上下文

保存按钮启用条件：

1. 已选择模型
2. 新模型和当前模型不同
3. 当前不在保存中

保存成功后：

1. 退出编辑态
2. 清空错误信息
3. 页面刷新后显示最新模型
4. 若有需要，可给出“模型已应用”短提示

保存失败后：

1. 保持编辑态
2. 保留用户当前选择
3. 展示错误信息

## 十一、“切换后模型要生效”的定义

在新的方案下，“模型生效”定义为：

1. Gateway `config.patch` 已成功执行
2. Gateway 已按 OpenClaw 机制自动 restart
3. restart 完成后 `/api/config` 返回新模型
4. 卡片显示新模型
5. 后续 dashboard 内触发的模型测试、agent 测试等使用新模型

这意味着，这次不是“仅修改配置”，而是“修改配置并应用配置”。

因此它能覆盖：

1. 机器人卡片展示
2. 首页状态刷新
3. dashboard 内测试逻辑

## 十二、运行时说明

本方案不再依赖“运行时是否支持热更新”的不确定性。

因为根据当前 OpenClaw 能力，`config.patch` 在写入后会触发 restart，所以模型切换后会通过标准 restart 流程生效。

因此，产品语义应明确为：

- dashboard 发起模型切换
- OpenClaw 通过 `config.patch` 更新配置
- 系统自动 restart 后应用新模型

这比“假设支持热更新”更稳妥，也更符合 OpenClaw 当前已有机制。

## 十三、缓存处理

当前 [app/api/config/route.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/api/config/route.ts) 有 30 秒内存缓存。

如果不处理，模型切换后即使 Gateway 已经重启，页面也可能短时间看到旧值。

因此需要在写接口成功后清理缓存。

推荐方案：

新增共享缓存模块：

- [lib/config-cache.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/lib/config-cache.ts)

提供：

1. `getConfigCache()`
2. `setConfigCache()`
3. `clearConfigCache()`

然后：

- `GET /api/config` 读取/写入这个共享缓存
- `PATCH /api/config/agent-model` 成功后调用 `clearConfigCache()`

这样可以避免把缓存逻辑散落在多个文件里。

## 十四、安全性要求

1. 不允许 dashboard 直接接受任意路径并写文件
2. 只能通过 Gateway `config.patch` 修改配置
3. 只能保存已经校验过的模型值
4. 只能提交最小 patch
5. 不能影响配置中的其他字段

## 十五、边界情况

1. agent 当前没有显式 `model`
   - 切换后为该 agent 新增显式 `model`

2. agent 是从文件系统自动扫描出来的，但不在 `agents.list`
   - 本期拒绝修改
   - 原因是 `config.patch` 需要稳定的配置落点

3. provider 存在，但 model 仅是推断出来的
   - 只要它出现在后端返回的候选模型列表里，就允许选择

4. 多个页面同时修改同一个 agent 模型
   - 依赖 `baseHash` 控制并发
   - 如果底层配置已变化，则要求前端重试

5. Gateway 正在重启或暂时不可用
   - 前端显示“正在应用配置，请稍候”

6. `config.patch` 返回 baseHash 冲突
   - 提示用户刷新后重试

## 十六、实施步骤

1. 抽取共享 config cache
2. 新增 `PATCH /api/config/agent-model`
3. 在后端封装 Gateway `config.get` + `config.patch` 调用
4. 在首页构造模型候选列表
5. 给 `AgentCard` 增加内联模型编辑 UI
6. 保存后等待 Gateway restart 完成并刷新首页数据
7. 补充错误提示
8. 补充必要的验证

## 十七、测试方案

## 手动测试

1. 将某个 agent 从模型 A 切到模型 B，确认卡片立即更新
2. 在切换过程中观察 Gateway 短暂重启，再恢复可用
3. 刷新页面，确认模型 B 仍然存在
4. 切换后执行“测试全部模型/测试 Agent”，确认使用的是新模型
5. 给原本继承默认模型的 agent 切换模型，确认 patch 成功
6. 传入非法模型，确认接口拒绝
7. 模拟 Gateway 不可用或 patch 失败，确认卡片停留在编辑态并显示错误

## 自动化测试建议

1. API 测试：合法 agent/model 可以正确触发 `config.patch`
2. API 测试：非法 model 被拒绝
3. API 测试：agent 不存在时被拒绝
4. API 测试：`baseHash` 冲突时返回可理解错误
5. API 测试：成功后缓存被清除
6. 组件测试：卡片可以进入编辑态并提交保存

## 十八、验收标准

1. 每个机器人卡片都能进入模型切换模式
2. 用户只能从合法模型列表中选择
3. 保存后后端通过 Gateway `config.patch` 完成最小配置更新
4. 配置更新后系统自动 restart 并应用新模型
5. `/api/config` 在恢复后返回更新后的模型
6. 卡片无需手动刷新即可看到新模型
7. dashboard 内已有测试能力仍然正常可用
8. 非法输入不会破坏配置

## 十九、涉及文件

建议涉及这些文件：

1. [app/components/agent-card.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/components/agent-card.tsx)
2. [app/page.tsx](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/page.tsx)
3. [app/api/config/agent-model/route.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/api/config/agent-model/route.ts)
4. [app/api/config/route.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/app/api/config/route.ts)
5. [lib/openclaw-cli.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/lib/openclaw-cli.ts)
6. 可选新增 [lib/config-cache.ts](/Users/manruixie/code/pixel_agent/OpenClaw-bot-review/lib/config-cache.ts)

## 二十、结论

推荐采用：

- 卡片内联编辑
- 独立模型更新接口
- 后端调用 Gateway `config.patch`
- 利用 OpenClaw 标准 restart 流程应用配置
- 成功后清缓存并刷新首页

这是当前代码结构下最稳妥的方案，因为它复用了 OpenClaw 自带的配置更新机制，不依赖不确定的热更新行为，也能真正满足“切换后模型生效”的要求。
