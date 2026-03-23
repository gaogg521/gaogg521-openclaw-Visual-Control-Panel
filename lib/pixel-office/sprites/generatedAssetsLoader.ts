/**
 * 加载 AI 生成的 PNG：地板条、家具图集、龙虾精灵、猫咪图集。
 * 家具裁切由 public/assets/pixel-office/atlas-manifest.json 描述。
 */
import type { SpriteData } from '../types'
import { Direction as Dir } from '../types'
import { setFloorSprites } from '../floorTiles'
import { setFurnitureVisualOverrides, type FurnitureVisualOverride } from '../layout/furnitureCatalog'
import type { CharacterSprites } from './spriteData'
import { setCatSpritesOverride } from './catSprites'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function canvasToSpriteData(canvas: HTMLCanvasElement): SpriteData {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData
  const result: SpriteData = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3]
      if (a < 128) row.push('')
      else row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase())
    }
    result.push(row)
  }
  return result
}

/** 从图集裁切并缩放到 outW×outH（最近邻） */
export function imageRegionToSpriteData(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
): SpriteData {
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
  return canvasToSpriteData(canvas)
}

function transposeSprite(sprite: SpriteData): SpriteData {
  const rows = sprite.length
  const cols = sprite[0]?.length ?? 0
  const result: SpriteData = []
  for (let c = 0; c < cols; c++) {
    const newRow: string[] = []
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(sprite[r][c])
    }
    result.push(newRow)
  }
  return result
}

function flipHSprite(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse())
}

let lobsterImage: HTMLImageElement | null = null

export function getLobsterSpriteImage(): HTMLImageElement | null {
  return lobsterImage
}

export function clearLobsterSprite(): void {
  lobsterImage = null
}

function assetUrl(assetsRoot: string, name: string): string {
  const base = assetsRoot.replace(/\/$/, '')
  return `${base}/${name}`
}

export async function loadFloorsPNG(assetsRoot = '/assets/pixel-office'): Promise<boolean> {
  try {
    const img = await loadImage(assetUrl(assetsRoot, 'floors.png'))
    const sprites: SpriteData[] = []
    const tile = 16
    const count = Math.min(7, Math.floor(img.width / tile))
    for (let i = 0; i < count; i++) {
      sprites.push(imageRegionToSpriteData(img, i * tile, 0, tile, tile, tile, tile))
    }
    if (sprites.length > 0) {
      setFloorSprites(sprites)
      return true
    }
  } catch {
    /* keep default floor */
  }
  return false
}

type Manifest = {
  entries: Record<string, { x: number; y: number; w: number; h: number; outW: number; outH: number }>
  transposeTo?: Record<string, string>
  clearEmoji?: string[]
}

export async function loadFurnitureAtlasPNG(assetsRoot = '/assets/pixel-office'): Promise<boolean> {
  try {
    const [img, manifestRes] = await Promise.all([
      loadImage(assetUrl(assetsRoot, 'furniture-atlas.png')),
      fetch(assetUrl(assetsRoot, 'atlas-manifest.json')),
    ])
    if (!manifestRes.ok) return false
    const manifest = (await manifestRes.json()) as Manifest
    const overrides = new Map<string, FurnitureVisualOverride>()

    for (const [type, rect] of Object.entries(manifest.entries)) {
      const sprite = imageRegionToSpriteData(img, rect.x, rect.y, rect.w, rect.h, rect.outW, rect.outH)
      const clearEmoji = manifest.clearEmoji?.includes(type) ?? false
      overrides.set(type, { sprite, clearEmoji })
    }

    if (manifest.transposeTo) {
      for (const [targetType, sourceType] of Object.entries(manifest.transposeTo)) {
        const src = overrides.get(sourceType)
        if (!src) continue
        overrides.set(targetType, { sprite: transposeSprite(src.sprite), clearEmoji: false })
      }
    }

    setFurnitureVisualOverrides(overrides)
    return overrides.size > 0
  } catch {
    return false
  }
}

export async function loadLobsterPNG(assetsRoot = '/assets/pixel-office'): Promise<boolean> {
  try {
    const img = await loadImage(assetUrl(assetsRoot, 'lobster.png'))
    lobsterImage = img
    return true
  } catch {
    lobsterImage = null
    return false
  }
}

