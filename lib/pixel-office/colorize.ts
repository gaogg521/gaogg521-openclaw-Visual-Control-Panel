/**
 * Shared sprite colorization module.
 */

import type { SpriteData, FloorColor } from './types'

const colorizeCache = new Map<string, SpriteData>()

export function getColorizedSprite(cacheKey: string, sprite: SpriteData, color: FloorColor): SpriteData {
  const cached = colorizeCache.get(cacheKey)
  if (cached) return cached
  const result = color.colorize ? colorizeSprite(sprite, color) : adjustSprite(sprite, color)
  colorizeCache.set(cacheKey, result)
  return result
}

export function clearColorizeCache(): void {
  colorizeCache.clear()
}

export function colorizeSprite(sprite: SpriteData, color: FloorColor): SpriteData {
  const { h, s, b, c } = color
  const result: SpriteData = []
  for (const row of sprite) {
    const newRow: string[] = []
    for (const pixel of row) {
      if (pixel === '') { newRow.push(''); continue }
      const r = parseInt(pixel.slice(1, 3), 16)
      const g = parseInt(pixel.slice(3, 5), 16)
      const bv = parseInt(pixel.slice(5, 7), 16)
      let lightness = (0.299 * r + 0.587 * g + 0.114 * bv) / 255
      if (c !== 0) { const factor = (100 + c) / 100; lightness = 0.5 + (lightness - 0.5) * factor }
      if (b !== 0) { lightness = lightness + b / 200 }
      lightness = Math.max(0, Math.min(1, lightness))
      const satFrac = s / 100
      const hex = hslToHex(h, satFrac, lightness)
      newRow.push(hex)
    }
    result.push(newRow)
  }
  return result
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs(hp % 2 - 1))
  let r1 = 0, g1 = 0, b1 = 0
  if (hp < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  const m = l - c / 2
  const r = Math.round((r1 + m) * 255)
  const g = Math.round((g1 + m) * 255)
  const bOut = Math.round((b1 + m) * 255)
  return `#${clamp255(r).toString(16).padStart(2, '0')}${clamp255(g).toString(16).padStart(2, '0')}${clamp255(bOut).toString(16).padStart(2, '0')}`.toUpperCase()
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v))
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60
  else if (max === gf) h = ((bf - rf) / d + 2) * 60
  else h = ((rf - gf) / d + 4) * 60
  return [h, s, l]
}

export function adjustSprite(sprite: SpriteData, color: FloorColor): SpriteData {
  const { h: hShift, s: sShift, b, c } = color
  const result: SpriteData = []
  for (const row of sprite) {
    const newRow: string[] = []
    for (const pixel of row) {
      if (pixel === '') { newRow.push(''); continue }
      const r = parseInt(pixel.slice(1, 3), 16)
      const g = parseInt(pixel.slice(3, 5), 16)
      const bv = parseInt(pixel.slice(5, 7), 16)
      const [origH, origS, origL] = rgbToHsl(r, g, bv)
      const newH = ((origH + hShift) % 360 + 360) % 360
      const newS = Math.max(0, Math.min(1, origS + sShift / 100))
      let lightness = origL
      if (c !== 0) { const factor = (100 + c) / 100; lightness = 0.5 + (lightness - 0.5) * factor }
      if (b !== 0) { lightness = lightness + b / 200 }
      lightness = Math.max(0, Math.min(1, lightness))
      const hex = hslToHex(newH, newS, lightness)
      newRow.push(hex)
    }
    result.push(newRow)
  }
  return result
}
