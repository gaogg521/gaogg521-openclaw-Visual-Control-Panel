# 像素办公室素材说明

## 经典办公室（`classic`）

**不使用**本目录下除 `photograph.webp`、音频、GIF 等共享资源外的「整图替换」文件。  
角色、家具、墙、地板均为 **代码内置原版手绘 / 模板**（见 `lib/pixel-office/sprites/spriteData.ts` 等）。

## 星舰 / 林间（`starship`、`grove`）

**主题化**素材在 `games/starship/`、`games/grove/`（与经典办公室独立）。

每套含：`characters/char_*.png`、`walls.png`、`floors.png`、`furniture-atlas.png`、`atlas-manifest.json`、`cat_sheet.png`、`lobster.png`、`photograph.png`。星舰偏冷色金属+星空墙画，林间偏木色与蘑菇林墙画。

重新生成：

```bash
npm run generate-pixel-assets
```

裁切规则：根目录 `atlas-manifest.json`（脚本会复制到各 `games/*/`）。
