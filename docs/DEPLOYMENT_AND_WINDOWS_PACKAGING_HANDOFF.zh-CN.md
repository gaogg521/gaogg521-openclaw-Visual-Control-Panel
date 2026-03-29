# 续作交接：部署向导（`/setup`）与 Windows 安装包

> **用途**：保存「今天进度」与「下次从哪里接着做」的上下文；**勿写入密钥或真实 API Key**。  
> **更新日期**：2026-03-17  
> **说明**：按你的要求**不强制提交 Git**；本地保存本文件即可与团队同步。

---

## 1. 部署向导（浏览器 `/setup`）

### 1.1 产品定位

- **入口**：控制台（默认 **3003**）启动后，浏览器访问 **`http://localhost:3003/setup`**。
- **前提**：**不等于**已安装 `openclaw` CLI。未检测到时页面为**预检区**（安装命令 +「重新检测」）。
- **通过后**：五步向导（提供商 → 密钥/模型 → 确认 → 后台 `openclaw onboard --non-interactive` → 完成）。
- **API**：`POST /api/setup/onboard` 等，详见 `app/api/setup/` 与根目录 `README.md` 路由表。

### 1.2 与安装包的关系

| 路线 | 谁负责「先起 3003」 | 谁负责「装 CLI」 |
|------|---------------------|------------------|
| **A：传统 Setup.exe** | 安装完成页 / 启动器 | 可后台调 `install-openclaw-windows.ps1`，或仍交给 `/setup` 预检引导 |
| **B：绿色包 / 先 Web** | 用户双击启动器 | 主要在 `/setup` 预检页引导用户执行命令 |

用户向心说明文档：**[packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md](../packaging/openclaw-oneclick/WINDOWS_USER_JOURNEY.zh-CN.md)**。

### 1.3 续作时可核对项

- [ ] 安装器在**同一会话**内装完 CLI 后，是否提示用户**新开终端 / 重登**再点「重新检测」（PATH 生效延迟）。
- [ ] 端口 **3003** / **18789** 占用时的错误提示是否与 `check-lobster-port.ps1`、网关文档一致。
- [ ] 远程访问向导时的安全开关（如 `SETUP_ALLOW_REMOTE`）是否在对外分发说明中写清。

---

## 2. Windows 客户端安装包（Inno Setup）

### 2.1 两套 ISS 区分

| 文件 | 定位 |
|------|------|
| **`packaging/openclaw-oneclick/windows/OpenClawOneClick.iss`** | **演示/轻量包**：向导图、角标、启动器；**不**内置便携 Node/Git（可按需扩展）。 |
| **`packaging/openclaw-oneclick/windows/OpenClawOneClick.Full.iss`** | **完整包**：可选打入 **便携 Node + MinGit**、安装后**静默写用户 PATH**、失败弹窗引导官网；可选 **standalone**。 |

### 2.2 完整包关键文件（相对 `windows/`）

| 路径 | 作用 |
|------|------|
| **`prepare-full-redist.ps1`** | 联网下载 Node win-x64 zip、MinGit zip，解压到 **`installer-bundle/redist/node/`**、**`.../redist/git/`**（`git/cmd/git.exe`）。 |
| **`prepare-bundled-standalone.ps1`** | （可选）把龙虾 **`next build` standalone** 拷到 **`installer-bundle/standalone/`**。 |
| **`assets-wizard/Generate-WizardAssets.ps1`** | 生成与站点 **brand-mark** 一致的安装器 **图标 / 向导背景 / 角标**。 |
| **`installer-bundle/scripts/install-bundled-tools.ps1`** | 安装结束：**追加** `{app}\tools\node`、`{app}\tools\git\cmd` 到**当前用户 PATH**，广播环境变更；自检 `node`/`git` 可执行；失败 **MessageBox** + 官网链接；**`-Uninstall`** 时从 PATH 剥离本包 `tools\` 前缀项。 |
| **`installer-bundle/launcher/OpenClawLobster.ps1`** | 启动时**优先** `{app}\tools\node\node.exe`，否则用 PATH。 |
| **`FULL_INSTALL.md`** | 维护者与用户说明；含**静默安装**参数及 `/SUPPRESSMSGBOXES` 会抑制失败弹窗的提醒。 |
| **`installer-bundle/redist/.gitignore`** | 忽略 `node/`、`git/`、zip，避免大文件误提交。 |

### 2.3 编译命令（维护者）

在 **`packaging/openclaw-oneclick/windows`** 目录：

```powershell
.\prepare-full-redist.ps1
.\prepare-bundled-standalone.ps1   # 可选
.\assets-wizard\Generate-WizardAssets.ps1
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" .\OpenClawOneClick.Full.iss
```

**输出**：`windows/Output/ONECLAW-OneClick-Full-Setup.exe`。

### 2.4 2026-03-17 已验证

- 使用 **Inno Setup 6.7.1** 对 **`OpenClawOneClick.Full.iss`** 编译 **成功**（未预先下载 redist 时，安装包仍可通过 `#if FileExists` 跳过 Node/Git 段，仅含启动器与脚本；此时安装后脚本会检测缺失并弹窗引导手动安装）。
- **`[Run]`** 中已去掉不稳定的 `Check: Is64BitInstallMode`，避免递归或版本差异问题。

### 2.5 建议续作（未闭环）

- [ ] **CI**：在流水线中跑 `prepare-full-redist.ps1` 再 ISCC，产物上传；版本号与 Node/MinGit **URL 常量**在脚本顶部定期更新。
- [ ] **代码签名**：`Setup.exe` 与可执行组件的 Authenticode。
- [ ] **与官方 CLI 安装串联**：是否在 Full 包 `[Run]` 中在 PATH 配置**之后**调用 **`install-openclaw-windows.ps1`**（需注意权限、静默参数与用户提示）。
- [ ] **卸载**：当前 `[UninstallDelete]` 为整目录删除；确认与「用户另行安装的全局 Node/Git」无冲突（脚本已只删带 `{app}\tools` 前缀的 PATH 项）。

---

## 3. 相关文档索引

| 文档 | 内容 |
|------|------|
| [packaging/openclaw-oneclick/README.md](../packaging/openclaw-oneclick/README.md) | 一键脚本总览 + Full 包条目 |
| [packaging/openclaw-oneclick/windows/FULL_INSTALL.md](../packaging/openclaw-oneclick/windows/FULL_INSTALL.md) | Full 包用户/维护说明 |
| [packaging/openclaw-oneclick/windows/INSTALLER_UI_DESIGN.md](../packaging/openclaw-oneclick/windows/INSTALLER_UI_DESIGN.md) | 安装器 UI 设计 |
| [WORK_SESSION_2026-03-17.md](../WORK_SESSION_2026-03-17.md) | 同日其他工作（如模型页/探测）存档 |

---

## 4. 一句话记忆（给下次打开仓库的你）

**浏览器 `/setup` 管「控制台已起来之后的配置」；Windows `OpenClawOneClick.Full.iss` 管「把 Node/Git（可选）+ 启动器 + standalone（可选）打进 exe，并尽量静默写好用户 PATH，失败则弹窗让用户去官网补装」。**
