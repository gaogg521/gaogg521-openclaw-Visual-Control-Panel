/**
 * 星舰 / 林间：与「经典办公室」完全不同的拓扑 + 陈设（非写字楼模板）。
 * 保留 clock-r / library-r / whiteboard-r / server-b-left / stool-r* / painting-l2 等交互 uid。
 * revision 与 layoutRevisions.THEME_LAYOUT_REVISION 同步，用于使旧存档失效。
 */
import { TileType, FurnitureType, DEFAULT_COLS, DEFAULT_ROWS } from '../types'
import type { TileType as TileTypeVal, OfficeLayout, PlacedFurniture, FloorColor } from '../types'
import { THEME_LAYOUT_REVISION } from './layoutRevisions'

const W = TileType.WALL
const F1 = TileType.FLOOR_1
const F2 = TileType.FLOOR_2
const F3 = TileType.FLOOR_3
const F4 = TileType.FLOOR_4

/** 林间「溪流」可走水格 */
const GROVE_STREAM: ReadonlySet<string> = new Set([
  '2,11',
  '3,11',
  '4,11',
  '4,12',
  '5,12',
  '5,13',
  '6,13',
  '7,13',
  '7,14',
  '8,14',
  '9,15',
  '10,15',
  '11,14',
  '12,13',
  '13,12',
])

export function isGroveStreamTile(col: number, row: number): boolean {
  return GROVE_STREAM.has(`${col},${row}`)
}

/**
 * 星舰 — 纵向气闸舱壁 c=7、三处中层闸门、下层反应堆 + 承重柱 + 右舷观星甲板格
 */
function buildStarshipTopology(floor: {
  port: FloorColor
  starboard: FloorColor
  carpet: FloorColor
  lounge: FloorColor
  doorway: FloorColor
  datumStrip: FloorColor
  warpPad: FloorColor
}): Pick<OfficeLayout, 'cols' | 'rows' | 'tiles' | 'tileColors'> {
  const cols = DEFAULT_COLS
  const rows = DEFAULT_ROWS
  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  const isPillar = (c: number, r: number) =>
    r >= 11 &&
    ((c === 6 && (r === 13 || r === 15)) || (c === 14 && (r === 13 || r === 15)))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles.push(W)
        tileColors.push(null)
        continue
      }

      if (r === 10) {
        if (
          (c >= 2 && c <= 3) ||
          (c >= 9 && c <= 12) ||
          (c >= 17 && c <= 18)
        ) {
          tiles.push(F4)
          tileColors.push(floor.doorway)
        } else {
          tiles.push(W)
          tileColors.push(null)
        }
        continue
      }

      if (isPillar(c, r)) {
        tiles.push(W)
        tileColors.push(null)
        continue
      }

      if (c === 7 && r >= 1 && r <= 9) {
        if (r >= 3 && r <= 5) {
          tiles.push(F4)
          tileColors.push(floor.doorway)
        } else {
          tiles.push(W)
          tileColors.push(null)
        }
        continue
      }

      if (r >= 1 && r <= 9) {
        if (c >= 18 && c <= 19 && r >= 1 && r <= 4) {
          tiles.push(F3)
          tileColors.push(floor.warpPad)
          continue
        }
        if (c >= 15 && c <= 18 && r >= 7 && r <= 9) {
          tiles.push(F3)
          tileColors.push(floor.carpet)
          continue
        }
        if (c >= 10 && c <= 12) {
          tiles.push(F2)
          tileColors.push(floor.datumStrip)
          continue
        }
        if (c <= 6) {
          tiles.push(F1)
          tileColors.push(floor.port)
          continue
        }
        tiles.push(F1)
        tileColors.push(floor.starboard)
        continue
      }

      if (r >= 11) {
        if (c >= 3 && c <= 5 && r >= 12 && r <= 14) {
          tiles.push(F3)
          tileColors.push(floor.warpPad)
          continue
        }
        if (c >= 14 && c <= 17 && r >= 13 && r <= 15) {
          tiles.push(F3)
          tileColors.push(floor.carpet)
          continue
        }
        tiles.push(F1)
        tileColors.push(floor.lounge)
        continue
      }
    }
  }

  return { cols, rows, tiles, tileColors }
}

