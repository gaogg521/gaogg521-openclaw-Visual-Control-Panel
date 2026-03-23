/**
 * 按「小游戏」切换像素素材包：
 * - classic：内置手绘 sprite + 默认地板/墙（不读 games/*）
 * - starship / grove：读 public/assets/pixel-office/games/<id>/ 下的实验素材
 */
import type { OfficeGameId } from '../gameThemes'
import { clearFloorPatternPNG } from '../floorTiles'
import { clearWallSprites } from '../wallTiles'
import { clearFurnitureVisualOverrides } from '../layout/furnitureCatalog'
import { clearLoadedCharacterPNGs } from './spriteData'
import { clearCatSpritesOverride } from './catSprites'
import { loadCharacterPNGs, loadWallPNG } from './pngLoader'
import { loadAllGeneratedPixelAssets, clearLobsterSprite } from './generatedAssetsLoader'

export function resetToBuiltinPixelOfficeAssets(): void {
  clearLoadedCharacterPNGs()
  clearWallSprites()
  clearFloorPatternPNG()
  clearFurnitureVisualOverrides()
  clearLobsterSprite()
  clearCatSpritesOverride()
}

let currentAssetPackGame: OfficeGameId | null = null

export async function applyPixelAssetPackForGame(game: OfficeGameId): Promise<void> {
  if (currentAssetPackGame === game) return

  resetToBuiltinPixelOfficeAssets()

  if (game !== 'classic') {
    const root = `/assets/pixel-office/games/${game}`
    await Promise.all([
      loadCharacterPNGs(`${root}/characters`),
      loadWallPNG(`${root}/walls.png`),
      loadAllGeneratedPixelAssets(root),
    ])
  }

  currentAssetPackGame = game
}

/** 热切换 / HMR 时可重置（一般无需调用） */
export function resetAssetPackCache(): void {
  currentAssetPackGame = null
}
