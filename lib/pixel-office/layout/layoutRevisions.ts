import type { OfficeGameId } from '../gameThemes'
import type { OfficeLayout } from '../types'

/**
 * 主题地图大改版时递增：本地已保存的 layout-starship.json / layout-grove.json
 * 若 revision 低于此值，客户端会丢弃存档改用代码内最新预设（避免永远套着旧经典陈设）。
 */
export const THEME_LAYOUT_REVISION: Record<OfficeGameId, number> = {
  classic: 0,
  starship: 5,
  grove: 5,
}

export function isSavedThemeLayoutStale(game: OfficeGameId, layout: OfficeLayout | null | undefined): boolean {
  if (!layout || game === 'classic') return false
  const need = THEME_LAYOUT_REVISION[game]
  const rev = layout.revision ?? 0
  return rev < need
}