/**
 * 林间 — 双树篱错位门洞、中央林道、超宽拱门、蜿蜒溪、苔原、林间空地
 */
function buildGroveTopology(floor: {
  left: FloorColor
  right: FloorColor
  carpet: FloorColor
  lounge: FloorColor
  doorway: FloorColor
  pond: FloorColor
  moss: FloorColor
  path: FloorColor
}): Pick<OfficeLayout, 'cols' | 'rows' | 'tiles' | 'tileColors'> {
  const cols = DEFAULT_COLS
  const rows = DEFAULT_ROWS
  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles.push(W)
        tileColors.push(null)
        continue
      }

      if (r === 10) {
        if (c >= 6 && c <= 14) {
          tiles.push(F4)
          tileColors.push(floor.doorway)
        } else {
          tiles.push(W)
          tileColors.push(null)
        }
        continue
      }

      if (c === 5 && r >= 1 && r <= 9) {
        if (r >= 4 && r <= 6) {
          tiles.push(F4)
          tileColors.push(floor.doorway)
        } else {
          tiles.push(W)
          tileColors.push(null)
        }
        continue
      }

      if (c === 15 && r >= 1 && r <= 9) {
        if (r >= 3 && r <= 5) {
          tiles.push(F4)
          tileColors.push(floor.doorway)
        } else {
          tiles.push(W)
          tileColors.push(null)
        }
        continue
      }

      if (r >= 1 && r <= 9 && c === 10) {
        tiles.push(F2)
        tileColors.push(floor.path)
        continue
      }

      if (r >= 1 && r <= 9) {
        if (c < 10) {
          tiles.push(F1)
          tileColors.push(floor.left)
        } else {
          tiles.push(F2)
          tileColors.push(floor.right)
        }
        continue
      }

      if (GROVE_STREAM.has(`${c},${r}`)) {
        tiles.push(F3)
        tileColors.push(floor.pond)
        continue
      }

      if (c >= 16 && c <= 19 && r >= 11 && r <= 14) {
        tiles.push(F3)
        tileColors.push(floor.moss)
        continue
      }

      if (c >= 7 && c <= 14 && r >= 13 && r <= 15) {
        tiles.push(F3)
        tileColors.push(floor.carpet)
        continue
      }

      tiles.push(F1)
      tileColors.push(floor.lounge)
    }
  }

  return { cols, rows, tiles, tileColors }
}

const blueConsole: FloorColor = { h: 200, s: 55, b: 12, c: 8, colorize: false }
const violetPad: FloorColor = { h: 275, s: 40, b: 5, c: 5, colorize: false }

