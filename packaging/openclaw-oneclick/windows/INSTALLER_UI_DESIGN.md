# ONE CLAW Windows 安装包界面原则（Inno Setup）

## 对齐目标：常见商业桌面软件

与 **Visual Studio Code、Slack、Notion、Microsoft 365 桌面组件** 等安装体验一致：

- **浅色主背景**（近白 / 极浅灰），**深色系统字体**，可读性优先  
- **无产品主界面整屏截图**作背景（避免与控件文字叠影）  
- **小尺寸 Logo / 角标** + 可选 **极细品牌色条**，不喧宾夺主  
- 步骤线性、默认路径清晰（参见 [Setup - Win32 apps](https://learn.microsoft.com/windows/win32/uxguide/exper-setup)）

## 不要做什么

- **禁止**把网页控制台、部署向导的整页截图当作 `WizardBackImageFile`。

## 与 ONE CLAW 品牌的关系

- **可保留**：品牌红细条、角标上的点缀色、文案逻辑（欢迎页 / 完成页说明）。  
- **安装器本体**：走 **商业软件常见的浅色向导**，网页里的深色控制台 UI **不作为**安装包视觉模板。

## 本仓库实现

- `assets-wizard/Generate-WizardAssets.ps1` 生成 **浅色无字渐变 PNG** + 底部分割红条 + **白底角标**。  
- `OpenClawOneClick.iss` 中 `WizardBackColor` 为浅灰（`#f5f5f5`），与背景图一致；`WizardBackImageFileDynamicDark` **仍指向浅色图**，避免系统深色模式下反色导致对比混乱。

## 可选：`reference-*.png`

若仓库中仍有截图文件，**仅作产品与文案对照**，勿再作为全页背景源图。
