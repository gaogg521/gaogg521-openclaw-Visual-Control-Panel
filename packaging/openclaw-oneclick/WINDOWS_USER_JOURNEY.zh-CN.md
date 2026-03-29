# Windows 用户安装体验设计（用户视角）

> 面向：**下载了「ONE CLAW / OpenClaw 一键包」或 `Setup.exe` 的普通用户**，以及要把体验落地的**安装包开发者**。  
> 目标：用户不用猜「先装谁、后点哪」；**传统桌面向导**与**浏览器向导**两条路都说清楚。

---

## 1. 用户脑子里会先问的三件事

| 疑问 | 给用户的一句话答案 |
|------|-------------------|
| 我下载的 `.exe` 是干什么的？ | 一般是**安装器**：把运行环境、命令行工具、控制台程序拷到本机，并（可选）帮你启动。 |
| 为什么有人先看到浏览器、有人先看到安装窗口？ | **两种产品设计都合理**：可以「先桌面向导再开浏览器」，也可以「先起一个本地网页再在浏览器里装完剩下步骤」。 |
| `http://localhost:3003/setup` 什么时候会出现？ | **只要本机的「控制台」Web 服务在 3003 端口跑起来**，地址就能打开；**不依赖**你已经装完 `openclaw`——没装好时页面会提示你先装 CLI，再点「重新检测」。 |

---

## 2. 两种推荐路线（任选其一作为产品主线）

### 路线 A：传统图形安装向导（例如 Inno Setup / NSIS 生成的 `Setup.exe`）

**适合**：希望与常见 Windows 软件一致——「下一步 → 选目录 → 安装 → 完成」。

**建议用户动线**

1. **双击 `Setup.exe`** → 欢迎页说明：将安装「命令行工具 + ONE CLAW 控制台」、可能需联网拉取官方组件。  
2. **选安装目录** → （可选）勾选「将 `openclaw` 加入 PATH」「创建桌面快捷方式」。  
3. **安装进度** → 后台顺序建议：  
   - 解压/放置 **Node 便携版**（若内嵌）；  
   - 运行本仓库的 **`scripts/install-openclaw-windows.ps1`**（内部已做冲突检测 + 官方静默安装）；  
   - 解压 **龙虾控制台 standalone**（`.next/standalone` + `public` + `.next/static`）。  
4. **完成页**（关键）：  
   - 勾选默认开启：**「启动 ONE CLAW 控制台并打开配置向导」**；  
   - 点击完成后：由安装器调用 **`start-lobster-standalone.ps1`**（或等价逻辑）启动 **3003**，再 **`Start-Process` 打开浏览器**：  
     `http://localhost:3003/setup`  
5. **浏览器里**：  
   - 若 **PATH 尚未在新进程生效**：用户可能先看到 **「尚未检测到 CLI」**——页面上已有复制安装命令 / 重新检测；可提示**关闭浏览器后重新打开**或**注销重新登录**再点「重新检测」。  
   - 预检通过后 → 进入控制台内的 **五步部署向导**（提供商 → 密钥 → 确认 → …）。

**安装器开发者 Checklist**

- [ ] 完成页是否自动启动控制台（3003）并打开 `/setup`（或 `/`）。  
- [ ] 若 CLI 安装与启动控制台**同一安装会话**内完成，是否提示用户**新开终端**或**重启浏览器**再检测 PATH。  
- [ ] **3003**、**18789** 被占用时是否有清晰错误码（可对接 `check-lobster-port.ps1` / 官方网关端口说明）。  
- [ ] 卸载入口是否说明会移除/保留 `~/.openclaw`（按产品策略）。

---

### 路线 B：先启动本地 Web，再在浏览器里完成「剩余安装 + 配置」

**适合**：绿色版、zip 包、或「一个小 exe 只负责起服务」的极简分发。

**建议用户动线**

1. 用户解压 zip，**双击 `启动控制台.cmd` / `Start Console.exe`**（由你们提供）。  
2. 脚本只做几件事：检测 **3003** 是否空闲 → 用内嵌 Node 运行 **standalone `server.js`** → **自动打开浏览器**：  
   `http://localhost:3003/setup`  
3. **第一眼在浏览器里**：  
   - **若本机还没有 `openclaw`**：页面显示 **预检失败区**——用户按提示在 **PowerShell** 里执行官方或本包提供的安装命令，装完后回到**同一页**点 **「重新检测」**。  
   - **预检通过**：进入 **五步向导**，全程不离开浏览器即可完成模型商、密钥、确认写入。  
4. （可选）向导完成后再由脚本或页面链接执行 **`wait-gateway-open-dashboards.ps1`** 一类逻辑，打开 Gateway 聊天页与仪表盘。

**这条路线的优点**

- 用户**始终有一个可打开的网页**；「还没装 CLI」不会被静默失败，而是**显式引导**。  
- 与当前控制台已实现的 **`/setup` 预检 + 安装说明**一致，**无需用户先理解 PATH** 才能看到界面。

**注意**

- 若安装包**没有**内置自动安装 CLI，必须在预检页写清：**「请到 PowerShell 执行以下命令」**，并说明执行完要 **重新检测**。  
- 若安装包**会**在后台静默安装 CLI，建议在首次打开 `/setup` 前**等待安装结束**，或页面上给 **「正在安装命令行工具…」** 状态（需安装器与控制台协同，属增强项）。

---

