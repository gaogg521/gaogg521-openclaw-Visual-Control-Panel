/**
 * 星舰 / 林间 两套主题化 PNG（games/starship、games/grove）。
 * 经典办公室不读这些目录。
 * 运行: node scripts/generate-pixel-office-assets.mjs
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PIXEL_ROOT = path.join(ROOT, 'public', 'assets', 'pixel-office')
const SHARED_MANIFEST = path.join(PIXEL_ROOT, 'atlas-manifest.json')
/** 若存在：上 1/3 → 星舰照片墙，中 1/3 → 机械猫图集（3×2 帧），下 1/3 为办公室家具图（不导入游戏） */
const STARSHIP_USER_BUNDLE = path.join(PIXEL_ROOT, 'source', 'starship-lobster-bundle.png')

/** @typedef {'starship' | 'grove'} ThemeId */

function put(buf, W, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= buf.length / (W * 4)) return
  const H = buf.length / (W * 4)
  if (y >= H) return
  const i = (y * W + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = a
}

function fill(buf, W, H, x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) put(buf, W, x, y, r, g, b, a)
}

function gray(buf, W, H, x0, y0, x1, y1, v) {
  fill(buf, W, H, x0, y0, x1, y1, v, v, v, 255)
}

async function saveRaw(buf, w, h, file) {
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file)
}

// ── 墙 16×32（灰度，便于游戏内上色）────────────────────────────
function drawWallTileStarship(buf, W, offX, offY) {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      let v = 68 + ((x + y * 2) % 5) * 5
      if (y < 2 || y > 29) v += 18
      if (x <= 1 || x >= 14) v -= 10
      if (y === 8 || y === 22) v -= 12
      if (x === 8 && y > 4 && y < 28) v += 4
      if ((x === 4 || x === 12) && (y === 6 || y === 18)) v = Math.min(235, v + 40)
      put(buf, W, offX + x, offY + y, v, v, v, 255)
    }
  }
}

function drawWallTileGrove(buf, W, offX, offY) {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      let v = 88 + Math.floor(Math.sin(x * 0.7 + y * 0.2) * 10)
      if ((x + y * 3) % 11 === 0) v -= 22
      if (x === 0 || x === 15) v -= 14
      if (y < 3) v += 8
      put(buf, W, offX + x, offY + y, v, v, v, 255)
    }
  }
}

function makeWallsPng(gameDir, theme) {
  const w = 64
  const h = 128
  const buf = Buffer.alloc(w * h * 4)
  const draw = theme === 'starship' ? drawWallTileStarship : drawWallTileGrove
  for (let i = 0; i < 16; i++) {
    draw(buf, w, (i % 4) * 16, Math.floor(i / 4) * 32)
  }
  return saveRaw(buf, w, h, path.join(gameDir, 'walls.png'))
}

// ── 地板 7×16 灰度图案 ─────────────────────────────────────────
function floorV(theme, t, x, y) {
  if (theme === 'starship') {
    switch (t) {
      case 0:
        return 108 + ((x + y) % 4) * 7
      case 1:
        return x % 3 === 0 || y % 3 === 0 ? 148 : 92
      case 2:
        return 98 + (((x >> 1) ^ (y >> 1)) % 5) * 9
      case 3:
        return 102 + Math.floor(Math.hypot(x - 7.5, y - 7.5)) * 4
      case 4:
        return 118 + (y % 4) * 5 + (x % 2) * 3
      case 5:
        return (x + y) % 4 === 0 ? 158 : 85
      default:
        return 104 + ((x * 7 + y * 11) % 23)
    }
  }
  switch (t) {
    case 0:
      return 118 + Math.floor(Math.sin(x * 0.9) * 8 + Math.sin(y * 0.4) * 6)
    case 1:
      return (y % 3 === 0 ? 128 : 108) + (x % 4) * 2
    case 2:
      return 112 + ((Math.floor(x / 2) + y) % 5) * 7
    case 3:
      return 100 + ((x * 3 + y * 5) % 8) * 6
    case 4:
      return 125 + (x % 2 === y % 2 ? 12 : -8)
    case 5:
      return 115 + Math.abs(x - y) * 3
    default:
      return 120 + ((x * y) % 6) * 5
  }
}

function makeFloorsPng(gameDir, theme) {
  const w = 7 * 16
  const h = 16
  const buf = Buffer.alloc(w * h * 4)
  for (let t = 0; t < 7; t++) {
    const ox = t * 16
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = Math.max(40, Math.min(230, floorV(theme, t, x, y)))
        put(buf, w, ox + x, y, v, v, v, 255)
      }
    }
  }
  return saveRaw(buf, w, h, path.join(gameDir, 'floors.png'))
}

const CHAR_H = 96

