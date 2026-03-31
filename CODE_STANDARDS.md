# 仓库代码规范（CODE_STANDARDS.md）

本文与 [CONTRIBUTING.md](CONTRIBUTING.md) 配套：**人工贡献者与任意 AI 编程工具**（GitHub Copilot、Cursor、Claude Code、Windsurf、自建脚本等）在修改本仓库时，**统一遵守**下列约定即可，**不绑定**某一款编辑器或产品。

## 项目是什么

- **ONE CLAW 龙虾可视化控制台**：OpenClaw 的 **本地 Web 仪表盘**（Next.js），读取本机 `OPENCLAW_HOME` / `openclaw.json`、Gateway、会话等。
- **不替代** [OpenClaw 官方 CLI](https://github.com/openclaw/openclaw)；需要时通过子进程或 HTTP 与官方行为对齐。

## 技术栈

- **Next.js**（App Router）、**React 19**、**TypeScript**、**Tailwind CSS v4**
- 包管理：**npm**（保留 `package-lock.json`）

## 修改代码时

- **只改与任务相关的文件**，避免顺手大重构、无关格式化。
- **匹配现有风格**：命名、import、组件结构、注释密度与周边一致。
- **API 与 OpenClaw**：
  - 配置与路径：`lib/openclaw-paths.ts`、`lib/openclaw-home-detect.ts`
  - 调用 `openclaw` 子进程：**只用** `lib/openclaw-cli.ts` 中的 `execOpenclaw` 等；子进程环境须设置 **`OPENCLAW_STATE_DIR`、`OPENCLAW_CONFIG_PATH`**，且 **`OPENCLAW_HOME` 表示用户主目录**（与 OpenClaw CLI 语义一致），勿把状态目录误设为 `OPENCLAW_HOME`。
- **不要**提交 `.env.local`、密钥、本机绝对路径到 Git。
- **国际化**：用户可见字符串优先走现有 i18n（`lib/i18n.tsx`、`lib/locales/*.json`）。
- **性能**：勿在单次请求中并行堆积大量 `openclaw` 子进程；参考现有节流 / single-flight 模式。

## 提交前自检

```bash
npx tsc --noEmit
npm run build
```

开发：`npm run dev`（默认端口 **3003**，见 `package.json`）。

## 文档

- 用户向说明：**README.md** / **README.en.md**
- 贡献流程：**CONTRIBUTING.md**
- 打包与 Electron：**packaging/electron/README.md** 等子目录 README

## Issue / PR

- 使用 GitHub 模板；PR 描述写清 **动机、变更要点、手动验证步骤**。
