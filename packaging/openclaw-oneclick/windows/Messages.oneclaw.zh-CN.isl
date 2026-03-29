; ONE CLAW 控制台 — 简体中文向导文案（合并在 ChineseSimplified.isl 之后）
; 与 ../WINDOWS_USER_JOURNEY.zh-CN.md 路线 A（传统 Setup.exe）一致

[Messages]
; 窗口标题与语言选择页（无法换肤为网页 UI，但文案与部署向导一致）
SetupAppTitle=ONE CLAW OneClick
SetupWindowTitle=ONE CLAW OneClick - %1
SelectLanguageTitle=ONE CLAW — 选择安装语言
; 仅一行说明，避免语言小窗拥挤；详细流程见下一页「欢迎」
SelectLanguageLabel=请选择安装界面语言：English 或 简体中文。

; 欢迎页
WelcomeLabel1=欢迎使用 ONE CLAW OneClick 安装向导
WelcomeLabel2=本向导将把 ONE CLAW 命令行工具与 Web 控制台安装到本机。%n%n安装过程可能需要从网络下载官方组件（例如 openclaw.ai），请保持网络畅通。%n%n在最后一步可选择自动启动控制台，并在浏览器中打开配置向导（默认：http://localhost:3003/setup）。

; 完成页
FinishedHeadingLabel=安装已完成
FinishedLabel=ONE CLAW 已安装到您的计算机。%n%n若您在完成页勾选了「启动控制台并打开配置向导」，将自动打开浏览器。%n%n若页面提示尚未检测到命令行工具：请先在浏览器页面按说明在 PowerShell 中完成安装，然后新开浏览器窗口或重新登录 Windows，再在页面点击「重新检测」。%n%n配置向导默认仅接受来自本机（localhost）的访问，除非管理员另行配置。
ClickFinish=点击「完成」退出安装向导。

; 可选：向导底部状态栏
BeveledLabel=更多说明见上级目录 WINDOWS_USER_JOURNEY.zh-CN.md