/** 星际舰桥：工程舱 + 全息核心 + 大量飞船/武器装饰，非办公室冰箱沙发模板 */
export function createStarshipLayout(): OfficeLayout {
  const shell = buildStarshipTopology({
    port: { h: 208, s: 38, b: -24, c: 14 },
    starboard: { h: 198, s: 32, b: -20, c: 12 },
    carpet: { h: 278, s: 50, b: -6, c: 10 },
    lounge: { h: 215, s: 28, b: -28, c: 14 },
    doorway: { h: 188, s: 42, b: 6, c: 8 },
    datumStrip: { h: 182, s: 62, b: 4, c: 20 },
    warpPad: { h: 288, s: 45, b: 0, c: 12 },
  })

  const furniture: PlacedFurniture[] = [
    { uid: 'clock-r', type: FurnitureType.CLOCK, col: 11, row: 0 },
    { uid: 'whiteboard-r', type: FurnitureType.WHITEBOARD, col: 15, row: 0 },
    { uid: 'library-r', type: FurnitureType.LIBRARY_GRAY_FULL, col: 17.5, row: -0.5 },
    { uid: 'painting-l2', type: FurnitureType.PAINTING_LARGE_2, col: 6, row: 10 },
    { uid: 'server-b-left', type: FurnitureType.SERVER_RACK, col: 1, row: 12 },

    { uid: 'helm-core', type: FurnitureType.DECO_3, col: 10, row: 3 },
    { uid: 'rack-forward', type: FurnitureType.SERVER_RACK, col: 17, row: 11 },
    { uid: 'rack-aft', type: FurnitureType.SERVER_RACK, col: 8, row: 14 },

    { uid: 'cons-l1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 2, row: 4, color: blueConsole },
    { uid: 'pc-l1', type: FurnitureType.PC, col: 2.5, row: 3.75, rotation: 180 },
    { uid: 'bench-l1', type: FurnitureType.BENCH, col: 2.5, row: 5 },
    { uid: 'cons-l2', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 4, row: 8, color: blueConsole },
    { uid: 'pc-l2', type: FurnitureType.PC, col: 4.5, row: 7.75 },
    { uid: 'bench-l2', type: FurnitureType.BENCH, col: 4.5, row: 9 },

    { uid: 'desk-r1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 14, row: 5, color: violetPad },
    { uid: 'desk-r1b', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 17, row: 5, color: violetPad },
    { uid: 'pc-r1', type: FurnitureType.PC, col: 15, row: 4.75, rotation: 180 },
    { uid: 'pc-r2', type: FurnitureType.PC, col: 18, row: 4.75, rotation: 180 },
    { uid: 'bench-ra', type: FurnitureType.BENCH, col: 15.5, row: 6 },
    { uid: 'bench-rb', type: FurnitureType.BENCH, col: 17.5, row: 6 },

    { uid: 'bench-datum-a', type: FurnitureType.BENCH, col: 9, row: 2 },
    { uid: 'bench-datum-b', type: FurnitureType.BENCH, col: 11, row: 8 },

    { uid: 'stool-r1', type: FurnitureType.BENCH, col: 19, row: 3 },
    { uid: 'stool-r2', type: FurnitureType.BENCH, col: 19, row: 4.5 },
    { uid: 'stool-r3', type: FurnitureType.BENCH, col: 18, row: 3 },
    { uid: 'stool-r4', type: FurnitureType.BENCH, col: 18, row: 4.5 },

    { uid: 'g-ufo-a', type: FurnitureType.GAME_UFO, col: 3, row: 2 },
    { uid: 'g-ufo-b', type: FurnitureType.GAME_UFO, col: 19, row: 6 },
    { uid: 'g-sat-a', type: FurnitureType.GAME_SATELLITE, col: 1, row: 7 },
    { uid: 'g-sat-b', type: FurnitureType.GAME_SATELLITE, col: 19, row: 2 },
    { uid: 'g-rocket', type: FurnitureType.GAME_ROCKET, col: 4, row: 13 },
    { uid: 'g-star-a', type: FurnitureType.GAME_STAR, col: 8, row: 12 },
    { uid: 'g-star-b', type: FurnitureType.GAME_STAR, col: 12, row: 15 },
    { uid: 'g-planet-a', type: FurnitureType.GAME_PLANET, col: 16, row: 14 },
    { uid: 'g-planet-b', type: FurnitureType.GAME_PLANET, col: 11, row: 11 },
    { uid: 'g-blast-a', type: FurnitureType.GAME_BLASTER, col: 13, row: 12 },
    { uid: 'g-blast-b', type: FurnitureType.GAME_BLASTER, col: 2, row: 14 },
    { uid: 'g-blast-c', type: FurnitureType.GAME_BLASTER, col: 18, row: 15 },
  ]

  return {
    version: 1,
    revision: THEME_LAYOUT_REVISION.starship,
    ...shell,
    furniture,
  }
}

/** 蘑菇林地：营地 + 小动物 + 真菌，无冰箱饮水机写字楼感 */
export function createGroveLayout(): OfficeLayout {
  const shell = buildGroveTopology({
    left: { h: 44, s: 54, b: 6, c: 6 },
    right: { h: 34, s: 50, b: 0, c: 8 },
    carpet: { h: 28, s: 44, b: 4, c: 4 },
    lounge: { h: 40, s: 46, b: 2, c: 5 },
    doorway: { h: 50, s: 40, b: 12, c: 3 },
    pond: { h: 158, s: 38, b: -4, c: 6 },
    moss: { h: 80, s: 60, b: 6, c: 6 },
    path: { h: 90, s: 36, b: 10, c: 5 },
  })

  const woodTint: FloorColor = { h: 36, s: 58, b: -4, c: 8, colorize: false }

  const furniture: PlacedFurniture[] = [
    { uid: 'clock-r', type: FurnitureType.CLOCK, col: 11, row: 0 },
    { uid: 'whiteboard-r', type: FurnitureType.WHITEBOARD, col: 15, row: 0 },
    { uid: 'library-r', type: FurnitureType.LIBRARY_GRAY_FULL, col: 17.5, row: -0.5 },
    { uid: 'painting-l2', type: FurnitureType.PAINTING_LARGE_2, col: 5, row: 10 },
    { uid: 'server-b-left', type: FurnitureType.SERVER_RACK, col: 1, row: 12 },

    { uid: 'stool-r1', type: FurnitureType.BENCH, col: 19, row: 3 },
    { uid: 'stool-r2', type: FurnitureType.BENCH, col: 19, row: 4.5 },
    { uid: 'stool-r3', type: FurnitureType.BENCH, col: 18, row: 3 },
    { uid: 'stool-r4', type: FurnitureType.BENCH, col: 18, row: 4.5 },

    { uid: 'wood-desk-a', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 2, row: 4, color: woodTint },
    { uid: 'pc-a', type: FurnitureType.PC, col: 2.5, row: 3.75, rotation: 180 },
    { uid: 'stump-a', type: FurnitureType.BENCH, col: 2.5, row: 5 },
    { uid: 'wood-desk-b', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 4, row: 8, color: woodTint },
    { uid: 'pc-b', type: FurnitureType.PC, col: 4.5, row: 7.75 },
    { uid: 'stump-b', type: FurnitureType.BENCH, col: 4.5, row: 9 },

    { uid: 'wood-desk-c', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 17, row: 4, color: woodTint },
    { uid: 'wood-desk-d', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: 17, row: 7, color: woodTint },
    { uid: 'pc-c', type: FurnitureType.PC, col: 17.5, row: 3.75, rotation: 180 },
    { uid: 'pc-d', type: FurnitureType.PC, col: 17.5, row: 6.75 },
    { uid: 'stump-c', type: FurnitureType.BENCH, col: 16.5, row: 5 },
    { uid: 'stump-d', type: FurnitureType.BENCH, col: 18.5, row: 8 },

    { uid: 'game-tree-a', type: FurnitureType.GAME_TREE, col: 1, row: 2 },
    { uid: 'game-tree-b', type: FurnitureType.GAME_TREE, col: 3, row: 1 },
    { uid: 'game-tree-c', type: FurnitureType.GAME_TREE, col: 8, row: 2 },
    { uid: 'game-tree-d', type: FurnitureType.GAME_TREE, col: 19, row: 8 },
    { uid: 'game-mush-a', type: FurnitureType.GAME_MUSHROOM, col: 6, row: 12 },
    { uid: 'game-mush-b', type: FurnitureType.GAME_MUSHROOM, col: 14, row: 11 },
    { uid: 'game-mush-c', type: FurnitureType.GAME_MUSHROOM, col: 9, row: 14 },
    { uid: 'game-fire', type: FurnitureType.GAME_CAMPFIRE, col: 10, row: 14 },
    { uid: 'game-glow-a', type: FurnitureType.GAME_GLOW, col: 7, row: 6 },
    { uid: 'game-glow-b', type: FurnitureType.GAME_GLOW, col: 13, row: 8 },
    { uid: 'game-butter-a', type: FurnitureType.GAME_BUTTERFLY, col: 11, row: 5 },
    { uid: 'game-butter-b', type: FurnitureType.GAME_BUTTERFLY, col: 16, row: 6 },

    { uid: 'fauna-rabbit-a', type: FurnitureType.GAME_RABBIT, col: 4, row: 11 },
    { uid: 'fauna-rabbit-b', type: FurnitureType.GAME_RABBIT, col: 12, row: 12 },
    { uid: 'fauna-rabbit-c', type: FurnitureType.GAME_RABBIT, col: 15, row: 15 },
    { uid: 'fauna-cat-a', type: FurnitureType.GAME_CAT_DECO, col: 8, row: 11 },
    { uid: 'fauna-cat-b', type: FurnitureType.GAME_CAT_DECO, col: 3, row: 14 },
  ]

  return {
    version: 1,
    revision: THEME_LAYOUT_REVISION.grove,
    ...shell,
    furniture,
  }
}
