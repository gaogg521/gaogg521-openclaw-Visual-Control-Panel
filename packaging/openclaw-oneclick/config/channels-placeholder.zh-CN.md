# 通道默认占位说明（飞书 / 企微 / 钉钉 / QQ）

一键安装完成后，IM 连接参数建议在 **龙虾可视化控制面板 → 通道管理**（`/channels`）或 OpenClaw 官方配置中填写。

OpenClaw 各通道的 **JSON 字段名** 随版本变化，本仓库**不硬编码**假 JSON，以免与真实 `openclaw.json` 冲突。请按你当前 OpenClaw 文档中的 channel 类型填写，例如：

| 平台   | 常见配置项（示例名，以官方为准） |
|--------|-----------------------------------|
| 飞书   | App ID、App Secret、加密密钥、验证 Token 等 |
| 企业微信 | CorpId、AgentId、Secret 等 |
| 钉钉   | AppKey、AppSecret、机器人相关参数等 |
| QQ / NTQQ | 以你所用 adapter 插件文档为准 |

安装包可在发布说明中附上「通道配置检查清单」链接到 OpenClaw 官方 **Channels** 文档。