function drawTinyPerson(buf, W, ox, oy, skin, shirt, pants, legPhase) {
  const rim = [24, 20, 18]
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 5; dx++)
      if (Math.hypot(dx - 2, dy - 2) < 2.6) put(buf, W, ox + 6 + dx, oy + 6 + dy, ...skin)
  // 发际线 + 眼睛，正面小人更易辨认
  put(buf, W, ox + 7, oy + 5, ...rim)
  put(buf, W, ox + 8, oy + 5, ...rim)
  put(buf, W, ox + 9, oy + 5, ...rim)
  put(buf, W, ox + 7, oy + 8, 32, 28, 24, 255)
  put(buf, W, ox + 9, oy + 8, 32, 28, 24, 255)
  fill(buf, W, CHAR_H, ox + 5, oy + 11, ox + 11, oy + 18, ...shirt)
  fill(buf, W, CHAR_H, ox + 6, oy + 18, ox + 10, oy + 26, ...pants)
  const L = legPhase
  put(buf, W, ox + 5 + L, oy + 26, ...pants)
  put(buf, W, ox + 6 + L, oy + 27, ...pants)
  put(buf, W, ox + 9 - L, oy + 26, ...pants)
  put(buf, W, ox + 10 - L, oy + 27, ...pants)
}

function drawBackPerson(buf, W, ox, oy, shirt, pants, legPhase) {
  fill(buf, W, CHAR_H, ox + 5, oy + 6, ox + 11, oy + 11, ...shirt)
  fill(buf, W, CHAR_H, ox + 5, oy + 11, ox + 11, oy + 18, ...shirt)
  fill(buf, W, CHAR_H, ox + 6, oy + 18, ox + 10, oy + 26, ...pants)
  const L = legPhase
  put(buf, W, ox + 5 + L, oy + 26, ...pants)
  put(buf, W, ox + 9 - L, oy + 26, ...pants)
}

function drawRightPerson(buf, W, ox, oy, skin, shirt, pants, legPhase) {
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 4; dx++)
      if (Math.hypot(dx - 1.5, dy - 2) < 2.4) put(buf, W, ox + 7 + dx, oy + 6 + dy, ...skin)
  put(buf, W, ox + 10, oy + 6, 26, 22, 20, 255)
  put(buf, W, ox + 10, oy + 7, 32, 28, 24, 255)
  fill(buf, W, CHAR_H, ox + 6, oy + 11, ox + 12, oy + 18, ...shirt)
  fill(buf, W, CHAR_H, ox + 7, oy + 18, ox + 11, oy + 26, ...pants)
  const L = legPhase
  put(buf, W, ox + 7 + L, oy + 26, ...pants)
  put(buf, W, ox + 10 - L, oy + 26, ...pants)
}

function drawTypingPose(buf, W, ox, oy, skin, shirt, pants, dir, padRgb) {
  if (dir === 1) {
    fill(buf, W, CHAR_H, ox + 5, oy + 6, ox + 11, oy + 11, ...shirt)
    fill(buf, W, CHAR_H, ox + 5, oy + 11, ox + 11, oy + 18, ...shirt)
    fill(buf, W, CHAR_H, ox + 3, oy + 14, ox + 5, oy + 17, ...padRgb)
    fill(buf, W, CHAR_H, ox + 6, oy + 18, ox + 10, oy + 28, ...pants)
    return
  }
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 5; dx++)
      if (Math.hypot(dx - 2, dy - 2) < 2.6) put(buf, W, ox + 6 + dx, oy + 6 + dy, ...skin)
  fill(buf, W, CHAR_H, ox + 5, oy + 11, ox + 11, oy + 19, ...shirt)
  if (dir === 0) fill(buf, W, CHAR_H, ox + 4, oy + 14, ox + 6, oy + 17, ...padRgb)
  else fill(buf, W, CHAR_H, ox + 10, oy + 14, ox + 13, oy + 17, ...padRgb)
  fill(buf, W, CHAR_H, ox + 6, oy + 19, ox + 10, oy + 28, ...pants)
}

function drawReadingPose(buf, W, ox, oy, skin, shirt, pants, dir, bookRgb) {
  if (dir === 1) {
    fill(buf, W, CHAR_H, ox + 5, oy + 5, ox + 11, oy + 11, ...shirt)
    fill(buf, W, CHAR_H, ox + 5, oy + 11, ox + 11, oy + 18, ...shirt)
    fill(buf, W, CHAR_H, ox + 3, oy + 12, ox + 7, oy + 18, ...bookRgb)
    fill(buf, W, CHAR_H, ox + 6, oy + 18, ox + 10, oy + 28, ...pants)
    return
  }
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 5; dx++)
      if (Math.hypot(dx - 2, dy - 2) < 2.6) put(buf, W, ox + 6 + dx, oy + 5 + dy, ...skin)
  fill(buf, W, CHAR_H, ox + 5, oy + 10, ox + 11, oy + 18, ...shirt)
  if (dir === 0) fill(buf, W, CHAR_H, ox + 9, oy + 14, ox + 14, oy + 20, ...bookRgb)
  else fill(buf, W, CHAR_H, ox + 2, oy + 14, ox + 7, oy + 20, ...bookRgb)
  fill(buf, W, CHAR_H, ox + 6, oy + 18, ox + 10, oy + 28, ...pants)
}

