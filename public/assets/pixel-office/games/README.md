# 主题小游戏素材

| 目录 | 场景 | 视觉风格 |
|------|------|----------|
| `starship/` | 星际舰桥 | 金属舱壁、冷色甲板、青蓝光效、星空舷窗海报 |
| `grove/` | 蘑菇林地 | 树皮/木色墙、木纹与苔原地板、暖绿角色、林间海报 |

与 `classic` 经典办公室完全隔离；切换场景时由 `applyPixelAssetPackForGame` 加载对应目录。

重新生成两套 PNG：

```bash
npm run generate-pixel-assets
```

裁切规则沿用上级目录的 `../atlas-manifest.json`（脚本会复制进各子目录）。
