# ONE CLAW OneClick — 完整安装包说明

## 安装内容

| 内容 | 说明 |
|------|------|
| **便携 Node.js** | 位于 `{安装目录}\tools\node\`（若编译前已执行 `prepare-full-redist.ps1`） |
| **MinGit** | 位于 `{安装目录}\tools\git\`（同上） |
| **用户 PATH** | 安装结束时脚本会将上述目录**追加到当前用户**环境变量 `Path`，并广播 `Environment` 变更 |
| **控制台** | 若编译前已执行 `prepare-bundled-standalone.ps1`，则含 `standalone\`，启动器会用内置或系统 `node` 拉起 **3003** 并打开 `/setup` |

## 若提示「手动安装」

出现弹窗通常表示：

- 编译安装包时**未**下载 redist（无 `tools\node` 或 `tools\git`），或  
- 内置 `node.exe` / `git.exe` 被安全软件拦截无法执行。

请按弹窗链接安装 **Node.js LTS** 与 **Git for Windows**，安装完成后**重新打开终端**或**重新登录 Windows**，再运行开始菜单中的 ONE CLAW OneClick。

## 卸载

卸载时会尝试从**用户 PATH** 中移除本安装目录下 `tools\...` 相关路径（不删除您单独安装的全局 Node/Git）。

## 维护者：如何打出完整 exe

在 `packaging/openclaw-oneclick/windows` 目录：

```powershell
.\prepare-full-redist.ps1
.\prepare-bundled-standalone.ps1   # 可选
.\assets-wizard\Generate-WizardAssets.ps1
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" .\OpenClawOneClick.Full.iss
```

产物：`Output\ONECLAW-OneClick-Full-Setup.exe`。

`redist` 体积较大，建议加入 `.gitignore`，由 CI 或本机脚本生成。

## 静默安装（命令行）

Inno Setup 支持例如：

```text
ONECLAW-OneClick-Full-Setup.exe /VERYSILENT /NORESTART
```

安装仍会执行隐藏 PowerShell 配置用户 PATH。若使用 `/SUPPRESSMSGBOXES`，**失败时的手动安装提示弹窗也可能被抑制**，请仅在确定 redist 完整、环境无拦截时使用。
