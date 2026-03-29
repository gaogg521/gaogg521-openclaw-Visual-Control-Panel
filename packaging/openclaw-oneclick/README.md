# OpenClaw × 龙虾可视化 — 一键安装 / 打包说明

> 目标：尽量**无需用户手敲官方 curl/iwr 命令**；安装完成后用**向导环境变量**或**控制台 `/setup`** 完成 `openclaw onboard --non-interactive`；网关就绪后**自动打开** OpenClaw Web 与 `http://localhost:3003/oneone-dashboard`。

## 用户视角：Windows 怎么装、浏览器什么时候出现？

**必读（产品 / 安装包开发）：** [WINDOWS_USER_JOURNEY.zh-CN.md](./WINDOWS_USER_JOURNEY.zh-CN.md)

**续作交接（部署向导 `/setup` + Windows Full 安装包，2026-03-17）：** [../../docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md](../../docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)

里面用**用户能听懂的话**写清两条路：

1. **传统 `Setup.exe` 图形向导** → 装完可选「启动控制台」→ 自动打开 `http://localhost:3003/setup`  
2. **先本地启动 3003（绿色包 / 小启动器）** → 浏览器打开 `/setup` → 若未装 CLI，先在页面提示里装完再「重新检测」

并说明：**`/setup` 只要控制台跑起来就能打开**；**不等于**已经装好了 `openclaw`（预检会引导剩余步骤）。

## 参考：OneClaw 桌面客户端