function makeCharacterSheet(charIndex, charDir, theme) {
  const w = 112
  const h = 96
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 0

  // 星舰：强暖色人物 vs 冷色场景；林间：强冷色上衣 vs 暖色地面
  const starshipShirts = [
    [255, 115, 55],
    [240, 175, 45],
    [220, 75, 68],
    [255, 200, 90],
    [235, 130, 75],
    [255, 160, 120],
  ]
  const groveShirts = [
    [95, 195, 255],
    [165, 115, 255],
    [70, 210, 225],
    [130, 150, 255],
    [185, 95, 230],
    [55, 165, 210],
  ]
  const shirts = theme === 'starship' ? starshipShirts : groveShirts
  const shirt = shirts[charIndex % shirts.length]
  const skin = theme === 'starship' ? [242, 205, 185] : [255, 215, 188]
  const pants = theme === 'starship' ? [38, 58, 108] : [125, 72, 42]
  const padRgb =
    theme === 'starship' ? [255, 170, 85] : [255, 210, 130]
  const bookRgb =
    theme === 'starship' ? [255, 235, 210] : [235, 185, 120]

  for (let dir = 0; dir < 3; dir++) {
    const rowY = dir * 32
    for (let f = 0; f < 7; f++) {
      const fx = f * 16
      const leg = f % 3 === 0 ? 0 : f % 3 === 1 ? 1 : -1
      if (f < 3) {
        if (dir === 0) drawTinyPerson(buf, w, fx, rowY, skin, shirt, pants, leg)
        else if (dir === 1) drawBackPerson(buf, w, fx, rowY, shirt, pants, leg)
        else drawRightPerson(buf, w, fx, rowY, skin, shirt, pants, leg)
      } else if (f < 5) {
        drawTypingPose(buf, w, fx, rowY, skin, shirt, pants, dir, padRgb)
      } else {
        drawReadingPose(buf, w, fx, rowY, skin, shirt, pants, dir, bookRgb)
      }
    }
  }
  return saveRaw(buf, w, h, path.join(charDir, `char_${charIndex}.png`))
}

function makeCatSheet(gameDir, theme) {
  const w = 128
  const h = 96
  const buf = Buffer.alloc(w * h * 4)
  const fur =
    theme === 'starship' ? [225, 145, 65] : [95, 118, 158]
  const fur2 =
    theme === 'starship' ? [185, 95, 40] : [65, 88, 128]
  const eye = theme === 'starship' ? [255, 195, 60] : [130, 230, 255]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const ox = col * 32
      const oy = row * 32
      const cx = col * 32 + 16
      const cy = row * 32 + 16
      for (let dy = 0; dy < 24; dy++) {
        for (let dx = 0; dx < 16; dx++) {
          const px = ox + 8 + dx
          const py = oy + 8 + dy
          let r, g, b, a = 255
          const lx = dx - 8
          const ly = dy - 14
          if (ly < -6 && Math.abs(lx) < 7) {
            ;[r, g, b] = fur
          } else if (ly >= -6 && ly < 4 && Math.abs(lx) < 6) {
            ;[r, g, b] = fur2
          } else if (ly >= 4 && Math.abs(lx) < 5) {
            ;[r, g, b] = fur
          } else if (
            theme === 'starship' &&
            Math.abs(lx) > 5 &&
            ly > 0 &&
            ly < 10
          ) {
            // 星舰：两侧毛簇；林地不用（否则俯视像办公椅扶手）
            const wave = (col + row + dx) % 3
            ;[r, g, b] = wave ? fur : fur2
          } else {
            a = 0
            r = g = b = 0
          }
          put(buf, w, px, py, r, g, b, a)
        }
      }
      put(buf, w, cx - 3, cy - 8, ...eye)
      put(buf, w, cx + 2, cy - 8, ...eye)
      // 林地：耳尖 + 尾，强化「小动物」而非椅子
      if (theme === 'grove') {
        const ear = [52, 82, 108]
        const earHi = [72, 108, 138]
        put(buf, w, cx - 6, cy - 10, ...ear)
        put(buf, w, cx - 5, cy - 11, ...earHi)
        put(buf, w, cx + 5, cy - 10, ...ear)
        put(buf, w, cx + 4, cy - 11, ...earHi)
        const tail = [78, 102, 132]
        put(buf, w, cx, cy + 8, ...tail)
        put(buf, w, cx, cy + 9, ...tail)
        put(buf, w, cx - 1, cy + 9, ...tail)
        put(buf, w, cx + 1, cy + 9, ...tail)
      }
    }
  }
  return saveRaw(buf, w, h, path.join(gameDir, 'cat_sheet.png'))
}

