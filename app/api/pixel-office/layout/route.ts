import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { OPENCLAW_PIXEL_OFFICE_DIR } from '@/lib/openclaw-paths'

const LAYOUT_DIR = OPENCLAW_PIXEL_OFFICE_DIR
/** 经典办公室沿用原路径，兼容旧数据 */
const LAYOUT_FILE_LEGACY = path.join(LAYOUT_DIR, 'layout.json')

function isValidGameId(g: string): g is 'classic' | 'starship' | 'grove' {
  return g === 'classic' || g === 'starship' || g === 'grove'
}

function layoutFileForGame(game: string): string {
  const g = isValidGameId(game) ? game : 'classic'
  if (g === 'classic') return LAYOUT_FILE_LEGACY
  return path.join(LAYOUT_DIR, `layout-${g}.json`)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gameRaw = searchParams.get('game') || 'classic'
    const game = isValidGameId(gameRaw) ? gameRaw : 'classic'

    const primary = layoutFileForGame(game)
    if (fs.existsSync(primary)) {
      const data = fs.readFileSync(primary, 'utf-8')
      const layout = JSON.parse(data)
      return NextResponse.json({ layout, game })
    }
    // 经典模式：若无独立文件则保持旧行为
    if (game === 'classic') {
      return NextResponse.json({ layout: null, game })
    }
    return NextResponse.json({ layout: null, game })
  } catch {
    return NextResponse.json({ layout: null, game: 'classic' })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { layout } = body
    const gameRaw = typeof body.game === 'string' ? body.game : 'classic'
    const game = isValidGameId(gameRaw) ? gameRaw : 'classic'

    if (!layout || layout.version !== 1 || !Array.isArray(layout.tiles)) {
      return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
    }

    if (!fs.existsSync(LAYOUT_DIR)) {
      fs.mkdirSync(LAYOUT_DIR, { recursive: true })
    }

    const targetFile = layoutFileForGame(game)
    const tmpFile = targetFile + '.tmp'
    fs.writeFileSync(tmpFile, JSON.stringify(layout, null, 2), 'utf-8')
    fs.renameSync(tmpFile, targetFile)

    return NextResponse.json({ success: true, game })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
