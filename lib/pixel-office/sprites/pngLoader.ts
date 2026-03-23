import type { SpriteData } from '../types'
import { setCharacterTemplates } from './spriteData'
import type { LoadedCharacterData } from './spriteData'
import { setWallSprites } from '../wallTiles'

/**
 * Load a PNG image and convert it to SpriteData (2D array of hex color strings).
 * Transparent pixels become '' (empty string).
 */
function canvasToSpriteData(canvas: HTMLCanvasElement): SpriteData {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData

  const result: string[][] = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 128) {
        row.push('')
      } else {
        row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase())
      }
    }
    result.push(row)
  }
  return result
}

function pngToSpriteData(img: HTMLImageElement): SpriteData {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvasToSpriteData(canvas)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function normalizedSpriteData(img: HTMLImageElement, targetWidth?: number, targetHeight?: number): SpriteData {
  const canvas = document.createElement('canvas')
  const shouldResize =
    typeof targetWidth === 'number' &&
    typeof targetHeight === 'number' &&
    img.width !== targetWidth &&
    img.height !== targetHeight &&
    img.width % targetWidth === 0 &&
    img.height % targetHeight === 0

  if (shouldResize) {
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    return canvasToSpriteData(canvas)
  }

  return pngToSpriteData(img)
}

function stripOpaqueSheetBackground(sprite: SpriteData): SpriteData {
  if (sprite.length === 0 || sprite[0].length === 0) return sprite
  if (sprite.some((row) => row.some((pixel) => pixel === ''))) return sprite

  const height = sprite.length
  const width = sprite[0].length
  const result = sprite.map((row) => [...row])
  const visited = Array.from({ length: height }, () => Array(width).fill(false))
  const queue: Array<[number, number]> = []

  const brightness = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return 0.299 * r + 0.587 * g + 0.114 * b
  }

  const corners = [sprite[0][0], sprite[0][width - 1], sprite[height - 1][0], sprite[height - 1][width - 1]]
  const threshold = Math.max(140, Math.min(...corners.map((pixel) => brightness(pixel))) - 12)

  const enqueue = (x: number, y: number) => {
    if (visited[y][x]) return
    if (brightness(result[y][x]) < threshold) return
    visited[y][x] = true
    queue.push([x, y])
  }

  for (let x = 0; x < width; x++) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift()!
    result[y][x] = ''
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }

  return result
}

/**
 * Extract a sub-region from a SpriteData array.
 */
function extractRegion(sprite: SpriteData, x: number, y: number, w: number, h: number): SpriteData {
  const result: string[][] = []
  for (let row = y; row < y + h; row++) {
    result.push(sprite[row].slice(x, x + w))
  }
  return result
}

/**
 * Parse a character PNG (112×96) into LoadedCharacterData.
 * Layout: 7 frames × 16px wide, 3 direction rows × 32px tall (24px sprite + 8px top padding).
 * Row 0 = down, Row 1 = up, Row 2 = right.
 * Frame order: walk1, walk2, walk3, type1, type2, read1, read2.
 */
function parseCharacterSheet(sheet: SpriteData): LoadedCharacterData {
  const FRAME_W = 16
  const FRAME_H = 32
  const extract = (frame: number, dirRow: number) =>
    extractRegion(sheet, frame * FRAME_W, dirRow * FRAME_H, FRAME_W, FRAME_H)

  return {
    down: [extract(0, 0), extract(1, 0), extract(2, 0), extract(3, 0), extract(4, 0), extract(5, 0), extract(6, 0)],
    up: [extract(0, 1), extract(1, 1), extract(2, 1), extract(3, 1), extract(4, 1), extract(5, 1), extract(6, 1)],
    right: [extract(0, 2), extract(1, 2), extract(2, 2), extract(3, 2), extract(4, 2), extract(5, 2), extract(6, 2)],
  }
}

/**
 * Load character PNGs from charactersBaseUrl (e.g. /assets/pixel-office/characters).
 * Loads the default set plus any extra contiguous char_N.png files.
 * Falls back silently to hardcoded templates if the base set fails.
 */
export async function loadCharacterPNGs(
  charactersBaseUrl = '/assets/pixel-office/characters',
): Promise<boolean> {
  try {
    const base = charactersBaseUrl.replace(/\/$/, '')
    const characters: LoadedCharacterData[] = []
    const baseCharacterCount = 6
    const maxCharacterCount = 64
    const CHARACTER_SHEET_WIDTH = 112
    const CHARACTER_SHEET_HEIGHT = 96

    for (let i = 0; i < baseCharacterCount; i++) {
      const img = await loadImage(`${base}/char_${i}.png`)
      const sheet = stripOpaqueSheetBackground(normalizedSpriteData(img, CHARACTER_SHEET_WIDTH, CHARACTER_SHEET_HEIGHT))
      characters.push(parseCharacterSheet(sheet))
    }

    for (let i = baseCharacterCount; i < maxCharacterCount; i++) {
      try {
        const img = await loadImage(`${base}/char_${i}.png`)
        const sheet = stripOpaqueSheetBackground(normalizedSpriteData(img, CHARACTER_SHEET_WIDTH, CHARACTER_SHEET_HEIGHT))
        characters.push(parseCharacterSheet(sheet))
      } catch {
        break
      }
    }

    setCharacterTemplates(characters)
    return true
  } catch (e) {
    console.warn('Failed to load character PNGs, using fallback templates:', e)
    return false
  }
}

/**
 * Load walls.png (64×128, 4×4 grid of 16×32 pieces) and register wall sprites.
 * 16 auto-tile sprites indexed by bitmask (N=1, E=2, S=4, W=8).
 * Grid layout: left-to-right, top-to-bottom → bitmask 0,1,2,...,15.
 */
export async function loadWallPNG(imageUrl = '/assets/pixel-office/walls.png'): Promise<boolean> {
  try {
    const img = await loadImage(imageUrl)
    const sheet = pngToSpriteData(img)
    const PIECE_W = 16
    const PIECE_H = 32
    const COLS = 4
    const sprites: SpriteData[] = []
    for (let i = 0; i < 16; i++) {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      sprites.push(extractRegion(sheet, col * PIECE_W, row * PIECE_H, PIECE_W, PIECE_H))
    }
    setWallSprites(sprites)
    return true
  } catch (e) {
    console.warn('Failed to load walls.png, using fallback solid walls:', e)
    return false
  }
}