function makeLobster(gameDir, theme) {
  const s = 48
  const buf = Buffer.alloc(s * s * 4)
  const body =
    theme === 'starship' ? [235, 88, 48] : [115, 75, 175]
  const dark =
    theme === 'starship' ? [145, 48, 38] : [65, 42, 115]
  const accent =
    theme === 'starship' ? [70, 210, 235] : [255, 210, 80]
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - 24
      const dy = y - 26
      let a = 0,
        r = 0,
        g = 0,
        b = 0
      if (dx * dx * 2 + dy * dy < 120) {
        ;[r, g, b, a] = [...body, 255]
        if (theme === 'starship' && (x + y) % 5 === 0) {
          ;[r, g, b] = accent
        }
        if (theme === 'grove' && (x + y) % 6 === 0) {
          ;[r, g, b] = accent
        }
      } else if (Math.abs(dx) > 10 && dy > -8 && dy < 6 && Math.abs(dx) < 22) {
        ;[r, g, b, a] = [...dark, 255]
      } else if (dy < -6 && Math.abs(dx - 14) < 5 && dy > -18) {
        ;[r, g, b, a] = [...dark, 255]
      } else if (dy < -6 && Math.abs(dx + 14) < 5 && dy > -18) {
        ;[r, g, b, a] = [...dark, 255]
      }
      put(buf, s, x, y, r, g, b, a)
    }
  }
  return saveRaw(buf, s, s, path.join(gameDir, 'lobster.png'))
}

function makePhotographStarship(buf, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / h
      const r = Math.floor(8 + t * 25 + Math.sin(x * 0.02) * 8)
      const g = Math.floor(12 + t * 35 + Math.cos(x * 0.03) * 10)
      const b = Math.floor(40 + (1 - t) * 80)
      put(buf, w, x, y, r, g, b, 255)
    }
  }
  for (let s = 0; s < 120; s++) {
    const sx = (s * 97) % w
    const sy = (s * 53) % h
    put(buf, w, sx, sy, 255, 255, 255, 255)
    put(buf, w, sx + 1, sy, 220, 240, 255, 255)
  }
  fill(buf, w, h, 0, h - 55, w, h, 15, 20, 35, 255)
  fill(buf, w, h, 40, 95, w - 40, h - 58, 25, 35, 55, 255)
  for (let i = 0; i < 6; i++) {
    const wx = 45 + i * 48
    fill(buf, w, h, wx, 70, wx + 3, 125, 180, 230, 255, 255)
  }
}

function makePhotographGrove(buf, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sky = y / h
      const r = Math.floor(28 + sky * 85)
      const g = Math.floor(75 + sky * 55)
      const b = Math.floor(45 + (1 - sky) * 40)
      put(buf, w, x, y, r, g, b, 255)
    }
  }
  for (let tx = 25; tx < w - 25; tx += 42) {
    for (let ty = 35; ty < 125; ty += 7) {
      const shade = 32 + (ty % 20)
      fill(buf, w, h, tx, ty, tx + 20, ty + 5, 28, shade + 25, 38, 255)
    }
  }
  for (let m = 0; m < 10; m++) {
    const mx = 45 + (m * 31) % (w - 110)
    const my = 118 + (m % 4) * 6
    for (let dy = 0; dy < 22; dy++) {
      for (let dx = 0; dx < 26; dx++) {
        if (dx * dx + (dy - 11) * (dy - 11) * 2 < 110) {
          const c = m % 2 ? [210, 70, 95] : [230, 210, 70]
          put(buf, w, mx + dx, my + dy, ...c, 255)
        }
      }
    }
  }
  for (let f = 0; f < 35; f++) {
    put(buf, w, (f * 59) % w, (f * 71) % h, 255, 248, 160, 255)
  }
  // 底部招募条（与星舰海报呼应，避免像办公室白板）
  fill(buf, w, h, 0, h - 48, w, h, 95, 62, 38, 255)
  fill(buf, w, h, 4, h - 44, w - 4, h - 4, 140, 95, 55, 255)
  for (let x = 24; x < w - 24; x += 3) {
    const on = (x >> 2) % 2 === 0
    for (let yy = h - 38; yy < h - 10; yy += 2)
      put(buf, w, x, yy, on ? 255 : 240, on ? 235 : 210, on ? 180 : 150, 255)
  }
}

function makePhotograph(gameDir, theme) {
  const w = 320
  const h = 200
  const buf = Buffer.alloc(w * h * 4)
  if (theme === 'starship') makePhotographStarship(buf, w, h)
  else makePhotographGrove(buf, w, h)
  return saveRaw(buf, w, h, path.join(gameDir, 'photograph.png'))
}

const ATLAS_H = 320

function clearAtlasSlot(buf, aw, H, x, y, w, h) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) put(buf, aw, px, py, 0, 0, 0, 0)
}

