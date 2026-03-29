# Inno Setup 向导文案（`Messages` / `CustomMessages`）



本目录提供与 **[WINDOWS_USER_JOURNEY.zh-CN.md](../WINDOWS_USER_JOURNEY.zh-CN.md)** 一致的安装向导**英文**与**简体中文**覆盖文案，便于 **路线 A（传统 `Setup.exe`）** 落地。



## 文件说明



| 文件 | 作用 |

|------|------|

| `Messages.oneclaw.en.isl` | 覆盖英文向导中的欢迎页第二段、完成页标题与正文、「完成」按钮提示等（`[Messages]`） |

| `Messages.oneclaw.zh-CN.isl` | 同上，简体中文（与 `inno-languages\ChineseSimplified.isl` 合并使用） |

| `CustomMessages.oneclaw.en.isl` | 英文 `{cm:...}`，用于 `[Run]` 的 `Description`、`[Icons]` 等 |

| `CustomMessages.oneclaw.zh.isl` | 简体中文 `{cm:...}`（同上） |

| `inno-languages\ChineseSimplified.isl` | 简体界面基础文案（部分安装方式未带中文语言包时随仓库附带） |

| `assets-wizard\WizardBack-994.png` / `WizardBack-596.png` | **Inno 6.7+** 全页背景：**无文字**浅色渐变（商业软件常见风格），见 **`INSTALLER_UI_DESIGN.md`** |
| `assets-wizard\WizardCorner55.png` | 角标 Logo（`WizardSmallImageFile`） |
| `public\brand-mark.png`（面板根目录） | 与首页相同；`Generate-WizardAssets.ps1` 默认读此文件生成安装包角标/图标 |
| `assets-wizard\SetupApp.ico` | 安装包图标（`SetupIconFile`，由 `WizardCorner55` 缩放生成） |
| `assets-wizard\Generate-WizardAssets.ps1` | 从参考图批量生成上述资源；说明见 `assets-wizard\README.md` |

> **说明**：Inno 在作为 `[Languages]` 的 `MessagesFile` 加载时，**不能**在 `[CustomMessages]` 里使用 `english.xxx` / `chinesesimp.xxx` 前缀，故拆成 `.en.isl` / `.zh.isl` 两个文件。

**语言选择对话框**仍是系统原生小窗，无法做成网页同款；已通过 `SelectLanguageTitle` / `SelectLanguageLabel` 与 `SetupWindowTitle` 统一品牌话术。



## 在 `.iss` 里引用



见 `OpenClawOneClick.iss` 中 `[Languages]`：



```iss

[Languages]

Name: "english"; MessagesFile: "compiler:Default.isl,Messages.oneclaw.en.isl,CustomMessages.oneclaw.en.isl"

Name: "chinesesimp"; MessagesFile: "inno-languages\ChineseSimplified.isl,Messages.oneclaw.zh-CN.isl,CustomMessages.oneclaw.zh.isl"

```



**路径**：若 `.isl` 与 `.iss` 同目录，可直接写文件名；否则使用相对路径。



## `[Run]` 示例（完成页复选框）



```iss

[Run]

Filename: "{app}\launcher\OpenClawLobster.cmd"; \

  Description: "{cm:RunLaunchConsole}"; \

  Flags: postinstall nowait skipifsilent

```



将 `OpenClawLobster.cmd` 换成你真实的启动脚本（内部应调用 `start-lobster-standalone.ps1` 并打开浏览器 `/setup`）。



## `{cm:...}` 可用键（定义在 `CustomMessages.oneclaw.*.isl`）



- `RunLaunchConsole` — 推荐：启动控制台并打开 `/setup`

- `RunOpenUserJourney` — 可选：用 `notepad`/`explorer` 打开说明文档（需在 `[Run]` 里自行写 `Filename`）

- `IconConsole` / `IconReadme` — 给 `[Icons]` 的 `Comment` 或文档图标用（按需）



## 编译



1. 安装 [Inno Setup 6](https://jrsoftware.org/isdl.php)（`winget install JRSoftware.InnoSetup` 常见安装路径：`%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`）  

2. 打开或命令行编译 `OpenClawOneClick.iss`，检查 `Source` / `{app}` 结构  



修改产品名时：可同时改 `#define MyAppName` 与上述 `.isl` 中「ONE CLAW」表述，保持与安装包品牌一致。

