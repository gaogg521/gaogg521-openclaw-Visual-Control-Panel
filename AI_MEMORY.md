# AI_MEMORY.md

## Purpose
Long-term project memory for the assistant to prevent context loss when chat history is truncated.
Update this file after key decisions, architecture changes, environment updates, and user constraints.

## Project Identity
- Project: 龙虾可视化控制面板
- Stack: Next.js + TypeScript + Tailwind
- Run port: 3003 (`npm run dev`, `npm run start`)
- OPENCLAW_HOME default: `C:/Users/allenzhao/.openclaw`

## Key Paths
- Project root: `d:/Openclaw项目和工具/Openclaw-SKILLS-OneOne-/软件SOFT/龙虾可视化控制面板`
- OpenClaw home: `C:/Users/allenzhao/.openclaw`
- OpenClaw main config: `C:/Users/allenzhao/.openclaw/openclaw.json`
- Pixel office layouts: `layout.json`（经典）+ `layout-starship.json` / `layout-grove.json`（另两套场景），均在 `~/.openclaw/pixel-office/`；场景选择在 `localStorage` 键 `pixel-office-game-id`。
- Chat history anchor: `AI_CHAT_LOG.md`

## User Hard Rules (MUST follow)
1. Before any modification to OpenClaw JSON config files, remind user first.
2. Always auto-backup JSON before editing, with timestamp style `xx-xx-xx-xx`.
3. Any OpenClaw config JSON changes must be verified against official supported schema/format first.
4. If format is not officially supported, do NOT write unsupported fields into config JSON; use alternative implementation.

## Confirmed Facts
- `openclaw-office` under `.openclaw` is NOT this dashboard project.
- `.openclaw/pixel-office` is dashboard data directory for layout persistence only.
- Static pixel assets are in project `public/assets/pixel-office/`.

## Recent Fixes
- Fixed weekly/monthly chart disappearance by guarding undefined data in `global-stats-trend` and normalizing `allStats` shape in `oneone-dashboard`.
- Updated README/quick_start repository references to `gaogg521/Openclaw-SKILLS-OneOne-`.
- Added README attribution thanking initial author `xmanrui`.
- Main dashboard action area refresh:
  - Replaced "测试 Agent" with "查看CLAW状态" and added `/api/openclaw/gateway-status`.
  - Added shell-style output modal for diagnostics/restart/status actions.
  - Implemented 5-theme selector and strengthened visual differences for custom themes.
- Chat entry and in-project chat module:
  - "我要聊天" now routes to internal `/chat` page (no longer opens OpenClaw external web UI).
  - Added APIs: `/api/chat/connect` and `/api/chat/completions`.
  - Server reads gateway token from `openclaw.json` (`gateway.auth.token`) for chat requests.
  - Added HTTP -> CLI fallback for environments where `/v1/chat/completions` returns Not Found.
  - Fixed CLI fallback unknown-agent issue by prioritizing `sessionId` and adding sessionId lookup from `sessions.json`.
  - Added session connection status model (`未连接` / `会话已就绪` / `已连接`) and auto-connect on agent switch.
  - Added local history persistence by `agentId + sessionKey` in browser localStorage (restore after refresh/reopen).
- Pixel office **三套独立游戏场景**（非仅滤镜）：经典办公室 / 星际舰桥 / 蘑菇林地；新布局与 emoji 主题道具见 `lib/pixel-office/layout/alternateLayouts.ts`；已移除旧的 `visualStyles` 滤镜切换。

## Operational Notes
- If port 3003 is occupied, likely existing Next.js service for this dashboard.
- Restart sequence:
  1) stop occupying PID on 3003
  2) run `npm run dev` in project root
- If `http://localhost:3003` is unreachable after restarting OpenClaw, verify Next.js dev process is still alive; dashboard service is Node/Next.js and can exit independently.
- Multi-language ONECLAW project (separate): frontend Vite (517x), backend FastAPI (8001).

## Update Protocol
After each meaningful session, append:
- Date/time
- What changed
- Risks/constraints discovered
- Next pending tasks
- Write/append related chat context into `AI_CHAT_LOG.md`

## Chat Persistence
- Keep recording conversation context continuously in `AI_CHAT_LOG.md` to prevent memory loss when context overflows.