/** 32×32：主题小游戏道具 + 咖啡/手机/相机（输出裁成 16×16） */
function paintProp32(buf, aw, ox, oy, type, theme) {
  clearAtlasSlot(buf, aw, ATLAS_H, ox, oy, 32, 32)
  const S = theme === 'starship'
  const disc = (cx, cy, r, rgb) => {
    const [R, G, B] = rgb
    for (let py = oy; py < oy + 32; py++) {
      for (let px = ox; px < ox + 32; px++) {
        if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) put(buf, aw, px, py, R, G, B, 255)
      }
    }
  }

  const cx = ox + 16
  const cy = oy + 16

  if (type === 'game_ufo') {
    // 星舰：冷色壳体 + 暖色舷窗；林间：冷色金属感 + 暖色灯带（与暖地面对比）
    disc(cx, cy + 5, 11, S ? [55, 95, 145] : [45, 120, 145])
    disc(cx, cy - 3, 7, S ? [255, 195, 95] : [255, 210, 120])
    fill(buf, aw, ATLAS_H, ox + 8, oy + 4, ox + 24, oy + 10, S ? 255 : 255, S ? 160 : 200, S ? 85 : 70, 255)
  } else if (type === 'game_satellite') {
    fill(buf, aw, ATLAS_H, ox + 12, oy + 8, ox + 20, oy + 22, S ? 62 : 70, S ? 88 : 95, S ? 118 : 108, 255)
    fill(buf, aw, ATLAS_H, ox + 4, oy + 12, ox + 12, oy + 18, S ? 235 : 55, S ? 125 : 140, S ? 75 : 165, 255)
    fill(buf, aw, ATLAS_H, ox + 20, oy + 12, ox + 28, oy + 18, S ? 235 : 55, S ? 125 : 140, S ? 75 : 165, 255)
    disc(cx, cy - 6, 5, S ? [255, 220, 140] : [180, 230, 255])
  } else if (type === 'game_rocket') {
    for (let py = oy; py < oy + 32; py++) {
      for (let px = ox; px < ox + 32; px++) {
        const dx = Math.abs(px - cx)
        const tip = py - oy
        if (tip < 22 && dx < tip * 0.55 + 2)
          put(
            buf,
            aw,
            px,
            py,
            S ? 110 : 95,
            S ? 125 : 75,
            S ? 155 : 175,
            255,
          )
      }
    }
    fill(buf, aw, ATLAS_H, ox + 12, oy + 20, ox + 20, oy + 28, S ? 255 : 255, S ? 185 : 200, S ? 95 : 75, 255)
  } else if (type === 'game_star') {
    fill(
      buf,
      aw,
      ATLAS_H,
      cx - 2,
      oy + 4,
      cx + 2,
      oy + 28,
      S ? 255 : 120,
      S ? 220 : 210,
      S ? 90 : 255,
      255,
    )
    fill(
      buf,
      aw,
      ATLAS_H,
      ox + 6,
      cy - 2,
      ox + 26,
      cy + 2,
      S ? 255 : 130,
      S ? 235 : 200,
      S ? 110 : 255,
      255,
    )
    disc(cx, cy, 5, S ? [255, 255, 240] : [200, 245, 255])
  } else if (type === 'game_tree') {
    fill(buf, aw, ATLAS_H, cx - 2, oy + 18, cx + 2, oy + 30, S ? 72 : 115, S ? 52 : 68, S ? 38 : 42, 255)
    for (let py = oy + 4; py < oy + 20; py++) {
      for (let px = ox; px < ox + 32; px++) {
        const wv = (20 - (py - oy - 4)) * 0.65
        if (Math.abs(px - cx) < wv)
          put(
            buf,
            aw,
            px,
            py,
            S ? 35 : 40,
            S ? 95 : 175,
            S ? 75 : 165,
            255,
          )
      }
    }
  } else if (type === 'game_mushroom') {
    fill(buf, aw, ATLAS_H, cx - 3, oy + 14, cx + 3, oy + 28, S ? 230 : 245, S ? 210 : 225, S ? 185 : 200, 255)
    disc(cx, cy - 2, 10, S ? [200, 70, 55] : [140, 70, 200])
    put(buf, aw, cx - 4, cy - 4, 255, 255, 255, 255)
    put(buf, aw, cx + 3, cy - 1, 255, 255, 255, 255)
  } else if (type === 'game_campfire') {
    fill(buf, aw, ATLAS_H, ox + 8, oy + 22, ox + 24, oy + 30, 60, 40, 25, 255)
    disc(cx, cy + 2, 8, [255, 140, 40])
    disc(cx, cy, 5, [255, 220, 80])
    put(buf, aw, cx, cy - 2, 255, 255, 200, 255)
  } else if (type === 'game_glow') {
    disc(cx, cy, 14, S ? [40, 90, 160] : [60, 160, 175])
    disc(cx, cy, 10, S ? [120, 190, 255] : [140, 230, 255])
    disc(cx, cy, 5, S ? [255, 245, 200] : [255, 255, 255])
  } else if (type === 'game_butterfly') {
    const wing = S ? [255, 150, 65] : [90, 200, 255]
    const wing2 = S ? [220, 95, 40] : [50, 150, 220]
    for (let py = oy + 8; py < oy + 22; py++) {
      for (let px = ox + 4; px < cx; px++) {
        if ((px - ox - 4 + py - oy) % 3 !== 0) {
          const c = (px + py) % 2 === 0 ? wing2 : wing
          put(buf, aw, px, py, c[0], c[1], c[2], 255)
        }
      }
      for (let px = cx + 1; px < ox + 28; px++) {
        if ((ox + 28 - px + py - oy) % 3 !== 0) {
          const c = (px + py) % 2 === 0 ? wing2 : wing
          put(buf, aw, px, py, c[0], c[1], c[2], 255)
        }
      }
    }
    fill(buf, aw, ATLAS_H, cx - 1, cy - 4, cx + 1, cy + 8, 40, 35, 30, 255)
  } else if (type === 'game_rabbit') {
    disc(cx, cy + 4, 9, S ? [245, 220, 205] : [235, 200, 185])
    fill(buf, aw, ATLAS_H, cx - 3, oy + 6, cx + 3, oy + 13, 252, 248, 245, 255)
    put(buf, aw, cx - 5, oy + 5, 210, 185, 175, 255)
    put(buf, aw, cx + 4, oy + 5, 210, 185, 175, 255)
    put(buf, aw, cx - 2, cy + 5, 35, 38, 42, 255)
    put(buf, aw, cx + 1, cy + 5, 35, 38, 42, 255)
    put(buf, aw, cx - 1, cy + 8, 255, 120, 130, 255)
  } else if (type === 'game_cat_deco') {
    disc(cx, cy + 3, 9, S ? [195, 165, 125] : [140, 165, 205])
    fill(buf, aw, ATLAS_H, cx - 2, oy + 7, cx + 2, oy + 11, 255, 200, 120, 255)
    put(buf, aw, cx - 6, oy + 7, 55, 52, 48, 255)
    put(buf, aw, cx + 5, oy + 7, 55, 52, 48, 255)
    put(buf, aw, cx, cy + 6, 55, 50, 48, 255)
  } else if (type === 'game_blaster') {
    fill(buf, aw, ATLAS_H, ox + 10, oy + 10, ox + 22, oy + 21, S ? 65 : 85, S ? 88 : 100, S ? 115 : 125, 255)
    fill(buf, aw, ATLAS_H, ox + 6, oy + 13, ox + 12, oy + 18, S ? 255 : 230, S ? 210 : 100, S ? 90 : 255, 255)
    fill(buf, aw, ATLAS_H, ox + 20, oy + 12, ox + 28, oy + 16, S ? 255 : 255, S ? 235 : 210, S ? 130 : 90, 255)
  } else if (type === 'game_planet') {
    disc(cx, cy, 11, S ? [75, 105, 155] : [110, 150, 85])
    disc(cx, cy, 7, S ? [130, 175, 215] : [175, 215, 135])
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * Math.PI * 2
      const px = Math.floor(cx + Math.cos(ang) * 13)
      const py = Math.floor(cy + Math.sin(ang) * 4)
      put(buf, aw, px, py, S ? 255 : 255, S ? 215 : 195, S ? 140 : 110, 255)
    }
  } else if (type === 'coffee') {
    fill(buf, aw, ATLAS_H, ox + 8, oy + 10, ox + 22, oy + 24, S ? 52 : 95, S ? 68 : 72, S ? 88 : 58, 255)
    fill(buf, aw, ATLAS_H, ox + 10, oy + 6, ox + 20, oy + 12, S ? 38 : 125, S ? 48 : 88, S ? 62 : 48, 255)
    fill(buf, aw, ATLAS_H, ox + 11, oy + 12, ox + 19, oy + 18, 40, 30, 25, 255)
    fill(buf, aw, ATLAS_H, ox + 12, oy + 13, ox + 18, oy + 16, S ? 255 : 255, S ? 235 : 248, S ? 210 : 220, 255)
  } else if (type === 'phone') {
    fill(buf, aw, ATLAS_H, ox + 10, oy + 4, ox + 22, oy + 26, S ? 38 : 125, S ? 48 : 95, S ? 62 : 72, 255)
    fill(buf, aw, ATLAS_H, ox + 11, oy + 7, ox + 21, oy + 20, S ? 255 : 70, S ? 185 : 130, S ? 120 : 200, 255)
    put(buf, aw, cx, oy + 23, S ? 255 : 120, S ? 200 : 200, S ? 95 : 255, 255)
  } else if (type === 'camera') {
    fill(buf, aw, ATLAS_H, ox + 6, oy + 8, ox + 26, oy + 22, S ? 48 : 108, S ? 58 : 85, S ? 72 : 95, 255)
    disc(cx, cy + 1, 7, S ? [20, 25, 35] : [35, 35, 40])
    disc(cx, cy + 1, 4, S ? [255, 175, 85] : [120, 200, 255])
    put(buf, aw, cx - 7, oy + 11, 220, 220, 225, 255)
    put(buf, aw, cx + 7, oy + 11, 220, 220, 225, 255)
  }
}

