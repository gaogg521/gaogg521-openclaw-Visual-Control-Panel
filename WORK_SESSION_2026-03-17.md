# 工作存档 · 2026-03-17（龙虾可视化控制面板）

本文档用于「今天收工 / 下次续作」对齐上下文，**勿写入密钥**。

## 本轮已完成（模型页 / 探测）

- **`lib/model-probe.ts`**：直连探测多策略（`max_tokens` → `max_completion_tokens` → 无长度等）；`anthropic-messages` 字符串 content / 块数组多档重试；支持 `overrideApiKey`、`probePresetId`、`customHttp`、`agentId`；合并 `agents/<Agent>/agent/models.json` + `main` + `openclaw.json`。
- **`lib/model-probe-presets.ts`** + **`model-probe-presets.example.json`**：从 JSON / `openclaw.json` 内嵌加载探测预设；**`model-probe-presets.json` 已 gitignore**。
- **`app/api/test-model`**、**`app/api/model-probe-presets`**、**`app/api/config/add-provider-model`**（`overrideApiKey` 等）。
- **`app/models/page.tsx`**：临时 Key、探测预设、Agent 上下文、新增模型「探测方式」（OpenClaw / 自建 HTTP / JSON 预设）、`model` + `model_provider` 字段、推荐值在填模型 ID 后出现。
- **`lib/model-defaults.ts`**：`suggestModelCapacity`、Qwen 等提示。
- **`lib/i18n.tsx`**：上述文案（简中 / 繁中 / 英文）。
- **`README.md`**：探测预设说明。

## 可选续作（未做或待验证）

- OpenClaw CLI 是否支持按 **Agent** 探针（非仅合并 models.json）。
- **`model_provider` 独立写入** openclaw `models[]` 字段（需确认 OpenClaw schema）。
- 内网 **gemini** 直连探测（若产品需要）。

## 数据库同步（MySQL）

配置好 `.env.local` 中 `MYSQL_*` 后任选其一：

1. 仪表盘运行时：`POST http://localhost:3003/api/storage/sync`（或 UI「存储洞察」里同步按钮，若已接）。
2. 写入配置相关 API 成功后部分路径会 **自动** `syncOpenclawToMysql`（见 `add-provider-model` 等）。

**本地无服务时**：无法在本机替你执行 HTTP 同步；下次启动 `npm run dev` 后补一次 POST 即可。

## Git 提交建议

仅提交本目录时（在仓库根）：

```bash
git add "软件SOFT/龙虾可视化控制面板/"
git status
git commit -m "feat(dashboard): 模型探测预设、Agent 上下文、自建 HTTP、表单与 i18n"
```

注意：勿提交 `model-probe-presets.json`、`.env.local`、以及误加的 `.zip` 大包。
