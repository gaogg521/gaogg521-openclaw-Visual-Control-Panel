# OpenBug 迁移到 OpenClaw-bot-review 的设计方案

## 1. 背景与目标

### 1.1 背景
- `OpenBug` 当前是 **Windows WPF 桌面透明覆盖层应用**（`net8.0-windows`），核心是程序化虫群动画与行为系统。
- 当前项目是 **Next.js Web 应用**，已具备 `pixel-office` 的 Canvas 渲染与实体状态机能力（角色、宠物、交互彩蛋）。

### 1.2 目标
- 将 OpenBug 的核心体验迁移到 Web：
1. 程序化虫子（IK 风格步态视觉 + 群体行为）
2. 低干扰背景陪伴（focus companion）
3. 可配置数量/行为权重/开关
4. 与现有 Pixel Office 共存并可扩展

### 1.3 非目标（首期不做）
- 不做 Windows 原生托盘能力（用 Web UI 替代）
- 不做真正系统级“桌面覆盖”（浏览器沙箱不支持）
- 不做逐行 1:1 C# 代码搬运（改为 TypeScript 重构）

---

## 2. 迁移策略（推荐）

采用 **“行为内核迁移 + 渲染层重建”**：
- 行为与数据结构从 C# 迁移到 TS（可测试、可演进）
- 渲染直接接入现有 `pixel-office` Canvas pipeline
- 分阶段上线：先可见、再拟真、再性能优化

理由：
- 当前仓库已有成熟循环：`OfficeState.update(dt)` + `renderFrame(...)`
- 直接复用能减少接线成本，避免并行维护两套引擎

---

## 3. 架构设计

### 3.1 模块落位

新增目录建议：
- `lib/pixel-office/bugs/types.ts`
- `lib/pixel-office/bugs/config.ts`
- `lib/pixel-office/bugs/bugEntity.ts`
- `lib/pixel-office/bugs/bugBehavior.ts`
- `lib/pixel-office/bugs/spatialGrid.ts`
- `lib/pixel-office/bugs/pheromoneField.ts`
- `lib/pixel-office/bugs/ik2d.ts`
- `lib/pixel-office/bugs/renderer.ts`

接入点：
- `lib/pixel-office/engine/officeState.ts`
  - 持有 `bugSystem`，在 `update(dt)` 中 tick
- `lib/pixel-office/engine/renderer.ts`
  - 在角色层之前或之后绘制虫群（可配置层级）
- `app/pixel-office/page.tsx`
  - 提供 UI 控件（开关、数量、性能模式）

### 3.2 数据模型（核心）

`BugEntity`（建议）：
- `id`
- `x,y, vx,vy, heading`
- `behaviorType: social | loner | edgeDweller`
- `state: idle | moving | interacting`
- `speedScale, turnScale`
- `legs[6]`（目标点、关节点、相位）
- `color, sizeScale`
- `trailTargetId?`（跟随对象）
- `visible`

`BugSystemState`：
- `bugs: BugEntity[]`
- `spatialGrid`
- `pheromoneField`
- `spawnTimer`
- `swarmEventTimer/cooldown`
- `paused`

### 3.3 更新循环

每帧：
1. 建立/更新空间网格（邻域查询）
2. 更新信息素场（蒸发）
3. 每只虫子执行行为决策：
   - 分离/对齐/凝聚（Boids）
   - 边缘偏好
   - 游走噪声
   - 鼠标斥力（若开启）
4. 移动学更新（位置/朝向）
5. 步态与 IK 更新（腿端落点 + 两段骨骼解算）
6. 写回渲染缓存

---

## 4. 功能映射（OpenBug -> Web）

### 4.1 行为系统映射
- `AntBehaviorType` -> `BugBehaviorType`（保持三类）
- `_stateTimer`/`_wanderTimer` -> JS 定时器字段
- `_swarmActive` + 随机事件 -> 保持，参数可调
- `SpatialGrid.Query` -> TS 版本网格索引
- `PheromoneField` -> TS 2D 栅格（TypedArray）

### 4.2 生命周期映射
- 初始 5 只、定时生成（默认 10 分钟）
- 最大数量（建议首发上限 120，性能模式可扩）
- 可手动加减数量（替代托盘菜单）

