/**
 * 星舰 / 林间 与经典办公室不同的闲逛节奏与目标偏好（轨迹「性格」）。
 */
import { isGroveStreamTile } from '../layout/alternateLayouts'
import type { OfficeGameId } from '../gameThemes'
import {
  WANDER_PAUSE_MIN_SEC,
  WANDER_PAUSE_MAX_SEC,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_MOVES_BEFORE_REST_MAX,
  INTERACTION_CHANCE,
  INTERACTION_STAY_MIN_SEC,
  INTERACTION_STAY_MAX_SEC,
} from '../constants'

export interface WanderParams {
  pauseMin: number
  pauseMax: number
  movesBeforeRestMin: number
  movesBeforeRestMax: number
  interactionChance: number
  interactionStayMin: number
  interactionStayMax: number
  /** 相对 WALK_SPEED_PX_PER_SEC */
  walkScale: number
  pickWanderTile: (tiles: Array<{ col: number; row: number }>) => { col: number; row: number }
}

export interface CatWanderParams {
  pauseMin: number
  pauseMax: number
  /** 乘在 CAT_WALK_SPEED_FACTOR 上 */
  speedScale: number
  pickWanderTile: (tiles: Array<{ col: number; row: number }>) => { col: number; row: number }
}

function pickUniform(tiles: Array<{ col: number; row: number }>): { col: number; row: number } {
  return tiles[Math.floor(Math.random() * tiles.length)]!
}

function pickWeighted(
  tiles: Array<{ col: number; row: number }>,
  weight: (t: { col: number; row: number }) => number,
): { col: number; row: number } {
  if (tiles.length === 0) return { col: 1, row: 1 }
  let total = 0
  const w = tiles.map((t) => {
    const x = Math.max(0.05, weight(t))
    total += x
    return x
  })
  let r = Math.random() * total
  for (let i = 0; i < tiles.length; i++) {
    r -= w[i]!
    if (r <= 0) return tiles[i]!
  }
  return tiles[tiles.length - 1]!
}

/** 星舰 v2：光带 c10–12、气闸 c7 r3–5、主闸 r10 c9–12、反应堆格、柱间通道 */
function weightStarshipTile(t: { col: number; row: number }): number {
  let w = 1
  if (t.row >= 1 && t.row <= 9 && t.col >= 10 && t.col <= 12) w *= 5.2
  else if (t.row >= 1 && t.row <= 9) w *= 2.1
  if (t.col === 7 && t.row >= 3 && t.row <= 5) w *= 4
  if (t.row === 10 && t.col >= 9 && t.col <= 12) w *= 2.8
  if (t.row === 10 && ((t.col >= 2 && t.col <= 3) || (t.col >= 17 && t.col <= 18))) w *= 2.4
  if (t.col >= 3 && t.col <= 5 && t.row >= 12 && t.row <= 14) w *= 3.2
  if (t.row >= 11 && t.col >= 8 && t.col <= 12) w *= 2
  if (t.col >= 14 && t.col <= 17 && t.row >= 13 && t.row <= 15) w *= 2.2
  return w
}

/** 林间 v2：中央林道 c10、树篱门洞、巨拱门 r10、溪流、苔原、篝火毯 */
function weightGroveTile(t: { col: number; row: number }): number {
  let w = 1
  if (t.row >= 1 && t.row <= 9 && t.col === 10) w *= 5
  if (t.col === 5 && t.row >= 4 && t.row <= 6) w *= 3.5
  if (t.col === 15 && t.row >= 3 && t.row <= 5) w *= 3.5
  if (t.row === 10 && t.col >= 6 && t.col <= 14) w *= 3.8
  if (isGroveStreamTile(t.col, t.row)) w *= 6
  if (t.col >= 16 && t.col <= 19 && t.row >= 11 && t.row <= 14) w *= 4.5
  if (t.col >= 8 && t.col <= 13 && t.row >= 13 && t.row <= 15) w *= 3.2
  if (t.row >= 1 && t.row <= 9 && t.col >= 1 && t.col <= 4) w *= 1.5
  if (t.row >= 1 && t.row <= 9 && t.col >= 16 && t.col <= 19) w *= 1.5
  return w
}

export const CLASSIC_WANDER: WanderParams = {
  pauseMin: WANDER_PAUSE_MIN_SEC,
  pauseMax: WANDER_PAUSE_MAX_SEC,
  movesBeforeRestMin: WANDER_MOVES_BEFORE_REST_MIN,
  movesBeforeRestMax: WANDER_MOVES_BEFORE_REST_MAX,
  interactionChance: INTERACTION_CHANCE,
  interactionStayMin: INTERACTION_STAY_MIN_SEC,
  interactionStayMax: INTERACTION_STAY_MAX_SEC,
  walkScale: 1,
  pickWanderTile: pickUniform,
}

const STARSHIP_WANDER: WanderParams = {
  pauseMin: 0.45,
  pauseMax: 3.4,
  movesBeforeRestMin: 5,
  movesBeforeRestMax: 10,
  interactionChance: 0.82,
  interactionStayMin: 2.8,
  interactionStayMax: 9,
  walkScale: 1.22,
  pickWanderTile: (tiles) => pickWeighted(tiles, weightStarshipTile),
}

const GROVE_WANDER: WanderParams = {
  pauseMin: 2.0,
  pauseMax: 12,
  movesBeforeRestMin: 2,
  movesBeforeRestMax: 5,
  interactionChance: 0.38,
  interactionStayMin: 6,
  interactionStayMax: 18,
  walkScale: 0.78,
  pickWanderTile: (tiles) => pickWeighted(tiles, weightGroveTile),
}

export const CLASSIC_CAT: CatWanderParams = {
  pauseMin: 1.0,
  pauseMax: 5.0,
  speedScale: 1,
  pickWanderTile: pickUniform,
}

const STARSHIP_CAT: CatWanderParams = {
  pauseMin: 0.4,
  pauseMax: 2.6,
  speedScale: 1.15,
  pickWanderTile: (tiles) => pickWeighted(tiles, weightStarshipTile),
}

const GROVE_CAT: CatWanderParams = {
  pauseMin: 1.8,
  pauseMax: 7,
  speedScale: 0.72,
  pickWanderTile: (tiles) => pickWeighted(tiles, weightGroveTile),
}

export function getHumanWanderParams(game: OfficeGameId): WanderParams {
  if (game === 'starship') return STARSHIP_WANDER
  if (game === 'grove') return GROVE_WANDER
  return CLASSIC_WANDER
}

export function getPetWanderParams(game: OfficeGameId): CatWanderParams {
  if (game === 'starship') return STARSHIP_CAT
  if (game === 'grove') return GROVE_CAT
  return CLASSIC_CAT
}