/** @param {ThemeId} theme */
function paintFurnitureSlot(buf, aw, type, x, y, rw, rh, theme) {
  const S = theme === 'starship'
  const metal = (v) => gray(buf, aw, ATLAS_H, x, y, x + rw, y + rh, v)
  // 星舰：家具偏冷金属/青灰 + 局部暖木/暖光；林间：暖木沙发 + 冷屏/冷植/冷装饰
  const deskTop = S ? [98, 62, 45] : [118, 82, 48]
  const deskLeg = S ? [42, 58, 92] : [52, 92, 102]
  const shelf = S ? [68, 86, 108] : [102, 72, 46]
  const shelfLine = S ? 48 : 58
  const pot = S ? [155, 88, 52] : [48, 108, 118]
  const leaf = S ? [32, 150, 125] : [38, 165, 175]
  const leaf2 = S ? [22, 110, 95] : [28, 125, 145]
  const ice = S ? [55, 145, 210] : [130, 210, 235]
  const frame = S ? [48, 58, 72] : [95, 68, 42]
  const seat = S ? [210, 118, 72] : [72, 88, 105]
  const seatBack = S ? [55, 72, 95] : [52, 68, 88]
  const monBezel = S ? [28, 34, 44] : [38, 42, 48]
  const screen = S ? [235, 145, 88] : [65, 145, 165]
  const lampStem = S ? [62, 78, 95] : [125, 88, 48]
  const lampGlow = S ? [255, 210, 125] : [195, 230, 255]
  const clockF = S ? [175, 188, 205] : [225, 195, 155]
  const paintA = S ? [220, 120, 75] : [70, 140, 175]
  const paintB = S ? [55, 95, 155] : [210, 160, 85]
  const rackLed = S ? [0, 255, 200] : [120, 255, 100]
  const sofaC = S ? [72, 88, 105] : [118, 78, 48]
  const deco = S ? [95, 75, 155] : [140, 95, 210]

  const box = () => metal(42)

  if (type === 'desk') {
    fill(buf, aw, ATLAS_H, x, y, x + rw, y + 10, ...deskTop)
    fill(buf, aw, ATLAS_H, x + 2, y + 10, x + 6, y + rh, ...deskLeg)
    fill(buf, aw, ATLAS_H, x + rw - 6, y + 10, x + rw - 2, y + rh, ...deskLeg)
  } else if (type === 'bookshelf' || type.includes('library')) {
    fill(buf, aw, ATLAS_H, x, y, x + rw, y + rh, ...shelf)
    for (let yy = y + 4; yy < y + rh; yy += 6)
      gray(buf, aw, ATLAS_H, x + 2, yy, x + rw - 2, yy + 1, shelfLine)
  } else if (type === 'plant' || type.includes('plant')) {
    const px = Math.floor(x + rw / 2)
    fill(buf, aw, ATLAS_H, px - 4, y + rh - 8, px + 4, y + rh, ...pot)
    for (let py = y; py < y + rh - 8; py++)
      for (let px2 = x; px2 < x + rw; px2++) {
        if (Math.hypot(px2 - (x + rw / 2), py - (y + rh - 14)) < rw / 2) {
          const c = (px2 + py) % 3 ? leaf : leaf2
          put(buf, aw, px2, py, ...c, 255)
        }
      }
  } else if (type.includes('cooler') || type.includes('fridge') || type === 'cooler') {
    gray(buf, aw, ATLAS_H, x, y, x + rw, y + rh, S ? 175 : 195)
    fill(buf, aw, ATLAS_H, x + 4, y + 6, x + 8, y + rh - 4, ...ice)
  } else if (type.includes('whiteboard')) {
    fill(buf, aw, ATLAS_H, x + 2, y + 2, x + rw - 2, y + rh - 2, S ? 230 : 245, S ? 235 : 242, S ? 240 : 235, 255)
    fill(buf, aw, ATLAS_H, x, y, x + rw, y + 3, ...frame)
  } else if (type === 'chair' || type.includes('chair')) {
    fill(buf, aw, ATLAS_H, x, y + rh - 6, x + rw, y + rh, ...seat)
    fill(buf, aw, ATLAS_H, x + 2, y + 4, x + rw - 2, y + rh - 6, ...seatBack)
  } else if (type === 'pc' || type === 'pc_back') {
    fill(buf, aw, ATLAS_H, x + 2, y + 2, x + rw - 2, y + rh - 4, ...monBezel)
    fill(buf, aw, ATLAS_H, x + 3, y + 3, x + rw - 3, y + rh - 6, ...screen)
  } else if (type.includes('lamp')) {
    const cx = Math.floor(x + rw / 2)
    fill(buf, aw, ATLAS_H, cx - 2, y, cx + 2, y + rh, ...lampStem)
    fill(buf, aw, ATLAS_H, x + 2, y + 2, x + rw - 2, y + 10, ...lampGlow)
  } else if (type.includes('clock')) {
    fill(buf, aw, ATLAS_H, x + 2, y + 2, x + rw - 2, y + rh - 2, ...clockF)
    put(buf, aw, Math.floor(x + rw / 2), Math.floor(y + rh / 2), 45, 45, 50, 255)
  } else if (type.includes('table')) {
    fill(buf, aw, ATLAS_H, x, y, x + rw, y + 6, ...deskTop)
    fill(buf, aw, ATLAS_H, x + 2, y + 6, x + 6, y + rh, ...deskLeg)
    fill(buf, aw, ATLAS_H, x + rw - 6, y + 6, x + rw - 2, y + rh, ...deskLeg)
  } else if (type.includes('painting')) {
    fill(buf, aw, ATLAS_H, x, y, x + rw, y + 3, ...frame)
    fill(buf, aw, ATLAS_H, x + 1, y + 3, x + rw - 1, y + rh - 1, ...paintA)
    fill(buf, aw, ATLAS_H, x + 3, y + 5, x + rw - 3, y + rh - 3, ...paintB)
  } else if (type.includes('server')) {
    gray(buf, aw, ATLAS_H, x, y, x + rw, y + rh, S ? 42 : 48)
    for (let yy = y + 4; yy < y + rh; yy += 5)
      fill(buf, aw, ATLAS_H, x + 3, yy, x + rw - 3, yy + 2, ...rackLed)
  } else if (type.includes('sofa')) {
    fill(buf, aw, ATLAS_H, x, y + rh - 10, x + rw, y + rh, ...sofaC)
    fill(buf, aw, ATLAS_H, x, y + 6, x + rw, y + rh - 10, ...sofaC)
    fill(buf, aw, ATLAS_H, x, y, x + 4, y + 10, ...sofaC)
    fill(buf, aw, ATLAS_H, x + rw - 4, y, x + rw, y + 10, ...sofaC)
  } else if (type.includes('bench')) {
    fill(buf, aw, ATLAS_H, x, y + rh - 4, x + rw, y + rh, ...seat)
    fill(buf, aw, ATLAS_H, x + 1, y + 2, x + rw - 1, y + rh - 4, ...seatBack)
  } else if (type.includes('deco')) {
    fill(buf, aw, ATLAS_H, x + 4, y + 4, x + rw - 4, y + rh - 4, ...deco)
  } else if (
    type.startsWith('game_') ||
    type === 'coffee' ||
    type === 'phone' ||
    type === 'camera'
  ) {
    if (rw >= 32 && rh >= 32) paintProp32(buf, aw, x, y, type, theme)
    else box()
  } else {
    box()
  }
}