### 4.3 UI 替代托盘
- 在 Pixel Office 顶栏新增 “Bug Panel”：
1. `Enable Bugs` 开关
2. `Count` 数量滑条
3. `Spawn Interval` 生成间隔
4. `Performance Mode`（low/medium/high）
5. `Hide/Show`（暂停更新+渲染）

---

## 5. 渲染方案

### 5.1 首发渲染分级

#### V1（快速上线）
- 简化虫体：头/胸/腹 3 段椭圆 + 6条折线腿
- 不引入复杂抗锯齿特效
- 目标：先保证行为和性能

#### V2（增强拟真）
- 二段腿 IK 过渡插值
- 步态相位优化（tripod gait）
- 颜色与体型渐进（随生命周期）

#### V3（视觉精修）
- 轻微阴影/景深错觉
- 群聚通信短暂停顿动作
- 可选“调试可视化层”（邻域半径、信息素热力）

### 5.2 层级建议
- 地板 -> 家具 -> 虫群 -> 角色/宠物（可配置）
- 避免覆盖关键交互热点（白板/时钟/模型面板）

---

## 6. 性能设计

### 6.1 预算
- 目标设备：中端笔记本浏览器
- 指标：
1. 60 FPS（目标）/ 30 FPS（可接受下限）
2. Bug 100 只时交互无明显卡顿
3. CPU 占用可控（空闲不应飙升）

### 6.2 手段
- 邻域查询必须走 Spatial Grid，禁止 O(n²) 全量扫描
- 信息素采用稀疏更新/低分辨率栅格
- IK 与行为 decouple：例如行为 30Hz、渲染 60Hz
- `requestAnimationFrame` 内减少对象分配，优先复用数组
- Debug overlay 默认关闭

---

## 7. 持久化与配置

配置存储优先级：
1. `localStorage`（用户本地偏好）
2. 可选后端配置接口（后续）

建议键：
- `pixel-office-bugs-enabled`
- `pixel-office-bugs-count`
- `pixel-office-bugs-mode`
- `pixel-office-bugs-spawn-interval`

---

## 8. 开发里程碑

### M1：最小可运行（2-3 天）
- BugSystem 基础数据结构
- 随机游走 + 边界处理
- Canvas 简化渲染
- 控制面板开关与数量调节

### M2：行为与生态（3-5 天）
- SpatialGrid 邻域
- Boids 三力 + 三类行为人格
- 定时生成、上限控制、暂停/恢复

### M3：IK 与拟真（4-6 天）
- 二段腿 IK
- 三角步态相位
- 信息素场与 trail follow

### M4：优化与验收（2-3 天）
- 性能 profiling
- 参数调优与默认值固化
- 文档与回归测试

---

## 9. 风险与应对

1. **浏览器性能不足（高数量卡顿）**
- 应对：分级渲染、降低更新频率、上限保护

2. **与现有角色交互冲突（命中检测/视觉遮挡）**
- 应对：虫群层级可切换；点击命中先走业务实体后走虫群

3. **过度拟真导致开发周期失控**
- 应对：严格按 M1->M4 递增交付，不跨阶段

4. **参数过多难维护**
- 应对：集中 `config.ts`，提供 presets（focus/calm/chaos）

---

## 10. 验收标准（首版）

功能验收：
1. 能开启/关闭虫群系统
2. 可调整数量，新增/减少即时生效
3. 至少支持三类行为偏好（social/loner/edge）
4. 定时生成与上限生效

性能验收：
1. 80 只虫时页面操作无明显掉帧
2. 连续运行 30 分钟无内存持续增长异常

体验验收：
1. 默认参数不抢主界面注意力
2. 支持“隐藏虫群”用于演示/录屏

---

## 11. 建议的实施顺序（落地）

1. 先上 `BugSystem` 空壳和最简渲染（M1）
2. 接入 `officeState.update` 和 `renderer.renderScene`
3. 加 UI 控制面板
4. 再迁移 Boids + Grid + 信息素
5. 最后做 IK 精修和性能调优

---

## 12. 可选扩展

- “专注模式”预设：低密度、低速度、低干扰
- “混乱模式”预设：高密度、群聚事件频繁
- 和现有宠物系统联动（猫/龙虾对虫群反应）
- 统计页新增“Bug 活跃度”指标

