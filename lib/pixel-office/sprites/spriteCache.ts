import type { SpriteData } from '../types'

const zoomCaches = new Map<number, WeakMap<SpriteData, HTMLCanvasElement>>()

const outlineCache = new WeakMap<SpriteData, SpriteData>()
const coloredOutlineCache = new WeakMap<SpriteData, Map<string, SpriteData>>()

/** Generate a 1px white outline SpriteData (2px larger in each dimension) */
export function getOutlineSprite(sprite: SpriteData): SpriteData {
  const cached = outlineCache.get(sprite)
  if (cached) return cached

  const rows = sprite.length
  const cols = sprite[0].length
  const outline: string[][] = []
  for (let r = 0; r < rows + 2; r++) {
    outline.push(new Array<string>(cols + 2).fill(''))
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sprite[r][c] === '') continue
      const er = r + 1
      const ec = c + 1
      if (outline[er - 1][ec] === '') outline[er - 1][ec] = '#FFFFFF'
      if (outline[er + 1][ec] === '') outline[er + 1][ec] = '#FFFFFF'
      if (outline[er][ec - 1] === '') outline[er][ec - 1] = '#FFFFFF'
      if (outline[er][ec + 1] === '') outline[er][ec + 1] = '#FFFFFF'
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sprite[r][c] !== '') {
        outline[r + 1][c + 1] = ''
      }
    }
  }

  outlineCache.set(sprite, outline)
  return outline
}

/** 1px 任意颜色外轮廓（用于主题场景下人物与地板分离） */
export function getColoredOutlineSprite(sprite: SpriteData, outlineHex: string): SpriteData {
  let byColor = coloredOutlineCache.get(sprite)
  if (!byColor) {
    byColor = new Map()
    coloredOutlineCache.set(sprite, byColor)
  }
  const hit = byColor.get(outlineHex)
  if (hit) return hit

  const rows = sprite.length
  const cols = sprite[0].length
  const outline: string[][] = []
  for (let r = 0; r < rows + 2; r++) {
    outline.push(new Array<string>(cols + 2).fill(''))
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sprite[r][c] === '') continue
      const er = r + 1
      const ec = c + 1
      if (outline[er - 1][ec] === '') outline[er - 1][ec] = outlineHex
      if (outline[er + 1][ec] === '') outline[er + 1][ec] = outlineHex
      if (outline[er][ec - 1] === '') outline[er][ec - 1] = outlineHex
      if (outline[er][ec + 1] === '') outline[er][ec + 1] = outlineHex
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sprite[r][c] !== '') {
        outline[r + 1][c + 1] = ''
      }
    }
  }

  byColor.set(outlineHex, outline)
  return outline
}

export function getCachedSprite(sprite: SpriteData, zoom: number): HTMLCanvasElement {
  let cache = zoomCaches.get(zoom)
  if (!cache) {
    cache = new WeakMap()
    zoomCaches.set(zoom, cache)
  }

  const cached = cache.get(sprite)
  if (cached) return cached

  const rows = sprite.length
  const cols = sprite[0].length
  const canvas = document.createElement('canvas')
  canvas.width = cols * zoom
  canvas.height = rows * zoom
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = sprite[r][c]
      if (color === '') continue
      ctx.fillStyle = color
      ctx.fillRect(c * zoom, r * zoom, zoom, zoom)
    }
  }

  cache.set(sprite, canvas)
  return canvas
}
