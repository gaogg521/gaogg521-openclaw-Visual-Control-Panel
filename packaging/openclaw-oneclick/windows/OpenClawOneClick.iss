; Inno Setup 6 — 可编译演示包（含中英向导文案 + 启动器 + 文档）
; 完整产品请再打入 Node、standalone、install 脚本等 — 见上级 README.md
;
; 编译: 安装 Inno Setup 6 后执行（winget 常见路径见下）
;   "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" OpenClawOneClick.iss
;   或 "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" OpenClawOneClick.iss

#define MyAppName "ONE CLAW OneClick (Demo)"
#define MyAppVersion "0.1.0-demo"
#define MyAppPublisher "1one"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
SetupIconFile=assets-wizard\SetupApp.ico
; 用户级目录，避免要管理员权限
DefaultDirName={localappdata}\ONECLAW-OneClick-Demo
DefaultGroupName={#MyAppName}
OutputDir=Output
OutputBaseFilename=ONECLAW-OneClick-Setup-demo
Compression=lzma2
SolidCompression=yes
; 6.7+：浅色 Fluent 风（常见商业软件安装包），无网页截图 — 见 INSTALLER_UI_DESIGN.md
WizardStyle=modern
WizardBackImageFile=assets-wizard\WizardBack-994.png,assets-wizard\WizardBack-596.png
; 明暗主题均用同一套浅色底，保证说明文字始终深色、易读（与 VS Code 等安装器一致）
WizardBackImageFileDynamicDark=assets-wizard\WizardBack-994.png,assets-wizard\WizardBack-596.png
WizardBackColor=#f5f5f5
WizardBackColorDynamicDark=#f5f5f5
WizardImageFile=
WizardSmallImageFile=assets-wizard\WizardCorner55.png
PrivilegesRequired=lowest
DisableProgramGroupPage=no
UninstallDisplayIcon={app}\launcher\OpenClawLobster.cmd

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl,Messages.oneclaw.en.isl,CustomMessages.oneclaw.en.isl"
; winget 用户级安装可能不含中文语言包，故随仓库附带官方 issrc 非官方简体 .isl
Name: "chinesesimp"; MessagesFile: "inno-languages\ChineseSimplified.isl,Messages.oneclaw.zh-CN.isl,CustomMessages.oneclaw.zh.isl"

[Files]
Source: "installer-bundle\launcher\OpenClawLobster.cmd"; DestDir: "{app}\launcher"; Flags: ignoreversion
Source: "installer-bundle\launcher\OpenClawLobster.ps1"; DestDir: "{app}\launcher"; Flags: ignoreversion
Source: "installer-bundle\scripts\check-lobster-port.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
; 仅当已运行 prepare-bundled-standalone.ps1 且存在 server.js 时编译本段（ISPP，避免无 standalone 时编译失败）
#if FileExists("installer-bundle\standalone\server.js")
Source: "installer-bundle\standalone\*"; DestDir: "{app}\standalone"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
Source: "installer-bundle\README_DEMO.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme
Source: "..\WINDOWS_USER_JOURNEY.zh-CN.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "INNO_MESSAGES_README.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "INSTALLER_UI_DESIGN.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "Messages.oneclaw.en.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "Messages.oneclaw.zh-CN.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "CustomMessages.oneclaw.en.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "CustomMessages.oneclaw.zh.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion

[Run]
Filename: "{app}\launcher\OpenClawLobster.cmd"; Description: "{cm:RunLaunchConsole}"; Flags: postinstall nowait skipifsilent
Filename: "{win}\notepad.exe"; Parameters: """{app}\docs\WINDOWS_USER_JOURNEY.zh-CN.md"""; Description: "{cm:RunOpenUserJourney}"; Flags: postinstall skipifsilent unchecked

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\launcher\OpenClawLobster.cmd"; Comment: "{cm:IconConsole}"
Name: "{group}\{#MyAppName} Readme"; Filename: "{win}\notepad.exe"; Parameters: """{app}\docs\WINDOWS_USER_JOURNEY.zh-CN.md"""; Comment: "{cm:IconReadme}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\launcher\OpenClawLobster.cmd"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