async function makeFurnitureAtlas(gameDir, theme) {
  const manifest = JSON.parse(fs.readFileSync(SHARED_MANIFEST, 'utf8'))
  const aw = 480
  const ah = 320
  const buf = Buffer.alloc(aw * ah * 4)
  for (let i = 0; i < aw * ah; i++) {
    buf[i * 4 + 3] = 0
  }
  for (const [type, rect] of Object.entries(manifest.entries)) {
    paintFurnitureSlot(buf, aw, type, rect.x, rect.y, rect.w, rect.h, theme)
  }
  await saveRaw(buf, aw, ah, path.join(gameDir, 'furniture-atlas.png'))
  fs.copyFileSync(SHARED_MANIFEST, path.join(gameDir, 'atlas-manifest.json'))
}

async function extractStarshipUserBundle(srcPath, gameDir) {
  const img = sharp(srcPath)
  const meta = await img.metadata()
  const W = meta.width
  const H = meta.height
  if (!W || !H) return false
  const y1 = Math.round(H / 3)
  const y2 = Math.round((2 * H) / 3)
  await sharp(srcPath)
    .extract({ left: 0, top: 0, width: W, height: y1 })
    .resize(320, 200, { kernel: sharp.kernel.nearest, fit: 'cover' })
    .png()
    .toFile(path.join(gameDir, 'photograph.png'))
  await sharp(srcPath)
    .extract({ left: 0, top: y1, width: W, height: y2 - y1 })
    .png()
    .toFile(path.join(gameDir, 'cat_sheet.png'))
  return true
}

