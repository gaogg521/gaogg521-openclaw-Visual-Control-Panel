# 参与贡献指南

感谢你对 **[gaogg521-openclaw-Visual-Control-Panel](https://github.com/gaogg521/gaogg521-openclaw-Visual-Control-Panel)**（ONE CLAW 龙虾可视化控制台）的关注。本文说明协作流程、提交规范与质量门槛。

**无论人工提交还是借助各类 AI 编程工具改代码**，均须遵守 **[CODE_STANDARDS.md](CODE_STANDARDS.md)** 中的代码规范与本文流程。

**English summary:** See [CONTRIBUTING.en.md](CONTRIBUTING.en.md).

---

## 行为准则

参与本仓库即表示你同意遵守 **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**。请保持尊重、就事论事；骚扰与歧视性言行不被接受。

---

## 适合从这里开始

| 你想做… | 建议先做… |
|--------|-----------|
| 修 Bug | 在 [Issues](https://github.com/gaogg521/gaogg521-openclaw-Visual-Control-Panel/issues) 搜索是否已有相同问题；没有则开 **Bug 报告** |
| 提新功能 | 开 **功能建议**，说明使用场景与期望行为，避免与 OpenClaw 官方 CLI 职责重复 |
| 直接改代码 | **Fork → 分支 → PR**，见下文工作流 |

文档类改动（错别字、补充 `docs/`、README 链接）同样欢迎，可走同一套 PR 流程。

---

## 开发环境

- **Node.js**：与当前 `package.json` / Next 16 兼容的版本（建议 **22 LTS** 或团队统一版本）。
- **包管理**：本仓库使用 **npm**（`package-lock.json`）。
- **OpenClaw**：仅在你需要联调 Gateway、读写 `openclaw.json`、专家聊天等能力时安装；纯 UI / 构建可通过 mock 或跳过相关页面自测。

```bash
git clone https://github.com/gaogg521/gaogg521-openclaw-Visual-Control-Panel.git
cd gaogg521-openclaw-Visual-Control-Panel   # 或你本地的克隆目录名
npm install
cp .env.example .env.local   # 按需填写 OPENCLAW_HOME 等
npm run dev                  # 默认 http://localhost:3003
```

生产构建自检：

```bash
npx tsc --noEmit
npm run build
```

（若 Windows 上 `build` 报 `EBUSY` 占用 `.next/standalone`，可先 `npm run stop` 或结束占用进程后再构建。）

---

## Git 与分支策略

1. **Fork** 本仓库到你的 GitHub 账号。
2. **从 `main`（或仓库默认分支）拉取最新**，再创建功能分支：
   - `feat/简短说明` — 新功能
   - `fix/简短说明` — 缺陷修复
   - `docs/简短说明` — 仅文档
   - `chore/简短说明` — 工具、配置、无用户可见行为变更
3. **一个 PR 聚焦一件事**：便于审查与回滚。超大改动请事先在 Issue 里沟通。
4. **禁止**向 `main` 强推；通过 **Pull Request** 合并。

---

## 提交信息（Commit message）

推荐 **[Conventional Commits](https://www.conventionalcommits.org/)** 风格，便于生成变更日志：

```
<type>(<scope>): <简短描述>

[可选正文]
```

- **type**：`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `ci`
- **scope**：可选，如 `chat`、`api`、`i18n`、`electron`
- **描述**：用 **中文或英文** 均可，但**同一 PR 内建议统一语言**，且**一句话说清「改了什么」**

示例：

- `fix(chat): CLI 回退时正确解析 agent --json 的 payloads`
- `docs: 补充 CONTRIBUTING 与 PR 模板`

---

## Pull Request 检查清单

提交 PR 前请确认：

- [ ] 已阅读 **[CODE_STANDARDS.md](CODE_STANDARDS.md)**（代码规范；人工与任意 AI 编程工具均需遵守）
- [ ] **改动范围**与 PR 标题/描述一致，无无关大重构
- [ ] `npx tsc --noEmit` **通过**
- [ ] `npm run build` **通过**（涉及构建、依赖、路由、服务端代码时）
- [ ] 用户可见文案：如需多语言，已检查 **`lib/i18n.tsx`** 或 **`lib/locales/*.json`**
- [ ] 未提交 **密钥、Token、本机绝对路径**；`.env.local` 仍在 `.gitignore` 中

填写 **PR 描述**时请说明：动机、主要变更、如何手动验证（例如「打开 `/chat` 发送一条消息」）。

---

## 代码与目录约定（摘要）

- **框架**：Next.js App Router（`app/`），API 在 `app/api/`。
- **样式**：Tailwind v4；主题与 `data-theme` 见现有页面，避免硬编码与全局主题冲突的颜色。
- **OpenClaw 集成**：读写配置路径以 **`lib/openclaw-paths.ts`**、**`lib/openclaw-home-detect.ts`**、**`lib/openclaw-cli.ts`** 为准；子进程调用 OpenClaw CLI 时必须遵守其中对环境变量（`OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH`）的约定。
- **性能**：避免在 API 路由中短时间并发大量 `openclaw` 子进程；参考现有 `single-flight`、轮询节流等模式。

更细的协作提示见 **[CODE_STANDARDS.md](CODE_STANDARDS.md)**。

---

## Issue 使用说明

- **Bug**：复现步骤、期望 vs 实际、环境（OS、Node、面板版本/分支、是否 Docker/Electron）、如有报错请贴**脱敏**后的日志或截图。
- **Feature**：用户故事、是否仅面板侧即可实现、与 **上游 OpenClaw** 的边界。

维护者会按优先级处理；若长期无响应，可礼貌 `@` 或在 Discussion 中关联 Issue（若仓库启用 Discussions）。

---

## 许可证与版权声明

若仓库根目录已提供 **LICENSE** 文件，贡献内容默认遵循该许可证；**若尚未添加 LICENSE**，请在 PR 中说明你的代码许可意愿，或与维护者确认后再合并。若你引入第三方代码，须在 PR 中注明**来源与许可证兼容性**。

---

## 仓库与链接

- **GitHub**：<https://github.com/gaogg521/gaogg521-openclaw-Visual-Control-Panel>
- **维护者**：[@gaogg521](https://github.com/gaogg521)

再次感谢你的贡献。
