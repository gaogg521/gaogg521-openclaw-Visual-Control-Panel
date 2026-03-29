# 项目记忆（持续更新）

最后更新：2026-03-26
适用项目：`龙虾可视化控制面板`

## 目标共识

- 重点优化安装与 `/setup` 新手引导，消除“假装安装成功”与“卡住/报错但无法定位”问题。
- 检测优先级遵循：先 `openclaw --version`（快速判断是否可执行），再做更深层完整性/功能验证。
- 不急于反复打包；先把关键稳定性问题全部收敛，再统一出包。

## 最近已完成（核心）

- 安装器行为优化：
  - 安装/卸载前自动结束历史 `ONE Claw` 相关进程，减少人工干预。
  - 一键安装后加入更稳健的 PATH 刷新与重试探测，降低“刚装完但检测不到”误判。
  - 当安装脚本已明确成功但即时 `--version` 未命中时，支持延迟验证语义，避免误报失败。

- `/setup` 可靠性优化：
  - `precheck` 以 `openclaw --version` 快速探测为主，移除首阶段慢检查导致的长时间卡顿。
  - 新增“CLI 已安装但配置缺失”状态引导（`needsOnboard`），避免用户误解为彻底失败。
  - `onboard` 适配新版 CLI（含 `--accept-risk`），并优先走可执行文件路径，规避 Electron 误调用 `.mjs`。
  - 对 `customBaseUrl` 做规范化，减少 URL 格式导致的密钥配置失败。
  - `onboard` 完成后增加配置文件落盘等待与回传（`openclaw.json` 是否存在、路径是什么）。

- 诊断可见性增强：
  - `/setup` 缺失态页面增加“快速诊断”：展示 `openclaw` 可执行路径与配置路径。
  - 新增“路径一致性判断”：
    - 命中 `.../.openclaw/openclaw.json` 判定为标准路径（绿色）。
    - 命中其他路径提示核对 `OPENCLAW_HOME`（红色/警示）。

- 仪表盘与交互优化：
  - 仪表盘版本号由硬编码改为动态读取 `openclaw --version`。
  - 将 4 个高频运维功能迁移到仪表盘右上角并保持 UI 风格一致：
    - 主题切换
    - `CLAW诊断`
    - `重启 OneOneClaw`
    - `查看CLAW状态`
  - `/chat` 页面做现代化可用性改进（消息样式、自动滚动、清空本地记录等）。

## 关键实现文件（高频）

- `lib/openclaw-cli.ts`
- `app/api/setup/precheck/route.ts`
- `app/api/setup/oneclick-install/route.ts`
- `app/api/setup/onboard/route.ts`
- `app/setup/page.tsx`
- `app/api/openclaw/status/route.ts`
- `app/oneone-dashboard/page.tsx`
- `app/page.tsx`
- `app/chat/page.tsx`
- `packaging/electron/build/installer.nsh`

## 已确认的高价值策略

- 安装判断“先快后深”：
  - 快速就绪判断：`openclaw --version`
  - 深层检查：`openclaw doctor`
  - 功能验证：`openclaw dashboard`（或相关可达性检查）
- Windows 场景优先考虑：
  - PATH 同步延迟
  - 用户级安装目录与 `APPDATA/USERPROFILE` 差异
  - Electron 打包态命令调用路径差异

## 仍需留意的风险点

- 新机器首次安装后，系统 PATH 生效有延迟，短时间内探测结果可能波动。
- 用户本地 `OPENCLAW_HOME` 被改写时，CLI 与服务读取到的配置路径可能不一致。
- 网关服务（Scheduled Task）缺失或未拉起时，用户容易误判为“安装失败”。

## 打包前检查清单（建议）

- 一键安装完整链路：安装 -> `--version` -> `/setup` 引导 -> `onboard` 落盘成功。
- “CLI 已装、配置缺失”与“路径一致性判断”两类提示文案是否清晰。
- 仪表盘右上角 4 功能在打包版本中可用，且日志弹窗可读。
- 新用户场景验证：未装 Git/Node、PATH 未刷新、首次拉起网关。
- 回归构建：`npm run build` 通过。

## 维护约定

- 后续每次较大改动后，补充本文件中的：
  - 变更目的
  - 关键文件
  - 风险与回归点
  - 下一步待办