社区项目 **[OneClaw](https://github.com/oneclaw/oneclaw)**（Electron + 内置 Node 22 + Gateway）已实现「一分钟安装、多厂商 Key、**安装冲突检测**、飞书/QQ 等」等体验，与本仓库的 **OpenClaw 官方 CLI + 龙虾 Web 面板**路线不同，但**冲突检测思路一致**。本目录脚本对齐其目标：避免重复覆盖安装、避免默认端口被无关进程占用。

## 安装冲突检测（本仓库行为）

| 脚本 | 行为 |
|------|------|
| `scripts/check-openclaw-conflicts.sh` / `.ps1` | 若 **`openclaw --version` 成功**：**不再执行**官方 `install.sh` / `install.ps1`，防止重复安装与覆盖。 |
| 同上 | 若**未检测到 CLI** 但 **`gateway.port`（默认 18789）已被占用**：**退出 20**，避免与已有 Gateway 抢端口；可设 `OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY=1` 强行继续。 |
| `scripts/check-lobster-port.sh` / `.ps1` | 启动龙虾前检测 **3003**（或 `LOBSTER_PORT`）；占用则退出 **30**，可设 `OPENCLAW_ONECLICK_ALLOW_BUSY_LOBSTER=1` 跳过检测。 |

**强制重装官方脚本**：设置 `OPENCLAW_ONECLICK_FORCE_REINSTALL=1`（仍会跑官方安装器，可能升级/覆盖，请自行承担风险）。

## 官方安装脚本（自动化依据）

| 平台 | 文档命令 | 无人值守要点 |
|------|-----------|----------------|
| macOS / Linux | `curl -fsSL https://openclaw.ai/install.sh \| bash` | `bash -s -- --no-prompt --no-onboard`，或 `OPENCLAW_NO_PROMPT=1`（见 [Installer internals](https://docs.openclaw.ai/install/installer)） |
| Windows | `iwr -useb https://openclaw.ai/install.ps1 \| iex` | `& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard`（见 [Install](https://docs.openclaw.ai/install)） |

官方推荐运行时：**Node 24** 或 **Node 22.16+**。本仓库 Dockerfile 使用 **Node 22**；一键包内嵌 **Node 22 LTS** 与官方说明兼容。

## 本目录提供什么

| 路径 | 作用 |
|------|------|
| `scripts/check-openclaw-conflicts.sh` / `.ps1` | **预检**：已安装则跳过、网关端口占用告警 |
| `scripts/check-lobster-port.sh` / `.ps1` | 龙虾端口（默认 3003）占用检测 |
| `scripts/install-openclaw-macos-linux.sh` | 先跑冲突检测；通过后再静默拉官方 `install.sh` |
| `scripts/install-openclaw-windows.ps1` | 先跑冲突检测；通过后再静默执行官方 `install.ps1 -NoOnboard` |
| `config/wizard.example.env` | 复制为 `wizard.env`，填写模型厂商与 Key，供 onboard 使用 |
| `scripts/run-onboard-from-env.sh` / `.ps1` | 读取 `wizard.env` 调用 `openclaw onboard --non-interactive`（默认 `--gateway-port 18789`） |
| `scripts/start-lobster-standalone.sh` / `.ps1` | 用**内嵌/指定 Node** 启动龙虾面板 standalone（默认 **3003**） |
| `scripts/wait-gateway-open-dashboards.sh` / `.ps1` | 轮询本机网关端口（默认 **18789**），就绪后打开 OpenClaw 与龙虾仪表盘 |
| `config/channels-placeholder.zh-CN.md` | 飞书 / 企微 / 钉钉 / QQ 等在**通道**里填写的说明（需按 OpenClaw 实际 channel 结构补全） |
| `windows/OpenClawOneClick.iss` | **Inno Setup** 演示包：图标/向导图 + 启动器（不含便携 Node/Git） |
| `windows/OpenClawOneClick.Full.iss` | **完整包**：内置便携 **Node + MinGit**（需先跑 `windows/prepare-full-redist.ps1`）、安装后**静默写入用户 PATH**；失败则弹窗引导官网手动安装；可选 `standalone`。详见 `windows/FULL_INSTALL.md` |
| `windows/prepare-full-redist.ps1` | 下载 Node zip + MinGit 到 `installer-bundle/redist/`（体积大，目录已 `.gitignore`） |
| `windows/installer-bundle/scripts/install-bundled-tools.ps1` | 安装/卸载时维护用户 PATH 并自检 `node`/`git` |
| `windows/Messages.oneclaw.*.isl` + `CustomMessages.oneclaw.en.isl` / `CustomMessages.oneclaw.zh.isl` | 安装向导**中英**欢迎/完成页与 `{cm:...}` 文案；说明见 **`windows/INNO_MESSAGES_README.md`** |

## 图形化极简向导（龙虾面板内 `/setup`）

**何时能打开：** 本机已启动龙虾控制台（默认 **3003**）后，浏览器访问 **`http://localhost:3003/setup`** 即可。  
**若尚未安装 `openclaw`：** 页面会先显示**预检**（安装命令 + 重新检测），通过后再进入向导。

向导步骤（与当前面板实现一致，约五步）：

1. 欢迎 → **开始**  
2. **选择模型商（提供商）**  
3. **填写密钥与模型**（及自定义 Base URL / Ollama 地址等）  
4. **确认摘要** → **确认并写入**（后台 `openclaw onboard --non-interactive`）  
5. **完成**（Gateway 状态 + 打开聊天 / 仪表盘）

> API 默认仅接受 **Host 为 localhost** 的请求；远程访问需 `SETUP_ALLOW_REMOTE=1`（慎用）。可选 `LOBBY_SETUP_SECRET` + `Authorization: Bearer` 加固。

## 推荐端到端流程（给最终用户）

**若你做的是「安装包」：** 请按 [WINDOWS_USER_JOURNEY.zh-CN.md](./WINDOWS_USER_JOURNEY.zh-CN.md) 选定 **EXE 向导**或**先起 3003** 的路线，再把下面步骤编排进安装器/启动器。

**通用顺序（概念上）：**

1. **安装 OpenClaw CLI**（本目录 `install-openclaw-*.ps1` 已封装冲突检测 + 官方静默安装；用户也可在 **`/setup` 预检页**按提示自行执行）。
2. **（推荐）** 启动控制台后打开 **`/setup`** 完成浏览器向导；或复制 `config/wizard.example.env` → `wizard.env`，按注释填写 **auth-choice** 与 API Key（与 [CLI Automation](https://docs.openclaw.ai/start/wizard-cli-automation) 一致）。
3. 若不用浏览器向导：运行 `run-onboard-from-env.*`（daemon、**18789** 等由 env 控制）。
4. 构建面板：在龙虾项目根执行 **`npm run packaging:prepare-standalone`**，将 `.next/standalone` + `public` + `.next/static` 拷入安装目录（或由 Inno / pkg 完成）。
5. 运行 `start-lobster-standalone.*`；需要时运行 `wait-gateway-open-dashboards.*`，或由**总控脚本**顺序调用。

> **说明**：真正的「双击 DMG/EXE」需要在 macOS 上用 **pkgbuild/productbuild** 或 **create-dmg**，在 Windows 上用 **Inno Setup / NSIS** 把 **Node 22 可移植压缩包**、`openclaw` 全局安装结果（或官方 `install-cli.sh` 前缀目录）和龙虾 standalone **打成一个安装器**。本仓库提供**脚本与 ISS 骨架**；完整签名、公证、上架分发需你在 CI/证书环境完成。

## 纯净卸载（方向）

- 遵循官方 [Uninstall](https://docs.openclaw.ai/install) 文档：`openclaw` 提供的卸载/清理步骤 + 删除安装目录与 `~/.openclaw`（若希望完全重置）。
- Windows 用户 PATH 中由官方安装器追加的 npm 全局 bin 需安装器卸载时一并移除（Inno Setup `[UninstallRun]` / 注册表）。

## 法律与网络

一键安装会**从 `openclaw.ai` 下载**官方脚本；请在你的产品说明中告知用户，并遵守 OpenClaw 许可与隐私条款。
