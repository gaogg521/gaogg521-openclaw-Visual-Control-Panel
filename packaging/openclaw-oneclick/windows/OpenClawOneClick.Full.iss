; ONE CLAW OneClick — 完整安装包（便携 Node + MinGit + 用户 PATH + 可选 standalone + 启动器）
; 编译前请在本目录依次执行（按需）：
;   1) .\prepare-full-redist.ps1          （下载 Node zip + MinGit 到 installer-bundle\redist，体积较大）
;   2) .\prepare-bundled-standalone.ps1    （可选，带上 .next\standalone）
;   3) .\assets-wizard\Generate-WizardAssets.ps1  （角标/图标与首页 brand-mark 一致）
;   ISCC.exe OpenClawOneClick.Full.iss

#define MyAppName "ONE CLAW OneClick"
#define MyAppVersion "0.2.0"
#define MyAppPublisher "1one"

[Setup]
AppId={{B2C3D4E5-F6A7-8901-BCDE-F12345678901}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
SetupIconFile=assets-wizard\SetupApp.ico
DefaultDirName={localappdata}\ONECLAW-OneClick
DefaultGroupName={#MyAppName}
OutputDir=Output
OutputBaseFilename=ONECLAW-OneClick-Full-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardBackImageFile=assets-wizard\WizardBack-994.png,assets-wizard\WizardBack-596.png
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
Name: "chinesesimp"; MessagesFile: "inno-languages\ChineseSimplified.isl,Messages.oneclaw.zh-CN.isl,CustomMessages.oneclaw.zh.isl"

[Files]
Source: "installer-bundle\launcher\OpenClawLobster.cmd"; DestDir: "{app}\launcher"; Flags: ignoreversion
Source: "installer-bundle\launcher\OpenClawLobster.ps1"; DestDir: "{app}\launcher"; Flags: ignoreversion
Source: "installer-bundle\scripts\check-lobster-port.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "installer-bundle\scripts\install-bundled-tools.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
#if FileExists("installer-bundle\redist\node\node.exe")
Source: "installer-bundle\redist\node\*"; DestDir: "{app}\tools\node"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
#if FileExists("installer-bundle\redist\git\cmd\git.exe")
Source: "installer-bundle\redist\git\*"; DestDir: "{app}\tools\git"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
#if FileExists("installer-bundle\standalone\server.js")
Source: "installer-bundle\standalone\*"; DestDir: "{app}\standalone"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
Source: "installer-bundle\README_DEMO.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\WINDOWS_USER_JOURNEY.zh-CN.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "FULL_INSTALL.md"; DestDir: "{app}\docs"; Flags: ignoreversion isreadme
Source: "INNO_MESSAGES_README.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "INSTALLER_UI_DESIGN.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "Messages.oneclaw.en.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "Messages.oneclaw.zh-CN.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "CustomMessages.oneclaw.en.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion
Source: "CustomMessages.oneclaw.zh.isl"; DestDir: "{app}\docs\inno-sources"; Flags: ignoreversion

[Run]
; 静默配置用户 PATH 并自检 node/git；失败则弹窗引导手动安装
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\scripts\install-bundled-tools.ps1"" -AppDir ""{app}"""; Flags: waituntilterminated runhidden; StatusMsg: "正在配置 Node/Git 环境..."
Filename: "{app}\launcher\OpenClawLobster.cmd"; Description: "{cm:RunLaunchConsole}"; Flags: postinstall nowait skipifsilent
Filename: "{win}\notepad.exe"; Parameters: """{app}\docs\FULL_INSTALL.md"""; Description: "{cm:RunOpenUserJourney}"; Flags: postinstall skipifsilent unchecked

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\launcher\OpenClawLobster.cmd"; Comment: "{cm:IconConsole}"
Name: "{group}\{#MyAppName} Readme"; Filename: "{win}\notepad.exe"; Parameters: """{app}\docs\FULL_INSTALL.md"""; Comment: "{cm:IconReadme}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\launcher\OpenClawLobster.cmd"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\scripts\install-bundled-tools.ps1"" -AppDir ""{app}"" -Uninstall"; Flags: runhidden; RunOnceId: OneClickStripUserPath

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