async function generateGamePack(theme) {
  const gameDir = path.join(PIXEL_ROOT, 'games', theme)
  const charDir = path.join(gameDir, 'characters')
  fs.mkdirSync(charDir, { recursive: true })
  fs.mkdirSync(path.join(PIXEL_ROOT, 'source'), { recursive: true })
  await makeWallsPng(gameDir, theme)
  await makeFloorsPng(gameDir, theme)
  if (theme === 'starship' && fs.existsSync(STARSHIP_USER_BUNDLE)) {
    const ok = await extractStarshipUserBundle(STARSHIP_USER_BUNDLE, gameDir)
    if (ok) console.log('  → 星舰：已套用 source/starship-lobster-bundle.png（海报墙 + 机械猫）')
    else {
      await makeCatSheet(gameDir, theme)
      await makePhotograph(gameDir, theme)
    }
  } else {
    await makeCatSheet(gameDir, theme)
    await makePhotograph(gameDir, theme)
  }
  await makeLobster(gameDir, theme)
  await makeFurnitureAtlas(gameDir, theme)
  for (let i = 0; i < 6; i++) await makeCharacterSheet(i, charDir, theme)
  console.log('OK →', gameDir)
}

async function main() {
  await generateGamePack('starship')
  await generateGamePack('grove')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
