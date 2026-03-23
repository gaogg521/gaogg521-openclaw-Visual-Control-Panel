import type { OfficeGameId } from '../gameThemes'
import type { OfficeLayout } from '../types'
import { createDefaultLayout } from './layoutSerializer'
import { createStarshipLayout, createGroveLayout } from './alternateLayouts'

export function createDefaultLayoutForGame(game: OfficeGameId): OfficeLayout {
  switch (game) {
    case 'starship':
      return createStarshipLayout()
    case 'grove':
      return createGroveLayout()
    default:
      return createDefaultLayout()
  }
}