/** 128×96：4×32 列，3×32 行；每格取中心 16×24，下行走 2 帧 */
function parseCatSheet(img: HTMLImageElement): CharacterSprites {
  const cell = 32
  const outW = 16
  const outH = 24
  const ox = 8
  const oy = 8

  const cellFrame = (col: number, row: number): SpriteData =>
    imageRegionToSpriteData(img, col * cell + ox, row * cell + oy, outW, outH, outW, outH)

  const down1 = cellFrame(0, 0)
  const down2 = cellFrame(1, 0)
  const up1 = cellFrame(0, 1)
  const up2 = cellFrame(1, 1)
  const right1 = cellFrame(0, 2)
  const right2 = cellFrame(1, 2)
  const left1 = flipHSprite(right1)
  const left2 = flipHSprite(right2)

  const walk4 = (a: SpriteData, b: SpriteData): [SpriteData, SpriteData, SpriteData, SpriteData] => [a, b, a, b]
  const idle2 = (a: SpriteData): [SpriteData, SpriteData] => [a, a]

  return {
    walk: {
      [Dir.DOWN]: walk4(down1, down2),
      [Dir.UP]: walk4(up1, up2),
      [Dir.RIGHT]: walk4(right1, right2),
      [Dir.LEFT]: walk4(left1, left2),
    },
    typing: {
      [Dir.DOWN]: idle2(down1),
      [Dir.UP]: idle2(up1),
      [Dir.RIGHT]: idle2(right1),
      [Dir.LEFT]: idle2(left1),
    },
    reading: {
      [Dir.DOWN]: idle2(down1),
      [Dir.UP]: idle2(up1),
      [Dir.RIGHT]: idle2(right1),
      [Dir.LEFT]: idle2(left1),
    },
  }
}

/**
 * 用户 3×2 机械猫图集：列 0=面向下、1=面向上、2=面向右（左向镜像）；行 0/1 为两帧行走。
 * 每格为 floor(W/3)×floor(H/2)，缩放到 16×24。
 */
function parseCatSheetThreeByTwo(img: HTMLImageElement): CharacterSprites {
  const cols = 3
  const rows = 2
  const cw = Math.floor(img.width / cols)
  const ch = Math.floor(img.height / rows)
  const outW = 16
  const outH = 24

  const cellFrame = (col: number, row: number): SpriteData =>
    imageRegionToSpriteData(img, col * cw, row * ch, cw, ch, outW, outH)

  const down1 = cellFrame(0, 0)
  const down2 = cellFrame(0, 1)
  const up1 = cellFrame(1, 0)
  const up2 = cellFrame(1, 1)
  const right1 = cellFrame(2, 0)
  const right2 = cellFrame(2, 1)
  const left1 = flipHSprite(right1)
  const left2 = flipHSprite(right2)

  const walk4 = (a: SpriteData, b: SpriteData): [SpriteData, SpriteData, SpriteData, SpriteData] => [a, b, a, b]
  const idle2 = (a: SpriteData): [SpriteData, SpriteData] => [a, a]

  return {
    walk: {
      [Dir.DOWN]: walk4(down1, down2),
      [Dir.UP]: walk4(up1, up2),
      [Dir.RIGHT]: walk4(right1, right2),
      [Dir.LEFT]: walk4(left1, left2),
    },
    typing: {
      [Dir.DOWN]: idle2(down1),
      [Dir.UP]: idle2(up1),
      [Dir.RIGHT]: idle2(right1),
      [Dir.LEFT]: idle2(left1),
    },
    reading: {
      [Dir.DOWN]: idle2(down1),
      [Dir.UP]: idle2(up1),
      [Dir.RIGHT]: idle2(right1),
      [Dir.LEFT]: idle2(left1),
    },
  }
}

function isClassicCatSheetSize(w: number, h: number): boolean {
  return w === 128 && h === 96
}

export async function loadCatSheetPNG(assetsRoot = '/assets/pixel-office'): Promise<boolean> {
  try {
    const img = await loadImage(assetUrl(assetsRoot, 'cat_sheet.png'))
    const parsed = isClassicCatSheetSize(img.width, img.height)
      ? parseCatSheet(img)
      : parseCatSheetThreeByTwo(img)
    setCatSpritesOverride(parsed)
    return true
  } catch {
    return false
  }
}

export async function loadAllGeneratedPixelAssets(assetsRoot = '/assets/pixel-office'): Promise<void> {
  await Promise.all([
    loadFloorsPNG(assetsRoot),
    loadFurnitureAtlasPNG(assetsRoot),
    loadLobsterPNG(assetsRoot),
    loadCatSheetPNG(assetsRoot),
  ])
}