## 3. 两条路线如何共用同一套脚本（给开发者对照）

| 用户看到的步骤 | 路线 A（EXE 向导）典型实现 | 路线 B（先 Web）典型实现 |
|----------------|---------------------------|---------------------------|
| 安装 OpenClaw CLI | 向导「安装中」调用 `install-openclaw-windows.ps1` | 用户按 `/setup` 页复制命令执行，或另附「首次运行.bat」先调该脚本 |
| 启动控制台 | 完成页调用 `start-lobster-standalone.ps1` | 用户双击的启动器 = 该脚本 |
| 打开配置界面 | 浏览器打开 `/setup` | 同上 |
| 写入模型与 Key | 浏览器内向导 → `POST /api/setup/onboard` | 同上 |
| 装完后打开聊天/仪表盘 | `wait-gateway-open-dashboards.ps1` 或向导完成页按钮 | 同上 |

本目录已有脚本可参考：`install-openclaw-windows.ps1`、`start-lobster-standalone.ps1`、`run-all-after-install.ps1`、`wait-gateway-open-dashboards.ps1`。  
**`run-all-after-install.ps1`** 假定 **CLI 已存在** 且会先 onboard 再起控制台——更适合**自动化/IT 部署**；**面向小白用户**时，更推荐拆成：**先让用户在 `/setup` 里看见状态**，再决定何时 onboard。

---

## 4. 建议在安装器或首次启动时展示的「短文案」（可直接给用户看）

- **联网说明**：安装过程会从 `openclaw.ai` 等地址下载官方组件，请保持网络畅通。  
- **本机安全**：配置向导默认仅 **localhost** 可写入密钥；请勿把控制台暴露到公网。  
- **端口**：控制台默认 **3003**；OpenClaw Gateway 常见为 **18789**。若占用，请关闭占用程序或按文档修改配置。  
- **装完看不到命令行？** 请**新开一个 PowerShell 窗口**，或**重新登录 Windows**，再在 `/setup` 点「重新检测」。

---

## 5. 与 Inno Setup 骨架的对应关系

**向导界面文案（欢迎页 / 完成页 / 完成页复选框说明）** 已拆成可直接合并的 `.isl` 文件，见：

- **`windows/INNO_MESSAGES_README.md`** — 如何写进 `[Languages]`、`[Run]`、`{cm:...}`
- **`windows/Messages.oneclaw.en.isl`**、**`Messages.oneclaw.zh-CN.isl`** — `[Messages]` 覆盖
- **`windows/CustomMessages.oneclaw.en.isl`** / **`CustomMessages.oneclaw.zh.isl`** — 英文 / 简体中文 `{cm:RunLaunchConsole}` 等

`windows/OpenClawOneClick.iss` 已示例如何引用上述文件；取消注释 `[Run]` 行并指向真实 `launcher` 脚本即可。

---

`windows/OpenClawOneClick.iss` 中的 `[Run]` / 开始菜单快捷方式，建议指向：

- **路线 A**：`{app}\launcher\OpenClawLobster.cmd` 内顺序调用：安装 CLI（若未装）→ `start-lobster-standalone.ps1` → 打开浏览器 `/setup`。  
- **路线 B**：快捷方式仅调用 `start-lobster-standalone.ps1` + 打开浏览器；CLI 由用户在 `/setup` 预检页引导安装。

具体参数与路径需按你打包后的 `{app}` 目录结构调整。

---

## 6. 小结（给产品经理的一句话）

- **`/setup` 属于「控制台已启动」之后的世界**；**不等于**「用户已装完 openclaw**。  
- **EXE 向导**负责把环境铺好并**最好一键打开 `/setup`**；**先起 3003** 的路线则把「装 CLI」明确放进**浏览器预检**里。  
- 两条路可以并存：**同一套脚本，不同的启动编排**；用户只需认准：**最终都是在浏览器里完成模型与密钥配置**。

---

## 7. 完整安装包（Full Setup）— 实施状态（2026-03-17）

与上文「路线 A」配套的 **自包含** 安装器已单独用 **`windows/OpenClawOneClick.Full.iss`** 维护（与演示用 **`OpenClawOneClick.iss`** 区分）：

| 能力 | 说明 |
|------|------|
| 便携 **Node** / **MinGit** | 编译前执行 **`windows/prepare-full-redist.ps1`** 填充 `installer-bundle/redist/`；未填充时安装包仍可编译，但安装后脚本会检测缺失并**弹窗**引导去 nodejs.org / git-scm.com。 |
| **用户 PATH** | 安装结束由 **`installer-bundle/scripts/install-bundled-tools.ps1`**（隐藏 PowerShell）追加 `{app}\tools\node` 与 `{app}\tools\git\cmd`；卸载时 **`-Uninstall`** 清理本包相关 PATH 项。 |
| **品牌图 / 图标** | **`assets-wizard/Generate-WizardAssets.ps1`** 生成 `SetupApp.ico`、向导背景等，与 Full.iss 中引用一致。 |
| **静默安装** | 见 **`windows/FULL_INSTALL.md`**（`/VERYSILENT` 等；注意 `/SUPPRESSMSGBOXES` 可能抑制失败提示）。 |

**开发续作索引**：项目内 **[`docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md`](../../docs/DEPLOYMENT_AND_WINDOWS_PACKAGING_HANDOFF.zh-CN.md)**（含编译命令、待办清单、与 `/setup` 的衔接）。
