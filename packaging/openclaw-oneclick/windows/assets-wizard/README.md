# 安装向导视觉资源

## 原则（重要）

**禁止**将网页/控制台**整页截图**作为 `WizardBackImageFile`。  
当前为 **常见商业软件式浅色向导**（淡灰白渐变 + 细红条 + 白底角标），见 **`../INSTALLER_UI_DESIGN.md`**。

## Logo 源图（与网页首页一致）

默认使用**龙虾面板仓库**根目录下的 **`public/brand-mark.png`**（与侧栏/部署向导首页相同，由 `npm run brand:mark` 从源图生成）。  
安装包 **`WizardCorner55.png` / `SetupApp.ico`** 会按 **55×55** 内等比留白缩放。

若 `brand-mark.png` 不存在，会回退 **`assets-wizard/game-logo.png`**。

指定其它文件：

```powershell
.\assets-wizard\Generate-WizardAssets.ps1 -LogoPath "D:\path\to\logo.png"
```

## 生成命令

```powershell
.\assets-wizard\Generate-WizardAssets.ps1
```

输出：

| 文件 | 用途 |
|------|------|
| `WizardBack-994.png` / `WizardBack-596.png` | 无文字深色渐变 + 底部分割红条，`WizardBackImageFile` 多档 |
| `WizardBackDark.png` | 与 994 档相同，便于预览 |
| `WizardCorner55.png` | `WizardSmallImageFile` |
| `SetupApp.ico` | `SetupIconFile` |

## `reference-*.png`（若仍存在）

仅作**产品/文案对照**，**不要**再接入生成脚本当全页背景。
