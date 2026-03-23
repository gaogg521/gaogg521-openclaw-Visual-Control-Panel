/** 像素办公室：多套独立「小游戏」场景（布局 + 陈设主题） */

export type OfficeGameId = 'classic' | 'starship' | 'grove'

export const OFFICE_GAME_IDS: OfficeGameId[] = ['classic', 'starship', 'grove']

export const OFFICE_GAME_STORAGE_KEY = 'pixel-office-game-id'

export function parseOfficeGameId(raw: string | null | undefined): OfficeGameId {
  if (raw === 'starship' || raw === 'grove' || raw === 'classic') return raw
  return 'classic'
}

/**
 * 画布外圈：渐变 + 内发光，与经典办公室明显区隔（非单纯换纯色底）
 */
export function getOfficeGameCanvasBackdropClass(id: OfficeGameId): string {
  switch (id) {
    case 'starship':
      // 整段写在字面量里便于 Tailwind 扫描
      return 'bg-gradient-to-b from-[#03060d] via-[#0a1428] to-[#020408] shadow-[inset_0_0_100px_rgba(56,189,248,0.07)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-[0.12] before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(56,189,248,0.06)_2px,rgba(56,189,248,0.06)_3px)] before:content-[""]'
    case 'grove':
      return 'bg-gradient-to-br from-[#0a1810] via-[#122818] to-[#061208] shadow-[inset_0_0_90px_rgba(52,211,153,0.06)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-[0.08] before:bg-[radial-gradient(ellipse_at_30%_20%,rgba(74,222,128,0.15),transparent_50%),radial-gradient(ellipse_at_70%_80%,rgba(34,197,94,0.1),transparent_45%)] before:content-[""]'
    default:
      return 'bg-[#1a1a2e]'
  }
}

/** 画布区域：主题相框（霓虹/苔绿），强化「小游戏」感 */
export function getOfficeGameCanvasFrameClass(id: OfficeGameId): string {
  switch (id) {
    case 'starship':
      return 'rounded-sm shadow-[0_0_48px_rgba(34,211,238,0.12),inset_0_0_0_2px_rgba(56,189,248,0.35)]'
    case 'grove':
      return 'rounded-sm shadow-[0_0_40px_rgba(52,211,153,0.1),inset_0_0_0_2px_rgba(74,222,128,0.28)]'
    default:
      return ''
  }
}

/** 顶栏底边：与当前小游戏主题呼应 */
export function getOfficeGameTopBarClass(id: OfficeGameId): string {
  switch (id) {
    case 'starship':
      return 'border-b border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 via-transparent to-blue-950/30'
    case 'grove':
      return 'border-b border-emerald-500/20 bg-gradient-to-r from-emerald-950/35 via-transparent to-lime-950/20'
    default:
      return 'border-b border-[var(--border)]'
  }
}
