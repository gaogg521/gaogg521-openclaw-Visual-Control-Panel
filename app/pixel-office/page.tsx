'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { OfficeState, type GatewaySreState, type OfficeLocale } from '@/lib/pixel-office/engine/officeState'
import { renderFrame } from '@/lib/pixel-office/engine/renderer'
import { buildGatewayUrl } from "@/lib/gateway-url"
import type { EditorRenderState } from '@/lib/pixel-office/engine/renderer'
import type { ContributionData } from '@/lib/pixel-office/engine/renderer'
import { formatAgentDisplayName } from '@/lib/pixel-office/agentDisplayName'
import { syncAgentsToOffice, AgentActivity } from '@/lib/pixel-office/agentBridge'
import { EditorState } from '@/lib/pixel-office/editor/editorState'
import {
  paintTile, placeFurniture, removeFurniture, moveFurniture,
  rotateFurniture, toggleFurnitureState, canPlaceFurniture,
  expandLayout, getWallPlacementRow,
} from '@/lib/pixel-office/editor/editorActions'
import type { ExpandDirection } from '@/lib/pixel-office/editor/editorActions'
import { TILE_SIZE } from '@/lib/pixel-office/constants'
import { TileType, EditTool } from '@/lib/pixel-office/types'
import type { TileType as TileTypeVal, FloorColor, OfficeLayout } from '@/lib/pixel-office/types'
import { getCatalogEntry, isRotatable } from '@/lib/pixel-office/layout/furnitureCatalog'
import { migrateLayoutColors, serializeLayout } from '@/lib/pixel-office/layout/layoutSerializer'
import { createDefaultLayoutForGame } from '@/lib/pixel-office/layout/layoutFactory'
import { isSavedThemeLayoutStale } from '@/lib/pixel-office/layout/layoutRevisions'
import {
  playDoneSound,
  playBackgroundMusic,
  stopBackgroundMusic,
  skipToNextTrack,
  unlockAudio,
  setSoundEnabled,
  isSoundEnabled,
  setBackgroundMusicGame,
} from '@/lib/pixel-office/notificationSound'
import { setProceduralBgmWorkloadIntensity } from '@/lib/pixel-office/proceduralBgm'
import { applyPixelAssetPackForGame } from '@/lib/pixel-office/sprites/pixelAssetPack'
import {
  OFFICE_GAME_IDS,
  OFFICE_GAME_STORAGE_KEY,
  getOfficeGameCanvasBackdropClass,
  getOfficeGameCanvasFrameClass,
  getOfficeGameTopBarClass,
  parseOfficeGameId,
  type OfficeGameId,
} from '@/lib/pixel-office/gameThemes'
import { useI18n } from '@/lib/i18n'
import { EditorToolbar } from './components/EditorToolbar'
import { EditActionBar } from './components/EditActionBar'
import { StarshipStarfield } from './components/StarshipStarfield'
import {
  AgentCard,
  type AgentCardAgent,
  type AgentModelTestResult,
  type AgentSessionTestResult,
  type PlatformTestResult,
} from '../components/agent-card'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatMs(ms: number): string {
  if (!ms) return '-'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

type ReleaseInfo = {
  tag: string
  name: string
  publishedAt: string
  body: string
  htmlUrl: string
}

type AgentStats = {
  sessionCount: number
  messageCount: number
  totalTokens: number
  todayAvgResponseMs: number
  weeklyResponseMs: number[]
  weeklyTokens: number[]
  lastActive: number | null
}

type ConfigAgentCard = AgentCardAgent

function MiniSparkline({ data, width = 120, height = 24, color: fixedColor }: { data: number[]; width?: number; height?: number; color?: string }) {
  const hasData = data.some(v => v > 0)
  if (!hasData) return null
  const validValues = data.filter(v => v > 0)
  let trending: 'up' | 'down' | 'flat' = 'flat'
  if (validValues.length >= 2) {
    const last = validValues[validValues.length - 1]
    const prev = validValues[validValues.length - 2]
    trending = last > prev ? 'up' : last < prev ? 'down' : 'flat'
  }
  const color = fixedColor || (trending === 'up' ? '#f87171' : trending === 'down' ? '#4ade80' : '#f59e0b')
  const max = Math.max(...data)
  const min = Math.min(...data.filter(v => v > 0), max)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = v === 0 ? height - pad : (height - pad) - ((v - min) / range) * (height - pad * 2 - 2)
    return { x, y, v }
  })
  const line = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `${pts[0].x},${height} ${line} ${pts[pts.length - 1].x},${height}`
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.filter(p => p.v > 0).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} opacity={0.9} />
      ))}
    </svg>
  )
}

/** Convert mouse event to tile coordinates */
function mouseToTile(
  clientX: number, clientY: number, canvas: HTMLCanvasElement, office: OfficeState, zoom: number, pan: { x: number; y: number }
): { col: number; row: number; worldX: number; worldY: number } {
  const rect = canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const cols = office.layout.cols
  const rows = office.layout.rows
  const mapW = cols * TILE_SIZE * zoom
  const mapH = rows * TILE_SIZE * zoom
  const offsetX = (rect.width - mapW) / 2 + pan.x
  const offsetY = (rect.height - mapH) / 2 + pan.y
  const worldX = (x - offsetX) / zoom
  const worldY = (y - offsetY) / zoom
  const col = Math.floor(worldX / TILE_SIZE)
  const row = Math.floor(worldY / TILE_SIZE)
  return { col, row, worldX, worldY }
}

/** Detect ghost border tile (expansion zone) */
function getGhostBorderDirection(col: number, row: number, cols: number, rows: number): ExpandDirection | null {
  if (row === -1) return 'up'
  if (row === rows) return 'down'
  if (col === -1) return 'left'
  if (col === cols) return 'right'
  return null
}

function getLayoutContentBounds(layout: OfficeLayout): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  let minCol = layout.cols - 1
  let maxCol = 0
  let minRow = layout.rows - 1
  let maxRow = 0
  let hasContent = false

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (layout.tiles[r * layout.cols + c] === TileType.VOID) continue
      hasContent = true
      if (c < minCol) minCol = c
      if (c > maxCol) maxCol = c
      if (r < minRow) minRow = r
      if (r > maxRow) maxRow = r
    }
  }

  for (const f of layout.furniture) {
    const entry = getCatalogEntry(f.type)
    const w = Math.max(1, entry?.footprintW ?? 1)
    const h = Math.max(1, entry?.footprintH ?? 1)
    hasContent = true
    if (f.col < minCol) minCol = f.col
    if (f.col + w - 1 > maxCol) maxCol = f.col + w - 1
    if (f.row < minRow) minRow = f.row
    if (f.row + h - 1 > maxRow) maxRow = f.row + h - 1
  }

  if (!hasContent) return { minCol: 0, maxCol: layout.cols - 1, minRow: 0, maxRow: layout.rows - 1 }
  return {
    minCol: Math.max(0, minCol),
    maxCol: Math.min(layout.cols - 1, maxCol),
    minRow: Math.max(0, minRow),
    maxRow: Math.min(layout.rows - 1, maxRow),
  }
}

const DESKTOP_CANVAS_ZOOM = 2.5
const MOBILE_CANVAS_ZOOM = 1.9
const MOBILE_MIN_ZOOM = 0.55
const MOBILE_MAX_ZOOM = 6
const MOBILE_FIT_PADDING_PX = 2
const MOBILE_TOP_EXTRA_TILES = 0.5
const MOBILE_VIEW_NUDGE_Y_PX = -10
const DESKTOP_TOP_EXTRA_TILES = 1.0
const DESKTOP_TOP_SAFE_PADDING_PX = 4
const CODE_SNIPPET_LIFETIME_SEC = 5.5
const SRE_BLACKWORD_MAX_FLOAT_DIST_PX = 320
const FLOATING_TICK_INTERVAL_DESKTOP_MS = 48
const FLOATING_TICK_INTERVAL_MOBILE_MS = 32
const AGENT_ACTIVITY_POLL_INTERVAL_MS = 1000
const GATEWAY_HEALTH_POLL_INTERVAL_MS = 10000
const GATEWAY_DEGRADED_LATENCY_MS = 1500
const GATEWAY_SRE_DOWN_FAIL_THRESHOLD = 2
const GATEWAY_SRE_DEGRADED_THRESHOLD = 2
const GATEWAY_SRE_RECOVERY_SUCCESS_THRESHOLD = 2

let cachedOfficeState: OfficeState | null = null
let cachedPixelOfficeGame: OfficeGameId = 'classic'
let cachedEditorState: EditorState | null = null
let cachedSavedLayout: OfficeLayout | null = null
let cachedPan: { x: number; y: number } = { x: 0, y: 0 }
let cachedIsEditMode = false
let cachedAgents: AgentActivity[] = []
let cachedAgentIdMap = new Map<string, number>()
let cachedNextCharacterId = 1
let cachedPrevAgentStates = new Map<string, string>()

export default function PixelOfficePage() {
  const { t, locale } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const officeGameIdRef = useRef<OfficeGameId>('classic')
  const officeRef = useRef<OfficeState | null>(null)
  const editorRef = useRef<EditorState>(cachedEditorState ?? new EditorState())
  const agentIdMapRef = useRef<Map<string, number>>(new Map(cachedAgentIdMap))
  const nextIdRef = useRef<{ current: number }>({ current: cachedNextCharacterId })
  const zoomRef = useRef<number>(DESKTOP_CANVAS_ZOOM)
  const panRef = useRef<{ x: number; y: number }>(cachedPan)
  const savedLayoutRef = useRef<OfficeLayout | null>(cachedSavedLayout)
  const animationFrameIdRef = useRef<number | null>(null)
  const officeReadyRef = useRef<boolean>(false)
  const prevAgentStatesRef = useRef<Map<string, string>>(new Map(cachedPrevAgentStates))
  const seenSubagentEventKeysRef = useRef<Map<string, number>>(new Map())

  const [agents, setAgents] = useState<AgentActivity[]>(cachedAgents)
  const [hoveredAgentId, setHoveredAgentId] = useState<number | null>(null)
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const agentStatsRef = useRef<Map<string, AgentStats>>(new Map())
  const configAgentsRef = useRef<Map<string, ConfigAgentCard>>(new Map())
  const contributionsRef = useRef<ContributionData | null>(null)
  const photographRef = useRef<HTMLImageElement | null>(null)
  const gatewayRef = useRef<{ port: number; token?: string; host?: string }>({ port: 18789 })
  const gatewayHealthyRef = useRef<boolean>(true)
  const gatewaySreRef = useRef<{
    status: GatewaySreState
    error: string | null
    responseMs: number | null
    checkedAt: number | null
  }>({ status: 'unknown', error: null, responseMs: null, checkedAt: null })
  const gatewayDownStreakRef = useRef(0)
  const gatewayDegradedStreakRef = useRef(0)
  const gatewayHealthyStreakRef = useRef(0)
  const providerAccessModeRef = useRef<Record<string, 'auth' | 'api_key'>>({})
  const providersRef = useRef<Array<{ id: string; api: string; models: Array<{ id: string; name: string; contextWindow?: number }>; usedBy: Array<{ id: string; emoji: string; name: string }> }>>([])
  const [isEditMode, setIsEditMode] = useState(cachedIsEditMode)
  const [soundOn, setSoundOn] = useState(true)
  const [editorTick, setEditorTick] = useState(0)
  const [officeReady, setOfficeReady] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false)
  const [showModelPanel, setShowModelPanel] = useState(false)
  const [showTokenRank, setShowTokenRank] = useState(false)
  const [broadcasts, setBroadcasts] = useState<Array<{ id: number; emoji: string; text: string }>>([])
  const [showActivityHeatmap, setShowActivityHeatmap] = useState(false)
  const activityHeatmapRef = useRef<Array<{ agentId: string; grid: number[][] }> | null>(null)
  const [showPhonePanel, setShowPhonePanel] = useState(false)
  const [versionInfo, setVersionInfo] = useState<ReleaseInfo | null>(null)
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionLoadFailed, setVersionLoadFailed] = useState(false)
  const [showIdleRank, setShowIdleRank] = useState(false)
  const [cachedModelTestResults, setCachedModelTestResults] = useState<Record<string, AgentModelTestResult | null> | null>(null)
  const [cachedPlatformTestResults, setCachedPlatformTestResults] = useState<Record<string, PlatformTestResult | null> | null>(null)
  const [cachedSessionTestResults, setCachedSessionTestResults] = useState<Record<string, AgentSessionTestResult | null> | null>(null)
  const [cachedDmSessionResults, setCachedDmSessionResults] = useState<Record<string, PlatformTestResult | null> | null>(null)
  const selectedAgentOpenedAtRef = useRef(0)
  const tokenRankOpenedAtRef = useRef(0)
  const modelPanelOpenedAtRef = useRef(0)
  const fullscreenPhotoOpenedAtRef = useRef(0)
  const [subagentCreatorInfo, setSubagentCreatorInfo] = useState<{ parentAgentId: string; x: number; y: number } | null>(null)
  const [serverTooltip, setServerTooltip] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 })
  const idleRankRef = useRef<Array<{ agentId: string; onlineMinutes: number; activeMinutes: number; idleMinutes: number; idlePercent: number }> | null>(null)
  const floatingCommentsRef = useRef<Array<{ key: string; text: string; x: number; y: number; opacity: number }>>([])
  const floatingCodeRef = useRef<Array<{ key: string; text: string; x: number; y: number; opacity: number; kind?: 'default' | 'sre' }>>([])
  const floatingTickUpdatedAtRef = useRef<number>(0)
  const [floatingTick, setFloatingTick] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [officeGameId, setOfficeGameId] = useState<OfficeGameId>('classic')
  const forceEditorUpdate = useCallback(() => setEditorTick(t => t + 1), [])

  useEffect(() => {
    officeGameIdRef.current = officeGameId
  }, [officeGameId])

  const fetchVersionInfo = useCallback(async (forceLatest = false) => {
    setVersionLoading(true)
    setVersionLoadFailed(false)
    try {
      const url = forceLatest ? '/api/pixel-office/version?force=1' : '/api/pixel-office/version'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data || !data.tag) throw new Error('Invalid version payload')
      setVersionInfo(data)
    } catch {
      setVersionLoadFailed(true)
    } finally {
      setVersionLoading(false)
    }
  }, [])

  const refreshGatewayHealthSnapshot = useCallback(async () => {
    let rawStatus: GatewaySreState = 'down'
    let error: string | null = null
    let responseMs: number | null = null
    let checkedAt: number | null = null
    try {
      const res = await fetch('/api/gateway-health', { cache: 'no-store' })
      const data = await res.json()
      checkedAt = typeof data?.checkedAt === 'number' ? data.checkedAt : Date.now()
      responseMs = typeof data?.responseMs === 'number' ? data.responseMs : null
      error = typeof data?.error === 'string' ? data.error : null
      if (data?.status === 'healthy' || data?.status === 'degraded' || data?.status === 'down') {
        rawStatus = data.status
      } else if (!data?.ok) {
        rawStatus = 'down'
      } else if (typeof responseMs === 'number' && responseMs > GATEWAY_DEGRADED_LATENCY_MS) {
        rawStatus = 'degraded'
      } else {
        rawStatus = 'healthy'
      }
    } catch {
      rawStatus = 'down'
      error = 'fetch failed'
      checkedAt = Date.now()
    }

    const prev = gatewaySreRef.current.status
    let effective: GatewaySreState = prev

    if (rawStatus === 'down') {
      gatewayDownStreakRef.current += 1
      gatewayDegradedStreakRef.current = 0
      gatewayHealthyStreakRef.current = 0
      if (
        prev === 'unknown' ||
        prev === 'down' ||
        gatewayDownStreakRef.current >= GATEWAY_SRE_DOWN_FAIL_THRESHOLD
      ) {
        effective = 'down'
      }
    } else if (rawStatus === 'degraded') {
      gatewayDegradedStreakRef.current += 1
      gatewayDownStreakRef.current = 0
      gatewayHealthyStreakRef.current = 0
      if (
        prev === 'unknown' ||
        prev === 'degraded' ||
        gatewayDegradedStreakRef.current >= GATEWAY_SRE_DEGRADED_THRESHOLD
      ) {
        effective = 'degraded'
      }
    } else {
      gatewayHealthyStreakRef.current += 1
      gatewayDownStreakRef.current = 0
      gatewayDegradedStreakRef.current = 0
      if (prev === 'down' || prev === 'degraded') {
        if (gatewayHealthyStreakRef.current >= GATEWAY_SRE_RECOVERY_SUCCESS_THRESHOLD) {
          effective = 'healthy'
        }
      } else {
        effective = 'healthy'
      }
    }

    gatewaySreRef.current = {
      status: effective,
      error,
      responseMs,
      checkedAt,
    }
    gatewayHealthyRef.current = effective !== 'down'
    officeRef.current?.updateGatewaySreState({
      status: effective,
      error,
      responseMs,
      checkedAt,
    })
  }, [])

  // Update OfficeState locale when language changes or when office finishes loading
  useEffect(() => {
    if (officeReady) {
      officeRef.current?.setLocale(locale as OfficeLocale)
    }
  }, [locale, officeReady])

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const apply = () => setIsMobileViewport(mql.matches)
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    officeReadyRef.current = officeReady
  }, [officeReady])

  // Load saved layout and sound preference
  useEffect(() => {
    const loadLayout = async () => {
      let game: OfficeGameId = 'classic'
      try {
        game = parseOfficeGameId(localStorage.getItem(OFFICE_GAME_STORAGE_KEY))
      } catch {
        game = 'classic'
      }
      setOfficeGameId(game)
      officeGameIdRef.current = game

      const cacheStale =
        game !== 'classic' && isSavedThemeLayoutStale(game, cachedSavedLayout ?? undefined)
      if (cachedOfficeState && cachedPixelOfficeGame === game && !cacheStale) {
        officeRef.current = cachedOfficeState
        officeRef.current.setOfficeGameId(game)
        officeRef.current.setLocale(locale as OfficeLocale)
        officeRef.current.updateGatewaySreState(gatewaySreRef.current)
        savedLayoutRef.current = cachedSavedLayout
        editorRef.current = cachedEditorState ?? editorRef.current
        panRef.current = cachedPan
        setIsEditMode(cachedIsEditMode)
        await applyPixelAssetPackForGame(game)
        setOfficeReady(true)
        return
      }
      try {
        const res = await fetch(`/api/pixel-office/layout?game=${encodeURIComponent(game)}`)
        const data = await res.json()
        if (data.layout && !isSavedThemeLayoutStale(game, data.layout)) {
          const migrated = migrateLayoutColors(data.layout)
          officeRef.current = new OfficeState(migrated, locale as OfficeLocale, game)
          savedLayoutRef.current = migrated
        } else {
          const initial = createDefaultLayoutForGame(game)
          officeRef.current = new OfficeState(initial, locale as OfficeLocale, game)
          savedLayoutRef.current = initial
        }
      } catch {
        const initial = createDefaultLayoutForGame(game)
        officeRef.current = new OfficeState(initial, locale as OfficeLocale, game)
        savedLayoutRef.current = initial
      }
      cachedOfficeState = officeRef.current
      officeRef.current?.updateGatewaySreState(gatewaySreRef.current)
      cachedSavedLayout = savedLayoutRef.current
      await applyPixelAssetPackForGame(game)
      setOfficeReady(true)
    }
    loadLayout()

    const savedSound = localStorage.getItem('pixel-office-sound')
    if (savedSound !== null) {
      const enabled = savedSound !== 'false'
      setSoundOn(enabled)
      setSoundEnabled(enabled)
    }

    return () => {
      stopBackgroundMusic()
      cachedOfficeState = officeRef.current
      cachedPixelOfficeGame = officeGameIdRef.current
      cachedEditorState = editorRef.current
      cachedSavedLayout = savedLayoutRef.current
      cachedPan = panRef.current
      cachedIsEditMode = editorRef.current.isEditMode
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const office = officeRef.current
    if (!officeReady || !office || cachedAgents.length === 0) return

    for (const [agentId, charId] of agentIdMapRef.current) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMapRef.current.delete(agentId)
    }
    nextIdRef.current.current = 1

    setAgents(cachedAgents)
    syncAgentsToOffice(cachedAgents, office, agentIdMapRef.current, nextIdRef.current)
    cachedAgentIdMap = new Map(agentIdMapRef.current)
    cachedNextCharacterId = nextIdRef.current.current
  }, [officeReady])

  useEffect(() => {
    setBackgroundMusicGame(officeGameId)
    if (soundOn) {
      void playBackgroundMusic()
    } else {
      stopBackgroundMusic()
    }
  }, [officeGameId, soundOn])

  /** 程序化 BGM：专家 working 比例越高，节奏越快、鼓越密，偏战斗/紧迫 */
  useEffect(() => {
    const online = agents.filter(a => a.state !== 'offline')
    if (online.length === 0) {
      setProceduralBgmWorkloadIntensity(0)
      return
    }
    const working = agents.filter(a => a.state === 'working').length
    setProceduralBgmWorkloadIntensity(Math.min(1, working / online.length))
  }, [agents])

  useEffect(() => {
    cachedAgents = agents
  }, [agents])

  useEffect(() => {
    cachedAgentIdMap = new Map(agentIdMapRef.current)
    cachedNextCharacterId = nextIdRef.current.current
  }, [agents])

  useEffect(() => {
    cachedPrevAgentStates = new Map(prevAgentStatesRef.current)
  }, [agents])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('openclaw-logo-drag-start'))
    return () => {
      window.dispatchEvent(new CustomEvent('openclaw-logo-drag-stop'))
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (!canvasRef.current || !officeRef.current || !containerRef.current) return
    const canvas = canvasRef.current
    const office = officeRef.current
    const container = containerRef.current
    const editor = editorRef.current
    let lastTime = 0

    const render = (time: number) => {
      const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      const width = container.clientWidth
      const height = container.clientHeight

      // Keep desktop zoom fixed. On mobile, fit the whole office into current viewport.
      if (isMobileViewport) {
        const layout = office.layout
        const rows = layout.rows
        const cols = layout.cols
        const baseW = cols * TILE_SIZE
        const topExtraTiles = MOBILE_TOP_EXTRA_TILES
        const fitW = Math.max(1, width - MOBILE_FIT_PADDING_PX * 2) / Math.max(1, baseW)
        const fitH = Math.max(1, height - MOBILE_FIT_PADDING_PX * 2) / Math.max(1, (rows + topExtraTiles) * TILE_SIZE)
        const fitZoom = Math.min(fitW, fitH)
        const nextZoom = Math.max(MOBILE_MIN_ZOOM, Math.min(MOBILE_MAX_ZOOM, fitZoom || MOBILE_CANVAS_ZOOM))
        zoomRef.current = nextZoom

        const mapH = rows * TILE_SIZE * nextZoom
        const centerOffsetY = (height - mapH) / 2
        const topExtraPx = topExtraTiles * TILE_SIZE * nextZoom
        const minPanY = MOBILE_FIT_PADDING_PX + topExtraPx - centerOffsetY
        const maxPanY = height - MOBILE_FIT_PADDING_PX - (centerOffsetY + mapH)
        const basePanY = minPanY > maxPanY ? minPanY : Math.min(maxPanY, Math.max(minPanY, 0))
        const targetPanY = Math.min(maxPanY, Math.max(minPanY - 16, basePanY + MOBILE_VIEW_NUDGE_Y_PX))
        panRef.current = { x: 0, y: Math.round(targetPanY) }
      } else {
        zoomRef.current = DESKTOP_CANVAS_ZOOM
        const layout = office.layout
        const rows = layout.rows
        const mapH = rows * TILE_SIZE * zoomRef.current
        const centerOffsetY = (height - mapH) / 2
        const topExtraPx = DESKTOP_TOP_EXTRA_TILES * TILE_SIZE * zoomRef.current
        const minPanY = topExtraPx + DESKTOP_TOP_SAFE_PADDING_PX - centerOffsetY
        const maxPanY = height - (centerOffsetY + mapH)
        const targetPanY = minPanY > maxPanY
          ? minPanY
          : Math.min(maxPanY, Math.max(minPanY, 0))
        const nextPanY = Math.round(targetPanY)
        if (panRef.current.x !== 0 || panRef.current.y !== nextPanY) {
          panRef.current = { x: 0, y: nextPanY }
        }
      }
      const dpr = window.devicePixelRatio || 1
      office.update(dt)

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        ctx.scale(dpr, dpr)

        let editorRender: EditorRenderState | undefined
        if (editor.isEditMode) {
          const sel = editor.selectedFurnitureUid
          const selItem = sel ? office.layout.furniture.find(f => f.uid === sel) : null
          const selEntry = selItem ? getCatalogEntry(selItem.type) : null
          const ghostEntry = (editor.activeTool === EditTool.FURNITURE_PLACE)
            ? getCatalogEntry(editor.selectedFurnitureType) : null
          const showGhostBorder = editor.activeTool === EditTool.TILE_PAINT ||
            editor.activeTool === EditTool.WALL_PAINT || editor.activeTool === EditTool.ERASE

          editorRender = {
            showGrid: true,
            ghostSprite: ghostEntry?.sprite ?? null,
            ghostCol: editor.ghostCol,
            ghostRow: editor.ghostRow,
            ghostValid: editor.ghostValid,
            selectedCol: selItem?.col ?? 0,
            selectedRow: selItem?.row ?? 0,
            selectedW: selEntry?.footprintW ?? 0,
            selectedH: selEntry?.footprintH ?? 0,
            hasSelection: !!selItem,
            isRotatable: selItem ? isRotatable(selItem.type) : false,
            deleteButtonBounds: null,
            rotateButtonBounds: null,
            showGhostBorder,
            ghostBorderHoverCol: editor.ghostCol,
            ghostBorderHoverRow: editor.ghostRow,
          }
        }

        renderFrame(ctx, width, height, office.tileMap, office.furniture, office.getCharacters(),
          zoomRef.current, panRef.current.x, panRef.current.y,
          { selectedAgentId: null, hoveredAgentId, hoveredTile: null, seats: office.seats, characters: office.characters },
          editorRender, office.layout.tileColors, office.layout.cols, office.layout.rows,
          undefined,
          contributionsRef.current ?? undefined, photographRef.current ?? undefined,
          gatewayHealthyRef.current, officeGameId)

        // Collect photo comment positions for DOM rendering
        const zoom = zoomRef.current
        const pan = panRef.current
        const cols = office.layout.cols
        const rows = office.layout.rows
        const mapW = cols * TILE_SIZE * zoom
        const mapH = rows * TILE_SIZE * zoom
        const ox = (width - mapW) / 2 + pan.x
        const oy = (height - mapH) / 2 + pan.y
        const containerTop = container.offsetTop
        const lifetime = 4.0
        const items: Array<{ key: string; text: string; x: number; y: number; opacity: number }> = []
        const codeItems: Array<{ key: string; text: string; x: number; y: number; opacity: number; kind?: 'default' | 'sre' }> = []
        const workingCharIds = new Set<number>()
        for (const a of agents) {
          if (a.state !== 'working') continue
          const cid = agentIdMapRef.current.get(a.agentId)
          if (typeof cid === 'number') workingCharIds.add(cid)
        }
        for (const ch of office.getCharacters()) {
          if (ch.photoComments.length === 0) continue
          const anchorX = ox + ch.x * zoom
          const anchorY = containerTop + oy + (ch.y - 24) * zoom
          const totalDist = anchorY + 20
          for (let i = 0; i < ch.photoComments.length; i++) {
            const pc = ch.photoComments[i]
            const progress = pc.age / lifetime
            let alpha = 1.0
            if (pc.age < 0.3) alpha = pc.age / 0.3
            if (progress > 0.6) alpha = (1 - progress) / 0.4
            const floatY = progress * totalDist
            items.push({
              key: `${ch.id}-${i}-${pc.text}`,
              text: pc.text,
              x: anchorX + pc.x * zoom,
              y: anchorY - floatY,
              opacity: Math.max(0, alpha * 0.95),
            })
          }
        }
        for (const ch of office.getCharacters()) {
          const isSreBlackword =
            ch.systemRoleType === 'gateway_sre' &&
            ch.systemStatus === 'down' &&
            ch.state === 'idle'
          const hasInjectedSnippet = ch.codeSnippets.length > 0
          if (!workingCharIds.has(ch.id) && !isSreBlackword && !hasInjectedSnippet) continue
          if (ch.codeSnippets.length === 0) continue
          const anchorX = ox + ch.x * zoom
          const anchorY = containerTop + oy + (ch.y - (isSreBlackword ? 24 : 10)) * zoom
          const totalDist = isSreBlackword
            ? Math.min(anchorY + 24, SRE_BLACKWORD_MAX_FLOAT_DIST_PX)
            : (anchorY + 24)
          for (let i = 0; i < ch.codeSnippets.length; i++) {
            const s = ch.codeSnippets[i]
            const progress = s.age / CODE_SNIPPET_LIFETIME_SEC
            if (progress <= 0 || progress >= 1) continue
            const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.88 ? (1 - progress) / 0.12 : 1
            codeItems.push({
              key: `${ch.id}-code-${i}-${s.text}`,
              text: s.text,
              x: anchorX + s.x * zoom,
              y: anchorY - progress * totalDist,
              opacity: Math.max(0, alpha * 0.9),
              kind: isSreBlackword ? 'sre' : 'default',
            })
          }
        }
        floatingCommentsRef.current = items
        floatingCodeRef.current = codeItems
        const hasFloating = items.length > 0 || codeItems.length > 0
        const now = performance.now()
        const tickInterval = hasFloating
          ? (isMobileViewport ? FLOATING_TICK_INTERVAL_MOBILE_MS : FLOATING_TICK_INTERVAL_DESKTOP_MS)
          : 180
        if (now - floatingTickUpdatedAtRef.current >= tickInterval) {
          floatingTickUpdatedAtRef.current = now
          setFloatingTick(t => t + 1)
        }
      }
      animationFrameIdRef.current = requestAnimationFrame(render)
    }
    animationFrameIdRef.current = requestAnimationFrame(render)
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current)
    }
  }, [hoveredAgentId, editorTick, officeReady, agents, isMobileViewport])

  // Load GitHub contribution heatmap data (real → fallback mock)
  useEffect(() => {
    // 先设置 mock 保证立即有内容
    const mockWeeks = Array.from({ length: 52 }, () => ({
      days: Array.from({ length: 7 }, () => ({
        count: Math.random() < 0.25 ? 0 : Math.floor(Math.random() * 12),
        date: '',
      })),
    }))
    contributionsRef.current = { weeks: mockWeeks, username: 'mock' }

    // 异步拉取真实数据
    fetch('/api/pixel-office/contributions')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.weeks) {
          contributionsRef.current = data
        }
      })
      .catch(() => {})
  }, [])

  // 经典 = 原版墙画 webp；星舰/林间 = games/*/photograph.png，失败再回退 webp
  useEffect(() => {
    const img = new Image()
    photographRef.current = null
    img.onload = () => { photographRef.current = img }
    if (officeGameId === 'classic') {
      img.onerror = () => { photographRef.current = null }
      img.src = '/assets/pixel-office/photograph.webp'
    } else {
      img.onerror = () => {
        img.onerror = null
        img.onload = () => { photographRef.current = img }
        img.src = '/assets/pixel-office/photograph.webp'
      }
      img.src = `/assets/pixel-office/games/${officeGameId}/photograph.png`
    }
  }, [officeGameId])

  // Preload activity heatmap data
  useEffect(() => {
    fetch('/api/activity-heatmap')
      .then(r => r.json())
      .then(data => { if (data.agents) activityHeatmapRef.current = data.agents })
      .catch(() => {})
  }, [])

  // Preload version info
  useEffect(() => {
    void fetchVersionInfo()
  }, [fetchVersionInfo])

  // Preload idle rank data
  useEffect(() => {
    fetch('/api/pixel-office/idle-rank')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.agents) idleRankRef.current = data.agents })
      .catch(() => {})
  }, [])

  // Poll for agent activity + sound notification
  useEffect(() => {
    if (cachedAgents.length > 0) {
      setAgents(cachedAgents)
      if (officeRef.current && officeReadyRef.current) {
        syncAgentsToOffice(cachedAgents, officeRef.current, agentIdMapRef.current, nextIdRef.current)
      }
    }
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agent-activity', { cache: 'no-store' })
        const data = await res.json()
        const newAgents: AgentActivity[] = data.agents || []
        setAgents(newAgents)
        cachedAgents = newAgents

        const office = officeRef.current
        if (office && officeReadyRef.current) {
          syncAgentsToOffice(newAgents, office, agentIdMapRef.current, nextIdRef.current)
          cachedAgentIdMap = new Map(agentIdMapRef.current)
          cachedNextCharacterId = nextIdRef.current.current

          const seen = seenSubagentEventKeysRef.current
          const now = Date.now()
          for (const [key, ts] of seen.entries()) {
            if (now - ts > 24 * 60 * 60 * 1000) seen.delete(key)
          }
          for (const agent of newAgents) {
            const parentCharId = agentIdMapRef.current.get(agent.agentId)
            if (typeof parentCharId !== 'number') continue
            if (!agent.subagents?.length) continue
            for (const sub of agent.subagents) {
              if (!sub.activityEvents?.length) continue
              const subKey = sub.sessionKey ? `${sub.sessionKey}::${sub.toolId}` : sub.toolId
              const subCharId = office.getSubagentId(parentCharId, subKey)
              if (subCharId == null) continue

              const orderedEvents = (sub.activityEvents || []).slice().sort((a, b) => a.at - b.at)
              let emittedNew = false
              for (const event of orderedEvents) {
                const uniq = `${agent.agentId}:${subKey}:${event.key}`
                if (seen.has(uniq)) continue
                seen.set(uniq, now)
                office.pushCodeSnippet(subCharId, event.text)
                emittedNew = true
              }

              // Fallback: if no parsed activity events yet, show subagent task label once.
              if (!emittedNew && orderedEvents.length === 0 && sub.label) {
                const fallbackUniq = `${agent.agentId}:${subKey}:label`
                if (!seen.has(fallbackUniq)) {
                  seen.set(fallbackUniq, now)
                  office.pushCodeSnippet(subCharId, `task: ${sub.label}`)
                }
              }
            }
          }
        }

        // Play sound when agent transitions to waiting
        for (const agent of newAgents) {
          const prev = prevAgentStatesRef.current.get(agent.agentId)
          if (agent.state === 'waiting' && prev && prev !== 'waiting') {
            playDoneSound()
          }
          // Broadcast notification on meaningful state transitions
          if (prev && prev !== agent.state) {
            if (agent.state === 'working' && prev !== 'working') {
              const bid = Date.now() + Math.random()
              setBroadcasts(b => [...b, { id: bid, emoji: agent.emoji, text: `${agent.emoji} ${agent.name} ${t('pixelOffice.broadcast.online')}` }])
              setTimeout(() => setBroadcasts(b => b.filter(x => x.id !== bid)), 5000)
            } else if (agent.state === 'offline' && prev === 'working') {
              const bid = Date.now() + Math.random()
              setBroadcasts(b => [...b, { id: bid, emoji: agent.emoji, text: `${agent.emoji} ${agent.name} ${t('pixelOffice.broadcast.offline')}` }])
              setTimeout(() => setBroadcasts(b => b.filter(x => x.id !== bid)), 5000)
            }
          }
        }
        const stateMap = new Map<string, string>()
        for (const a of newAgents) stateMap.set(a.agentId, a.state)
        prevAgentStatesRef.current = stateMap
        cachedPrevAgentStates = new Map(stateMap)
      } catch (e) {
        console.error('Failed to fetch agents:', e)
      }
    }
    fetchAgents()
    const interval = setInterval(fetchAgents, AGENT_ACTIVITY_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Poll agent session stats from /api/config
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/config')
        const data = await res.json()
        const map = new Map<string, { sessionCount: number; messageCount: number; totalTokens: number; todayAvgResponseMs: number; weeklyResponseMs: number[]; weeklyTokens: number[]; lastActive: number | null }>()
        const configMap = new Map<string, ConfigAgentCard>()
        for (const agent of (data.agents || [])) {
          configMap.set(agent.id, {
            id: agent.id,
            name: formatAgentDisplayName(agent.name || agent.id, agent.id),
            emoji: agent.emoji || '🤖',
            model: agent.model || '',
            platforms: Array.isArray(agent.platforms) ? agent.platforms : [],
            session: agent.session || undefined,
          })
          if (agent.session) {
            map.set(agent.id, {
              sessionCount: agent.session.sessionCount || 0,
              messageCount: agent.session.messageCount || 0,
              totalTokens: agent.session.totalTokens || 0,
              todayAvgResponseMs: agent.session.todayAvgResponseMs || 0,
              weeklyResponseMs: agent.session.weeklyResponseMs || [],
              weeklyTokens: agent.session.weeklyTokens || [],
              lastActive: agent.session.lastActive || null,
            })
          }
        }
        agentStatsRef.current = map
        configAgentsRef.current = configMap
        if (data.gateway) gatewayRef.current = { port: data.gateway.port || 18789, token: data.gateway.token, host: data.gateway.host }
        if (data.providers) {
          providersRef.current = data.providers
          const accessModeMap: Record<string, 'auth' | 'api_key'> = {}
          for (const provider of data.providers) {
            if (provider?.id && (provider.accessMode === 'auth' || provider.accessMode === 'api_key')) {
              accessModeMap[provider.id] = provider.accessMode
            }
          }
          providerAccessModeRef.current = accessModeMap
        }
      } catch {}
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // Poll gateway health for server alarm lamp in Pixel Office
  useEffect(() => {
    void refreshGatewayHealthSnapshot()
    const interval = setInterval(refreshGatewayHealthSnapshot, GATEWAY_HEALTH_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshGatewayHealthSnapshot])

  useEffect(() => {
    if (!selectedAgentId) return
    try {
      const modelRaw = localStorage.getItem('agentTestResults')
      setCachedModelTestResults(modelRaw ? JSON.parse(modelRaw) : null)
    } catch {
      setCachedModelTestResults(null)
    }
    try {
      const platformRaw = localStorage.getItem('platformTestResults')
      setCachedPlatformTestResults(platformRaw ? JSON.parse(platformRaw) : null)
    } catch {
      setCachedPlatformTestResults(null)
    }
    try {
      const sessionRaw = localStorage.getItem('sessionTestResults')
      setCachedSessionTestResults(sessionRaw ? JSON.parse(sessionRaw) : null)
    } catch {
      setCachedSessionTestResults(null)
    }
    try {
      const dmRaw = localStorage.getItem('dmSessionResults')
      setCachedDmSessionResults(dmRaw ? JSON.parse(dmRaw) : null)
    } catch {
      setCachedDmSessionResults(null)
    }
  }, [selectedAgentId])

  // Keep gateway SRE head label aligned with current locale.
  useEffect(() => {
    if (!officeReady) return
    const office = officeRef.current
    if (!office) return
    const info = office.getGatewaySreInfo()
    if (!info) return
    const ch = office.characters.get(info.id)
    if (ch) ch.label = t('pixelOffice.gatewaySre.name')
  }, [officeReady, t])

  // ── Editor helpers ──────────────────────────────────────────
  const applyEdit = useCallback((newLayout: OfficeLayout) => {
    const office = officeRef.current
    const editor = editorRef.current
    if (!office) return
    if (newLayout === office.layout) return
    editor.pushUndo(office.layout)
    editor.clearRedo()
    editor.isDirty = true
    office.rebuildFromLayout(newLayout, undefined, officeGameIdRef.current)
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleUndo = useCallback(() => {
    const office = officeRef.current
    const editor = editorRef.current
    if (!office) return
    const prev = editor.popUndo()
    if (!prev) return
    editor.pushRedo(office.layout)
    office.rebuildFromLayout(prev, undefined, officeGameIdRef.current)
    editor.isDirty = true
    editor.clearSelection()
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleRedo = useCallback(() => {
    const office = officeRef.current
    const editor = editorRef.current
    if (!office) return
    const next = editor.popRedo()
    if (!next) return
    editor.pushUndo(office.layout)
    office.rebuildFromLayout(next, undefined, officeGameIdRef.current)
    editor.isDirty = true
    editor.clearSelection()
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleSave = useCallback(async () => {
    const office = officeRef.current
    const editor = editorRef.current
    if (!office) return
    try {
      await fetch('/api/pixel-office/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: office.layout, game: officeGameIdRef.current }),
      })
      savedLayoutRef.current = office.layout
      editor.isDirty = false
      forceEditorUpdate()
    } catch (e) {
      console.error('Failed to save layout:', e)
    }
  }, [forceEditorUpdate])

  const handleReset = useCallback(() => {
    const office = officeRef.current
    const editor = editorRef.current
    if (!office) return
    const defaultLayout = savedLayoutRef.current || createDefaultLayoutForGame(officeGameIdRef.current)
    editor.pushUndo(office.layout)
    editor.clearRedo()
    office.rebuildFromLayout(defaultLayout, undefined, officeGameIdRef.current)
    editor.isDirty = false
    editor.clearSelection()
    forceEditorUpdate()
  }, [forceEditorUpdate])

  // ── Mouse events ──────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !officeRef.current) return
    const office = officeRef.current
    const editor = editorRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const { col, row, worldX, worldY } = mouseToTile(e.clientX, e.clientY, canvasRef.current, office, zoomRef.current, panRef.current)

    if (editor.isEditMode) {
      if (serverTooltip.open) setServerTooltip((prev) => ({ ...prev, open: false }))
      // Update ghost preview
      if (editor.activeTool === EditTool.FURNITURE_PLACE) {
        const entry = getCatalogEntry(editor.selectedFurnitureType)
        if (entry) {
          const placementRow = entry.canPlaceOnWalls ? getWallPlacementRow(editor.selectedFurnitureType, row) : row
          editor.ghostCol = col
          editor.ghostRow = placementRow
          editor.ghostValid = canPlaceFurniture(office.layout, editor.selectedFurnitureType, col, placementRow)
        }
      } else if (editor.activeTool === EditTool.TILE_PAINT || editor.activeTool === EditTool.WALL_PAINT || editor.activeTool === EditTool.ERASE) {
        editor.ghostCol = col
        editor.ghostRow = row
        // Drag painting
        if (editor.isDragging && col >= 0 && col < office.layout.cols && row >= 0 && row < office.layout.rows) {
          if (editor.activeTool === EditTool.TILE_PAINT) {
            applyEdit(paintTile(office.layout, col, row, editor.selectedTileType, editor.floorColor))
          } else if (editor.activeTool === EditTool.WALL_PAINT) {
            const currentTile = office.layout.tiles[row * office.layout.cols + col]
            if (editor.wallDragAdding === null) {
              editor.wallDragAdding = currentTile !== TileType.WALL
            }
            if (editor.wallDragAdding && currentTile !== TileType.WALL) {
              applyEdit(paintTile(office.layout, col, row, TileType.WALL, editor.wallColor))
            } else if (!editor.wallDragAdding && currentTile === TileType.WALL) {
              applyEdit(paintTile(office.layout, col, row, TileType.FLOOR_1, editor.floorColor))
            }
          } else if (editor.activeTool === EditTool.ERASE) {
            applyEdit(paintTile(office.layout, col, row, TileType.VOID as TileTypeVal))
          }
        }
      } else {
        editor.ghostCol = col
        editor.ghostRow = row
      }

      // Drag-to-move furniture
      if (editor.dragUid) {
        const dx = col - editor.dragStartCol
        const dy = row - editor.dragStartRow
        if (!editor.isDragMoving && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
          editor.isDragMoving = true
        }
        if (editor.isDragMoving) {
          const newCol = col - editor.dragOffsetCol
          const newRow = row - editor.dragOffsetRow
          const newLayout = moveFurniture(office.layout, editor.dragUid, newCol, newRow)
          if (newLayout !== office.layout) {
            office.rebuildFromLayout(newLayout, undefined, officeGameIdRef.current)
            editor.isDirty = true
          }
        }
      }
    } else {
      // Normal mode: hover detection
      const id = office.getCharacterAt(worldX, worldY)
      const lobsterId = office.getFirstLobsterAt(worldX, worldY)
      setHoveredAgentId(id)
      // Pointer cursor on camera furniture
      const tileX = worldX / TILE_SIZE
      const tileY = worldY / TILE_SIZE
      const onCamera = office.layout.furniture.some(f => {
        if (f.type !== 'camera') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onPC = office.layout.furniture.some(f => {
        if (f.type !== 'pc') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onLibrary = office.layout.furniture.some(f => {
        if (f.uid !== 'library-r') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onWhiteboard = office.layout.furniture.some(f => {
        if (f.uid !== 'whiteboard-r') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onClock = office.layout.furniture.some(f => {
        if (f.uid !== 'clock-r') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onPhone = office.layout.furniture.some(f => {
        if (f.type !== 'phone') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onSofa = office.layout.furniture.some(f => {
        if (f.type !== 'sofa') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onServer = office.layout.furniture.some(f => {
        if (f.uid !== 'server-b-left' && f.type !== 'server_rack') return false
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return tileX >= f.col && tileX < f.col + entry.footprintW &&
               tileY >= f.row && tileY < f.row + entry.footprintH
      })
      const onPhoto = photographRef.current && tileX >= 10 && tileX < 17 && tileY >= -0.5 && tileY < 1
      const onHeatmap = contributionsRef.current && contributionsRef.current.username !== 'mock' && tileX >= 1 && tileX < 10 && tileY >= -0.5 && tileY < 1
      if (canvasRef.current) canvasRef.current.style.cursor = (onCamera || onPC || onLibrary || onWhiteboard || onClock || onPhone || onSofa || onServer || id !== null || lobsterId !== null || onPhoto || onHeatmap) ? 'pointer' : 'default'
    }
  }

  const PHOTO_COUNT = 13
  const handleMouseDown = (e: React.MouseEvent) => {
    unlockAudio()
    if (soundOn) void playBackgroundMusic()
    if (!canvasRef.current || !officeRef.current) return
    const office = officeRef.current
    const editor = editorRef.current
    if (!editor.isEditMode) {
      // Non-edit mode: check camera click or character click
      if (e.button === 0) {
        setSubagentCreatorInfo(null)
        const rect = canvasRef.current.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const { worldX, worldY } = mouseToTile(e.clientX, e.clientY, canvasRef.current, office, zoomRef.current, panRef.current)
        const tileX = worldX / TILE_SIZE
        const tileY = worldY / TILE_SIZE
        const clickedServer = office.layout.furniture.some(f => {
          if (f.uid !== 'server-b-left' && f.type !== 'server_rack') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })
        if (!clickedServer && serverTooltip.open) {
          setServerTooltip((prev) => ({ ...prev, open: false }))
        }
        const clickedCamera = office.layout.furniture.find(f => {
          if (f.type !== 'camera') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })
        if (clickedCamera) {
          const idx = Math.floor(Math.random() * PHOTO_COUNT) + 1
          const img = new Image()
          img.src = `/assets/pixel-office/my-photographic-works/${idx}.webp`
          img.onload = () => { photographRef.current = img }
        } else if (office.layout.furniture.some(f => {
          if (f.type !== 'pc') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on PC — open gateway chat for main agent
          const gw = gatewayRef.current
          const sessionKey = 'agent:main:main'
          let chatUrl = buildGatewayUrl(gw.port, '/chat', { session: sessionKey }, gw.host)
          if (gw.token) chatUrl = buildGatewayUrl(gw.port, '/chat', { session: sessionKey, token: gw.token }, gw.host)
          window.open(chatUrl, '_blank')
        } else if (office.layout.furniture.some(f => {
          if (f.uid !== 'library-r') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on right bookshelf — show model panel
          modelPanelOpenedAtRef.current = performance.now()
          setShowModelPanel(true)
        } else if (office.layout.furniture.some(f => {
          if (f.uid !== 'whiteboard-r') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on right whiteboard — show token ranking
          tokenRankOpenedAtRef.current = performance.now()
          setShowTokenRank(true)
        } else if (office.layout.furniture.some(f => {
          if (f.uid !== 'clock-r') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on clock — show activity heatmap
          setShowActivityHeatmap(true)
          if (!activityHeatmapRef.current) {
            fetch('/api/activity-heatmap')
              .then(r => r.json())
              .then(data => { if (data.agents) activityHeatmapRef.current = data.agents })
              .catch(() => {})
          }
        } else if (office.layout.furniture.some(f => {
          if (f.type !== 'phone') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on phone — show version info
          setShowPhonePanel(true)
          void fetchVersionInfo(true)
        } else if (office.layout.furniture.some(f => {
          if (f.type !== 'sofa') return false
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return tileX >= f.col && tileX < f.col + entry.footprintW &&
                 tileY >= f.row && tileY < f.row + entry.footprintH
        })) {
          // Click on sofa — show idle rank
          setShowIdleRank(true)
        } else if (clickedServer) {
          // Click on server rack — show tooltip and refresh latest status
          setServerTooltip({ open: true, x: clickX, y: clickY })
          void refreshGatewayHealthSnapshot()
        } else if (photographRef.current && tileX >= 10 && tileX < 17 && tileY >= -0.5 && tileY < 1) {
          // Click on wall photograph — fullscreen view
          fullscreenPhotoOpenedAtRef.current = performance.now()
          setFullscreenPhoto(true)
        } else if (contributionsRef.current && contributionsRef.current.username !== 'mock' && tileX >= 1 && tileX < 10 && tileY >= -0.5 && tileY < 1) {
          // Click on GitHub contribution heatmap — open profile
          window.open(`https://github.com/${contributionsRef.current.username}`, '_blank')
        } else if (office.getFirstLobsterAt(worldX, worldY) !== null) {
          // Click on first lobster — toggle rage mode
          office.toggleFirstLobsterRage()
        } else {
          // Check character click
          const charId = office.getCharacterAt(worldX, worldY)
          if (charId !== null) {
            const map = agentIdMapRef.current
            let found = false
            for (const [aid, cid] of map.entries()) {
              if (cid === charId) {
                selectedAgentOpenedAtRef.current = performance.now()
                setSelectedAgentId(aid)
                found = true
                break
              }
            }
            if (!found) {
              const clickedCh = office.characters.get(charId)
              if (clickedCh?.systemRoleType === 'gateway_sre' && isMobileViewport) {
                setServerTooltip({ open: true, x: clickX, y: clickY })
                void refreshGatewayHealthSnapshot()
              } else if (clickedCh?.isSubagent && clickedCh.parentAgentId != null) {
                let parentAgentId: string | null = null
                for (const [aid, cid] of map.entries()) {
                  if (cid === clickedCh.parentAgentId) {
                    parentAgentId = aid
                    break
                  }
                }
                if (parentAgentId && isMobileViewport) {
                  setSubagentCreatorInfo({
                    parentAgentId,
                    x: clickX,
                    y: clickY,
                  })
                }
              }
              setSelectedAgentId(null)
            }
          } else {
            setSelectedAgentId(null)
          }
        }
      }
      return
    }
    const { col, row } = mouseToTile(e.clientX, e.clientY, canvasRef.current, office, zoomRef.current, panRef.current)

    if (e.button === 0) {
      // Left click
      const tool = editor.activeTool
      if (tool === EditTool.TILE_PAINT || tool === EditTool.WALL_PAINT || tool === EditTool.ERASE) {
        editor.isDragging = true
        editor.wallDragAdding = null

        // Check ghost border expansion
        const dir = getGhostBorderDirection(col, row, office.layout.cols, office.layout.rows)
        if (dir) {
          const result = expandLayout(office.layout, dir)
          if (result) {
            applyEdit(result.layout)
            office.rebuildFromLayout(result.layout, result.shift, officeGameIdRef.current)
          }
          return
        }

        if (col >= 0 && col < office.layout.cols && row >= 0 && row < office.layout.rows) {
          if (tool === EditTool.TILE_PAINT) {
            applyEdit(paintTile(office.layout, col, row, editor.selectedTileType, editor.floorColor))
          } else if (tool === EditTool.WALL_PAINT) {
            const currentTile = office.layout.tiles[row * office.layout.cols + col]
            editor.wallDragAdding = currentTile !== TileType.WALL
            if (editor.wallDragAdding) {
              applyEdit(paintTile(office.layout, col, row, TileType.WALL, editor.wallColor))
            } else {
              applyEdit(paintTile(office.layout, col, row, TileType.FLOOR_1, editor.floorColor))
            }
          } else if (tool === EditTool.ERASE) {
            applyEdit(paintTile(office.layout, col, row, TileType.VOID as TileTypeVal))
          }
        }
      } else if (tool === EditTool.FURNITURE_PLACE) {
        if (editor.ghostValid && col >= 0) {
          const entry = getCatalogEntry(editor.selectedFurnitureType)
          if (entry) {
            const placementRow = entry.canPlaceOnWalls ? getWallPlacementRow(editor.selectedFurnitureType, row) : row
            const uid = `furn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const item = {
              uid, type: editor.selectedFurnitureType, col, row: placementRow,
              ...(editor.pickedFurnitureColor ? { color: editor.pickedFurnitureColor } : {}),
            }
            applyEdit(placeFurniture(office.layout, item))
          }
        }
      } else if (tool === EditTool.SELECT) {
        // Check if clicking on placed furniture
        const clickedItem = office.layout.furniture.find(f => {
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return col >= f.col && col < f.col + entry.footprintW && row >= f.row && row < f.row + entry.footprintH
        })
        if (clickedItem) {
          editor.selectedFurnitureUid = clickedItem.uid
          editor.startDrag(clickedItem.uid, col, row, col - clickedItem.col, row - clickedItem.row)
        } else {
          editor.clearSelection()
        }
        forceEditorUpdate()
      } else if (tool === EditTool.EYEDROPPER) {
        if (col >= 0 && col < office.layout.cols && row >= 0 && row < office.layout.rows) {
          const idx = row * office.layout.cols + col
          const tile = office.layout.tiles[idx]
          if (tile !== TileType.WALL && tile !== TileType.VOID) {
            editor.selectedTileType = tile
            const color = office.layout.tileColors?.[idx]
            if (color) editor.floorColor = { ...color }
          } else if (tile === TileType.WALL) {
            const color = office.layout.tileColors?.[idx]
            if (color) editor.wallColor = { ...color }
            editor.activeTool = EditTool.WALL_PAINT
          }
          editor.activeTool = editor.activeTool === EditTool.EYEDROPPER ? EditTool.TILE_PAINT : editor.activeTool
          forceEditorUpdate()
        }
      } else if (tool === EditTool.FURNITURE_PICK) {
        const pickedItem = office.layout.furniture.find(f => {
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return col >= f.col && col < f.col + entry.footprintW && row >= f.row && row < f.row + entry.footprintH
        })
        if (pickedItem) {
          editor.selectedFurnitureType = pickedItem.type
          editor.pickedFurnitureColor = pickedItem.color ? { ...pickedItem.color } : null
          editor.activeTool = EditTool.FURNITURE_PLACE
          forceEditorUpdate()
        }
      }
    }
  }

  const handleMouseUp = () => {
    const editor = editorRef.current
    if (editor.isDragging) {
      editor.isDragging = false
      editor.wallDragAdding = null
    }
    if (editor.dragUid) {
      if (editor.isDragMoving) {
        // Commit the drag move to undo stack
        editor.isDirty = true
        forceEditorUpdate()
      }
      editor.clearDrag()
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    const editor = editorRef.current
    if (!editor.isEditMode) return
    e.preventDefault()
    if (!canvasRef.current || !officeRef.current) return
    const office = officeRef.current
    const { col, row } = mouseToTile(e.clientX, e.clientY, canvasRef.current, office, zoomRef.current, panRef.current)
    if (col >= 0 && col < office.layout.cols && row >= 0 && row < office.layout.rows) {
      applyEdit(paintTile(office.layout, col, row, TileType.VOID as TileTypeVal))
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return
    e.preventDefault()
    handleMouseMove({ clientX: e.clientX, clientY: e.clientY, button: 0 } as React.MouseEvent)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return
    e.preventDefault()
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
    handleMouseDown({ clientX: e.clientX, clientY: e.clientY, button: 0 } as React.MouseEvent)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return
    e.preventDefault()
    handleMouseUp()
  }

  // ── Keyboard events ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const editor = editorRef.current
      const office = officeRef.current
      if (!editor.isEditMode || !office) return

      if (e.key === 'r' || e.key === 'R') {
        if (editor.selectedFurnitureUid) {
          applyEdit(rotateFurniture(office.layout, editor.selectedFurnitureUid, e.shiftKey ? 'ccw' : 'cw'))
        }
      } else if (e.key === 't' || e.key === 'T') {
        if (editor.selectedFurnitureUid) {
          applyEdit(toggleFurnitureState(office.layout, editor.selectedFurnitureUid))
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selectedFurnitureUid) {
          applyEdit(removeFurniture(office.layout, editor.selectedFurnitureUid))
          editor.clearSelection()
          forceEditorUpdate()
        }
      } else if (e.key === 'Escape') {
        // Multi-stage escape
        if (editor.activeTool === EditTool.FURNITURE_PICK) {
          editor.activeTool = EditTool.FURNITURE_PLACE
        } else if (editor.selectedFurnitureUid) {
          editor.clearSelection()
        } else if (editor.activeTool !== EditTool.SELECT) {
          editor.activeTool = EditTool.SELECT
        } else {
          editor.isEditMode = false
          setIsEditMode(false)
        }
        forceEditorUpdate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyEdit, handleUndo, handleRedo, forceEditorUpdate])

  // Esc closes modal overlays in non-edit mode for keyboard accessibility.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isEditMode) return
      if (fullscreenPhoto) {
        setFullscreenPhoto(false)
        return
      }
      if (showIdleRank) {
        setShowIdleRank(false)
        return
      }
      if (showPhonePanel) {
        setShowPhonePanel(false)
        return
      }
      if (showActivityHeatmap) {
        setShowActivityHeatmap(false)
        return
      }
      if (showTokenRank) {
        setShowTokenRank(false)
        return
      }
      if (showModelPanel) {
        setShowModelPanel(false)
        return
      }
      if (subagentCreatorInfo) {
        setSubagentCreatorInfo(null)
        return
      }
      if (selectedAgentId) {
        setSelectedAgentId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreenPhoto, isEditMode, selectedAgentId, showActivityHeatmap, showIdleRank, showModelPanel, showPhonePanel, showTokenRank, subagentCreatorInfo])

  // ── Editor toolbar callbacks ──────────────────────────────────
  const handleToolChange = useCallback((tool: EditTool) => {
    editorRef.current.activeTool = tool
    editorRef.current.clearSelection()
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleTileTypeChange = useCallback((type: TileTypeVal) => {
    editorRef.current.selectedTileType = type
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleFloorColorChange = useCallback((color: FloorColor) => {
    editorRef.current.floorColor = color
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleWallColorChange = useCallback((color: FloorColor) => {
    editorRef.current.wallColor = color
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleFurnitureTypeChange = useCallback((type: string) => {
    editorRef.current.selectedFurnitureType = type
    forceEditorUpdate()
  }, [forceEditorUpdate])

  const handleSelectedFurnitureColorChange = useCallback((color: FloorColor | null) => {
    const editor = editorRef.current
    const office = officeRef.current
    if (!office || !editor.selectedFurnitureUid) return
    const newLayout = {
      ...office.layout,
      furniture: office.layout.furniture.map(f =>
        f.uid === editor.selectedFurnitureUid ? { ...f, color: color ?? undefined } : f
      ),
    }
    applyEdit(newLayout)
  }, [applyEdit])

  const toggleEditMode = useCallback(() => {
    const editor = editorRef.current
    editor.isEditMode = !editor.isEditMode
    if (!editor.isEditMode) {
      editor.reset()
    }
    setIsEditMode(editor.isEditMode)
  }, [])

  const toggleSound = useCallback(() => {
    const newVal = !isSoundEnabled()
    setSoundEnabled(newVal)
    setSoundOn(newVal)
    localStorage.setItem('pixel-office-sound', String(newVal))
    if (newVal) {
      void playBackgroundMusic()
    } else {
      stopBackgroundMusic()
    }
  }, [])

  const resetView = useCallback(() => {
    zoomRef.current = isMobileViewport ? MOBILE_CANVAS_ZOOM : DESKTOP_CANVAS_ZOOM
    panRef.current = { x: 0, y: 0 }
  }, [isMobileViewport])

  const switchOfficeGame = useCallback(
    async (next: OfficeGameId) => {
      if (next === officeGameIdRef.current) return
      const office = officeRef.current
      const editor = editorRef.current
      if (!office || !officeReadyRef.current) return
      const prev = officeGameIdRef.current
      try {
        await fetch('/api/pixel-office/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: office.layout, game: prev }),
        })
      } catch {
        /* ignore autosave errors */
      }
      try {
        localStorage.setItem(OFFICE_GAME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      await applyPixelAssetPackForGame(next)
      officeGameIdRef.current = next
      setOfficeGameId(next)
      let layout: OfficeLayout
      try {
        const res = await fetch(`/api/pixel-office/layout?game=${encodeURIComponent(next)}`)
        const data = await res.json()
        layout =
          data.layout && !isSavedThemeLayoutStale(next, data.layout)
            ? migrateLayoutColors(data.layout)
            : createDefaultLayoutForGame(next)
      } catch {
        layout = createDefaultLayoutForGame(next)
      }
      office.rebuildFromLayout(layout, undefined, next)
      savedLayoutRef.current = layout
      editor.undoStack = []
      editor.redoStack = []
      editor.isDirty = false
      editor.clearSelection()
      editor.clearDrag()
      syncAgentsToOffice(cachedAgents, office, agentIdMapRef.current, nextIdRef.current)
      zoomRef.current = isMobileViewport ? MOBILE_CANVAS_ZOOM : DESKTOP_CANVAS_ZOOM
      panRef.current = { x: 0, y: 0 }
      forceEditorUpdate()
    },
    [forceEditorUpdate, isMobileViewport],
  )

  // ── Hovered agent tooltip data ──────────────────────────────
  const getHoveredAgentInfo = useCallback(() => {
    if (hoveredAgentId === null) return null
    const map = agentIdMapRef.current
    let agentId: string | null = null
    for (const [aid, cid] of map.entries()) {
      if (cid === hoveredAgentId) { agentId = aid; break }
    }
    if (agentId) {
      const agent = agents.find(a => a.agentId === agentId)
      const stats = agentStatsRef.current.get(agentId)
      return { kind: 'agent' as const, agent, stats, isSubagent: false as const, parentAgentId: null as string | null }
    }

    const hoveredCharacter = officeRef.current?.characters.get(hoveredAgentId)
    if (hoveredCharacter?.isSubagent && hoveredCharacter.parentAgentId != null) {
      let parentAgentId: string | null = null
      for (const [aid, cid] of map.entries()) {
        if (cid === hoveredCharacter.parentAgentId) { parentAgentId = aid; break }
      }
      if (!parentAgentId) return null
      const parentAgent = agents.find(a => a.agentId === parentAgentId)
      if (!parentAgent) return null
      return {
        kind: 'subagent' as const,
        agent: parentAgent,
        stats: agentStatsRef.current.get(parentAgentId),
        isSubagent: true as const,
        parentAgentId,
      }
    }

    const gatewaySre = officeRef.current?.getGatewaySreInfo()
    if (gatewaySre && gatewaySre.id === hoveredAgentId) {
      return { kind: 'gatewaySre' as const, gatewaySre }
    }
    return null
  }, [hoveredAgentId, agents])

  const hoveredInfo = getHoveredAgentInfo()

  const editor = editorRef.current
  const selectedItem = editor.selectedFurnitureUid
    ? officeRef.current?.layout.furniture.find(f => f.uid === editor.selectedFurnitureUid) : null
  const modalOverlayClass = isMobileViewport
    ? "absolute inset-0 z-20 flex items-end justify-center bg-black/50"
    : "absolute inset-0 z-20 flex items-center justify-center bg-black/40"
  const modalPanelClass = (desktopWidth = "w-80", maxHeight = "max-h-[80%]") =>
    isMobileViewport
      ? `w-full ${maxHeight} overflow-y-auto rounded-t-2xl border-x border-t border-[var(--border)] bg-[var(--card)] shadow-2xl p-4 pb-6`
      : `${desktopWidth} ${maxHeight} overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-4`
  const displayAgents = useMemo<AgentActivity[]>(() => {
    const expanded: AgentActivity[] = []
    for (const agent of agents) {
      expanded.push(agent)
      if (!agent.subagents?.length) continue
      for (const sub of agent.subagents) {
        const subKey = sub.sessionKey ? `${sub.sessionKey}::${sub.toolId}` : sub.toolId
        expanded.push({
          agentId: `subagent:${agent.agentId}:${subKey}`,
          name: `${t('pixelOffice.tempWorker')} ${agent.agentId}`,
          emoji: agent.emoji,
          state: 'working',
          lastActive: agent.lastActive,
        })
      }
    }
    return expanded
  }, [agents])

  const mobileAgentPages: AgentActivity[][] = []
  for (let i = 0; i < displayAgents.length; i += 9) {
    mobileAgentPages.push(displayAgents.slice(i, i + 9))
  }
  const renderAgentChip = (agent: AgentActivity, mobileGrid = false) => {
    const isTempWorker = agent.agentId.startsWith('subagent:')
    const parentAgentIdFromKey = isTempWorker ? (agent.agentId.split(':')[1] || '') : ''
    const tempWorkerOwner = isTempWorker ? (agent.name.replace(new RegExp(`^${t('pixelOffice.tempWorker')}\\s*`), '') || parentAgentIdFromKey) : ''
    const chipTooltip = isTempWorker
      ? `${tempWorkerOwner} ${t('pixelOffice.tempWorker.createdBy')}`
      : `agent id：${agent.agentId}`
    const chipToneClass = isTempWorker
      ? 'bg-red-900/45 border-red-700/80 text-red-100 animate-pulse'
      : (
        agent.state === 'working' ? `pixel-agent-chip-working${isMobileViewport ? '' : ' animate-pulse'}` :
        agent.state === 'idle' ? `pixel-agent-chip-idle${isMobileViewport ? '' : ' animate-pulse'}` :
        'pixel-agent-chip-neutral'
      )
    return (
      <div key={agent.agentId} className="group relative overflow-visible">
        <div className={`pixel-agent-chip inline-flex h-8 items-center overflow-hidden rounded-lg border transition-colors ${
          mobileGrid ? 'w-full min-w-0 gap-1.5 px-2 py-1.5' : 'shrink-0 gap-2 px-3 py-1.5'
        } ${chipToneClass}`}
          title={chipTooltip}
          aria-label={chipTooltip}
          {...(agent.state === 'working'
            ? { style: { animationDuration: isTempWorker ? '0.9s' : '1.3s' } }
            : {})}
        >
          <span className={mobileGrid ? 'shrink-0 text-sm' : ''}>{agent.emoji}</span>
          {isTempWorker ? (
            <span className={`min-w-0 flex flex-col justify-center ${mobileGrid ? 'max-w-[4.6rem]' : 'max-w-[5.8rem]'} leading-none`}>
              <span className={`${mobileGrid ? 'text-[10px]' : 'text-[12px]'} truncate`}>{t('pixelOffice.tempWorker')}</span>
              <span className={`${mobileGrid ? 'text-[10px]' : 'text-[12px]'} truncate`}>{tempWorkerOwner}</span>
            </span>
          ) : (
            <span className={mobileGrid ? 'min-w-0 text-xs truncate' : 'text-sm'}>{agent.name}</span>
          )}
          {agent.state === 'working' && <span className={`pixel-agent-chip-state uppercase tracking-wider ${mobileGrid ? 'text-[9px] truncate' : 'text-[10px]'} ${isTempWorker ? 'text-red-100' : 'text-green-200'}`}>{t('pixelOffice.state.working')}</span>}
          {agent.state === 'idle' && <span className={`pixel-agent-chip-state uppercase tracking-wider ${mobileGrid ? 'text-[9px] truncate' : 'text-[10px]'}`}>{t('pixelOffice.state.idle')}</span>}
          {agent.state === 'offline' && <span className={`pixel-agent-chip-state uppercase tracking-wider ${mobileGrid ? 'text-[9px] truncate' : 'text-[10px]'}`}>{t('pixelOffice.state.offline')}</span>}
          {agent.state === 'waiting' && <span className={`pixel-agent-chip-state uppercase tracking-wider ${mobileGrid ? 'text-[9px] truncate' : 'text-[10px]'}`}>{t('pixelOffice.state.waiting')}</span>}
        </div>
        {!isMobileViewport && (
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--card)]/95 px-2 py-1 text-[11px] text-[var(--text)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
            {chipTooltip}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col overflow-hidden h-[calc(100dvh-3.5rem)] md:h-full">
      {/* Floating photo comment DOM bubbles */}
      {floatingCommentsRef.current.map(fc => (
        <div key={fc.key} className="absolute pointer-events-none z-30 whitespace-nowrap"
          style={{
            left: 0,
            top: 0,
            opacity: fc.opacity,
            transform: `translate3d(${fc.x}px, ${fc.y}px, 0) translateX(-50%)`,
            willChange: 'transform, opacity',
          }}>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)', color: '#FFD700' }}>
            {fc.text}
          </span>
        </div>
      ))}
      {/* Floating code snippets (working agents): rise to top, overlay top bar — 悬停可看说明 */}
      {floatingCodeRef.current.map(fc => {
        const themedFloat = officeGameId === 'starship' || officeGameId === 'grove'
        const codeBg =
          fc.kind === 'sre'
            ? 'rgba(28,6,6,0.9)'
            : officeGameId === 'starship'
              ? 'rgba(15,23,42,0.93)'
              : officeGameId === 'grove'
                ? 'rgba(6,26,18,0.93)'
                : 'rgba(0,0,0,0.72)'
        const codeColor =
          fc.kind === 'sre'
            ? '#DC2626'
            : officeGameId === 'starship'
              ? '#7dd3fc'
              : officeGameId === 'grove'
                ? '#86efac'
                : '#4ade80'
        const codeBorder =
          fc.kind === 'sre'
            ? '1px solid rgba(127,29,29,0.85)'
            : officeGameId === 'starship'
              ? '1px solid rgba(56,189,248,0.55)'
              : officeGameId === 'grove'
                ? '1px solid rgba(52,211,153,0.5)'
                : '1px solid transparent'
        const codeShadow =
          fc.kind === 'sre'
            ? undefined
            : themedFloat
              ? officeGameId === 'starship'
                ? '0 0 16px rgba(56,189,248,0.22), inset 0 1px 0 rgba(125,211,252,0.35)'
                : '0 0 16px rgba(52,211,153,0.18), inset 0 1px 0 rgba(134,239,172,0.3)'
              : undefined
        return (
          <div
            key={fc.key}
            className="absolute pointer-events-none z-40 max-w-[min(280px,72vw)]"
            style={{
              left: 0,
              top: 0,
              opacity: fc.opacity,
              transform: `translate3d(${fc.x}px, ${fc.y}px, 0) translateX(-50%)`,
              willChange: 'transform, opacity',
            }}
            title={t('pixelOffice.floatingCode.tooltip')}
          >
            <span
              className="inline-block w-full px-2 py-1 rounded-md text-xs sm:text-sm font-mono font-semibold leading-snug break-words text-center"
              style={{
                backgroundColor: codeBg,
                color: codeColor,
                border: codeBorder,
                boxShadow: codeShadow,
              }}
            >
              {fc.text}
            </span>
          </div>
        )
      })}
      {/* Top bar: agent tags + controls */}
      <div className={`flex flex-col gap-2 p-3 md:p-4 transition-colors duration-300 ${getOfficeGameTopBarClass(officeGameId)}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-[var(--text)]">{t('pixelOffice.title')}</span>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[var(--text-muted)] shrink-0">
              <span className="hidden sm:inline whitespace-nowrap">{t('pixelOffice.gameScene')}</span>
              <span className="sm:hidden" aria-hidden>
                🎮
              </span>
              <select
                value={officeGameId}
                onChange={(e) => void switchOfficeGame(parseOfficeGameId(e.target.value))}
                className="max-w-[6.5rem] sm:max-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-[10px] sm:text-xs text-[var(--text)]"
                title={t('pixelOffice.gameScene')}
              >
                {OFFICE_GAME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`pixelOffice.game.${id}`)}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={toggleSound}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                soundOn ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-muted)]'
              }`}>
              {soundOn ? '🔔' : '🔕'} {t('pixelOffice.sound')}
            </button>
            {soundOn && (
              <button onClick={skipToNextTrack}
                className="px-3 py-1.5 text-xs rounded-lg border transition-colors bg-[var(--card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]"
                title={officeGameId === 'classic' ? '下一首' : '换一段（本场景为实时合成配乐）'}>
                ⏭
              </button>
            )}
            <button onClick={toggleEditMode}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                isEditMode ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-muted)]'
              }`}>
              {isEditMode ? t('pixelOffice.exitEdit') : t('pixelOffice.editMode')}
            </button>
          </div>
        </div>
        <div className="md:hidden overflow-x-auto pb-1">
          {displayAgents.length === 0 ? (
            <div className="text-[var(--text-muted)] text-sm">{t('common.noData')}</div>
          ) : (
            <div className="flex gap-2 min-w-full snap-x snap-mandatory">
              {mobileAgentPages.map((page, pageIndex) => (
                <div key={`mobile-agent-page-${pageIndex}`} className="grid grid-cols-3 grid-rows-3 gap-2 min-w-full h-[8.4rem] shrink-0 snap-start">
                  {page.map((agent) => renderAgentChip(agent, true))}
                  {page.length < 9 && Array.from({ length: 9 - page.length }).map((_, i) => (
                    <div key={`mobile-agent-page-${pageIndex}-placeholder-${i}`} className="rounded-lg border border-transparent" />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hidden md:flex gap-2 flex-1 flex-wrap">
          {displayAgents.map((agent) => renderAgentChip(agent))}
          {displayAgents.length === 0 && (
            <div className="text-[var(--text-muted)] text-sm">{t('common.noData')}</div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden transition-[background] duration-500 ${getOfficeGameCanvasBackdropClass(officeGameId)}`}
      >
        {officeGameId === 'starship' && <StarshipStarfield />}
        <canvas ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={handleContextMenu}
          className={`relative z-10 w-full h-full max-w-full max-h-full [image-rendering:pixelated] transition-shadow duration-500 ${getOfficeGameCanvasFrameClass(officeGameId)}`}
          style={{ touchAction: 'none' }} />
        {!officeReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a2e]/85 pointer-events-none">
            <div className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text-muted)]">
              {t('common.loading')}
            </div>
          </div>
        )}

        {/* Broadcast notifications */}
        {broadcasts.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-2 pointer-events-none">
            {broadcasts.map(b => (
              <div key={b.id} className="px-4 py-2 rounded-full bg-black/70 text-white text-sm font-medium backdrop-blur-sm shadow-lg whitespace-nowrap"
                style={{ animation: 'broadcastIn 0.3s ease-out, broadcastOut 0.5s ease-in 4.5s forwards' }}>
                {b.text}
              </div>
            ))}
          </div>
        )}
        <style>{`
          @keyframes broadcastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes broadcastOut { from { opacity: 1; } to { opacity: 0; transform: translateY(-8px); } }
        `}</style>

        {/* Reset view button */}
        <button onClick={resetView}
          className="absolute top-3 right-3 px-2 py-1.5 text-xs rounded-lg border bg-[var(--card)]/80 border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors backdrop-blur-sm"
          title={t('pixelOffice.resetView')}>
          ⊡
        </button>

        {/* Agent hover tooltip */}
        {hoveredInfo && !isEditMode && !selectedAgentId && !isMobileViewport && (
          <div className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm text-xs shadow-lg"
            style={{ left: Math.min(mousePosRef.current.x + 12, (containerRef.current?.clientWidth || 300) - 180), top: mousePosRef.current.y + 12 }}>
            {hoveredInfo.kind === 'gatewaySre' ? (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span>🧯</span>
                  <span className="font-semibold text-[var(--text)]">{t('pixelOffice.gatewaySre.name')}</span>
                </div>
                <div className="space-y-0.5 text-[var(--text-muted)]">
                  <div className="flex justify-between gap-4">
                    <span>{t('pixelOffice.gatewaySre.statusLabel')}</span>
                    <span className="text-[var(--text)]">{t(`pixelOffice.gatewaySre.status.${hoveredInfo.gatewaySre.status}`)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{t('pixelOffice.gatewaySre.responseMs')}</span>
                    <span className="text-[var(--text)]">{hoveredInfo.gatewaySre.responseMs != null ? `${hoveredInfo.gatewaySre.responseMs}ms` : '--'}</span>
                  </div>
                  {hoveredInfo.gatewaySre.error && (
                    <div className="text-red-300">{hoveredInfo.gatewaySre.error}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span>{hoveredInfo.agent?.emoji}</span>
                  <span className="font-semibold text-[var(--text)]">{hoveredInfo.isSubagent ? t('pixelOffice.tempWorker') : hoveredInfo.agent?.name}</span>
                </div>
                {hoveredInfo.isSubagent ? (
                  <div className="text-[var(--text-muted)]">
                    {(hoveredInfo.parentAgentId || 'unknown')} {t('pixelOffice.tempWorker.createdBy')}
                  </div>
                ) : (
                  <div className="space-y-0.5 text-[var(--text-muted)]">
                    <div className="flex justify-between gap-4"><span>{t('agent.sessionCount')}</span><span className="text-[var(--text)]">{hoveredInfo.stats?.sessionCount ?? '--'}</span></div>
                    <div className="flex justify-between gap-4"><span>{t('agent.messageCount')}</span><span className="text-[var(--text)]">{hoveredInfo.stats?.messageCount ?? '--'}</span></div>
                    <div className="flex justify-between gap-4"><span>{t('agent.tokenUsage')}</span><span className="text-[var(--text)]">{hoveredInfo.stats ? formatTokens(hoveredInfo.stats.totalTokens) : '--'}</span></div>
                    <div className="flex justify-between gap-4"><span>{t('agent.todayAvgResponse')}</span><span className="text-[var(--text)]">{hoveredInfo.stats?.todayAvgResponseMs ? `${(hoveredInfo.stats.todayAvgResponseMs / 1000).toFixed(1)}s` : '--'}</span></div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Server click tooltip */}
        {serverTooltip.open && !isEditMode && !selectedAgentId && (() => {
          const snapshot = gatewaySreRef.current
          const status = snapshot.status === 'healthy' || snapshot.status === 'degraded' || snapshot.status === 'down'
            ? snapshot.status
            : 'unknown'
          const statusColor =
            status === 'healthy' ? 'text-green-400'
            : status === 'degraded' ? 'text-yellow-400'
            : status === 'down' ? 'text-red-400'
            : 'text-[var(--text-muted)]'
          const tooltipLeft = Math.max(8, Math.min(serverTooltip.x + 12, (containerRef.current?.clientWidth || 300) - (isMobileViewport ? 220 : 200)))
          const tooltipTop = Math.max(8, serverTooltip.y + 12)
          return (
            <div
              className="absolute pointer-events-auto z-10 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm text-xs shadow-lg"
              style={{ left: tooltipLeft, top: tooltipTop }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-1.5 top-1.5 text-[10px] leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setServerTooltip((prev) => ({ ...prev, open: false }))}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                ×
              </button>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span>🖥️</span>
                <span className="font-semibold text-[var(--text)]">Gateway Server</span>
              </div>
              <div className="space-y-0.5 text-[var(--text-muted)]">
                <div className="flex justify-between gap-4">
                  <span>{t('pixelOffice.gatewaySre.statusLabel')}</span>
                  <span className={statusColor}>{t(`pixelOffice.serverStatus.${status}`)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('pixelOffice.gatewaySre.responseMs')}</span>
                  <span className="text-[var(--text)]">{snapshot.responseMs != null ? `${snapshot.responseMs}ms` : '--'}</span>
                </div>
                {snapshot.error && (
                  <div className="text-red-300">{snapshot.error}</div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Agent detail card (click) */}
        {selectedAgentId && !isEditMode && (() => {
          const runtimeAgent = agents.find(a => a.agentId === selectedAgentId)
          const configAgent = configAgentsRef.current.get(selectedAgentId)
          const stats = agentStatsRef.current.get(selectedAgentId) ?? configAgent?.session
          const displayState = runtimeAgent?.state || 'offline'
          const gw = gatewayRef.current

          if (!runtimeAgent && !configAgent) return null

          const cardAgent: AgentCardAgent = {
            id: selectedAgentId,
            name: configAgent?.name || runtimeAgent?.name || selectedAgentId,
            emoji: configAgent?.emoji || runtimeAgent?.emoji || '🤖',
            model: configAgent?.model || '',
            platforms: configAgent?.platforms || [],
            session: stats
              ? {
                  lastActive: stats.lastActive,
                  totalTokens: stats.totalTokens,
                  contextTokens: 0,
                  sessionCount: stats.sessionCount,
                  todayAvgResponseMs: stats.todayAvgResponseMs,
                  messageCount: stats.messageCount,
                  weeklyResponseMs: stats.weeklyResponseMs,
                  weeklyTokens: stats.weeklyTokens,
                }
              : undefined,
          }

          return (
            <div
              className={modalOverlayClass}
              onClick={() => {
                if (isMobileViewport && performance.now() - selectedAgentOpenedAtRef.current < 280) return
                setSelectedAgentId(null)
              }}
            >
              <div className={modalPanelClass("w-[24rem]", "max-h-[78%]")} onClick={e => e.stopPropagation()}>
                <div className="flex justify-end mb-2">
                  <button onClick={() => setSelectedAgentId(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
                </div>
                <AgentCard
                  agent={cardAgent}
                  gatewayPort={gw.port}
                  gatewayToken={gw.token}
                  gatewayHost={gw.host}
                  t={t}
                  testResult={cachedModelTestResults?.[selectedAgentId]}
                  platformTestResults={cachedPlatformTestResults || undefined}
                  sessionTestResult={cachedSessionTestResults?.[selectedAgentId]}
                  agentState={displayState}
                  dmSessionResults={cachedDmSessionResults || undefined}
                  providerAccessModeMap={providerAccessModeRef.current}
                />
              </div>
            </div>
          )
        })()}

        {/* Mobile subagent creator tooltip */}
        {subagentCreatorInfo && !isEditMode && isMobileViewport && (() => {
          const tooltipLeft = Math.max(8, Math.min(subagentCreatorInfo.x + 12, (containerRef.current?.clientWidth || 300) - 220))
          const tooltipTop = Math.max(8, subagentCreatorInfo.y + 12)
          return (
            <div
              className="absolute pointer-events-auto z-10 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm text-xs shadow-lg"
              style={{ left: tooltipLeft, top: tooltipTop }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-1.5 top-1.5 text-[10px] leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setSubagentCreatorInfo(null)}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                ×
              </button>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span>🧑‍🔧</span>
                <span className="font-semibold text-[var(--text)]">{t('pixelOffice.tempWorker.source')}</span>
              </div>
              <div className="space-y-0.5 text-[var(--text-muted)]">
                <div>{subagentCreatorInfo.parentAgentId} {t('pixelOffice.tempWorker.createdBy')}</div>
              </div>
            </div>
          )
        })()}

        {/* Model panel (bookshelf click) */}
        {showModelPanel && !isEditMode && (
          <div
            className={modalOverlayClass}
            onClick={() => {
              if (isMobileViewport && performance.now() - modelPanelOpenedAtRef.current < 280) return
              setShowModelPanel(false)
            }}
          >
            <div className={modalPanelClass("w-80")} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[var(--text)]">📚 {t('models.title')}</span>
                <button onClick={() => setShowModelPanel(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
              </div>
              {providersRef.current.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)]">{t('common.noData')}</div>
              ) : (
                <div className="space-y-3">
                  {providersRef.current.map(provider => (
                    <div key={provider.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[var(--accent)]">{provider.id}</span>
                        {provider.usedBy.length > 0 && (
                          <div className="flex gap-1">
                            {provider.usedBy.map(a => (
                              <span key={a.id} className="text-sm" title={a.name}>{a.emoji}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {provider.models.map(model => (
                          <div key={model.id} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text)] truncate mr-2">🧠 {model.name || model.id}</span>
                            {model.contextWindow && <span className="text-[var(--text-muted)] whitespace-nowrap">{formatTokens(model.contextWindow)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Token ranking panel (whiteboard click) */}
        {showTokenRank && !isEditMode && (() => {
          const ranked = agents
            .map(a => ({ ...a, tokens: agentStatsRef.current.get(a.agentId)?.totalTokens || 0 }))
            .sort((a, b) => b.tokens - a.tokens)
          const maxTokens = ranked[0]?.tokens || 1
          const handleCloseTokenRankOverlay = () => {
            // Prevent the opening tap from immediately closing the modal on mobile.
            if (isMobileViewport && performance.now() - tokenRankOpenedAtRef.current < 280) return
            setShowTokenRank(false)
          }
          return (
            <div className={modalOverlayClass} onClick={handleCloseTokenRankOverlay}>
              <div className={modalPanelClass("w-80", "max-h-[78%]")} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-[var(--text)]">📊 {t('agent.tokenUsage')}</span>
                  <button onClick={() => setShowTokenRank(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
                </div>
                {ranked.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)]">{t('common.noData')}</div>
                ) : (
                  <div className="space-y-2">
                    {ranked.map((a, i) => (
                      <div key={a.agentId}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[var(--text-muted)] w-4">{i + 1}.</span>
                            <span>{a.emoji}</span>
                            <span className="text-[var(--text)]">{a.name}</span>
                          </span>
                          <span className="text-[var(--text)] font-mono">{formatTokens(a.tokens)}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(a.tokens / maxTokens) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Activity heatmap panel (clock click) */}
        {showActivityHeatmap && !isEditMode && (() => {
          const agentGrids = activityHeatmapRef.current
          const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21]
          const cellSize = 14
          const gap = 2
          const leftPad = 36
          const topPad = 20
          const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
          const svgW = leftPad + 24 * (cellSize + gap)
          const svgH = topPad + 7 * (cellSize + gap)
          return (
            <div className={modalOverlayClass} onClick={() => setShowActivityHeatmap(false)}>
              <div className={modalPanelClass("w-fit max-w-[94vw]", "max-h-[85%]")} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-[var(--text)]">🕐 {t('pixelOffice.heatmap.title')}</span>
                  <button onClick={() => setShowActivityHeatmap(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
                </div>
                {!agentGrids ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.loading')}</div>
                ) : agentGrids.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.noData')}</div>
                ) : (
                  <div className="space-y-4">
                    {agentGrids.map(({ agentId, grid }) => {
                      const agent = agents.find(a => a.agentId === agentId)
                      let maxVal = 1
                      for (const row of grid) for (const v of row) if (v > maxVal) maxVal = v
                      return (
                        <div key={agentId}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span>{agent?.emoji || '🤖'}</span>
                            <span className="text-xs font-semibold text-[var(--text)]">{agent?.name || agentId}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <svg width={svgW} height={svgH} className="block min-w-max">
                              {hourLabels.map(h => (
                                <text key={h} x={leftPad + h * (cellSize + gap) + cellSize / 2} y={topPad - 6} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{h}</text>
                              ))}
                              {dayLabels.map((label, d) => (
                                <text key={d} x={leftPad - 4} y={topPad + d * (cellSize + gap) + cellSize / 2 + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">{label}</text>
                              ))}
                              {grid.map((row, d) => row.map((v, h) => {
                                const level = v === 0 ? 0 : Math.min(4, Math.ceil((v / maxVal) * 4))
                                return (
                                  <rect key={`${d}-${h}`} x={leftPad + h * (cellSize + gap)} y={topPad + d * (cellSize + gap)}
                                    width={cellSize} height={cellSize} rx={2} fill={colors[level]} opacity={0.9}>
                                    <title>{`${dayLabels[d]} ${h}:00 — ${v} ${t('pixelOffice.heatmap.messages')}`}</title>
                                  </rect>
                                )
                              }))}
                            </svg>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Phone panel — version info */}
        {showPhonePanel && !isEditMode && (() => {
          const info = versionInfo
          return (
            <div className={modalOverlayClass} onClick={() => setShowPhonePanel(false)}>
              <div className={modalPanelClass("w-80")} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-[var(--text)]">📱 OpenClaw Latest</span>
                  <button onClick={() => setShowPhonePanel(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
                </div>
                {!info && versionLoading ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.loading')}</div>
                ) : !info && versionLoadFailed ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.loadError')}</div>
                ) : !info ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.noData')}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--accent)]">{info.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{new Date(info.publishedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-[var(--text)] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{info.body}</div>
                    <a href={info.htmlUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-center text-xs text-[var(--accent)] hover:underline">
                      View on GitHub →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Idle rank panel (sofa click) */}
        {showIdleRank && !isEditMode && (() => {
          const rankData = idleRankRef.current
          const ranked = rankData
            ? [...rankData].sort((a, b) => b.idlePercent - a.idlePercent).map(r => {
                const agent = agents.find(a => a.agentId === r.agentId)
                return { ...r, emoji: agent?.emoji || '🤖', name: agent?.name || r.agentId }
              })
            : null
          return (
            <div className={modalOverlayClass} onClick={() => setShowIdleRank(false)}>
              <div className={modalPanelClass("w-80")} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-[var(--text)]">🛋️ {t('pixelOffice.idleRank.title')}</span>
                  <button onClick={() => setShowIdleRank(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
                </div>
                {!ranked || ranked.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)] py-8 text-center">{t('common.noData')}</div>
                ) : (
                  <div className="space-y-2.5">
                    {ranked.map((a, i) => {
                      const barColor = a.idlePercent >= 60 ? '#4ade80' : a.idlePercent >= 30 ? '#f59e0b' : '#f87171'
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                      return (
                        <div key={a.agentId}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 text-center">{medal}</span>
                              <span>{a.emoji}</span>
                              <span className="text-[var(--text)]">{a.name}</span>
                            </span>
                            <span className="font-mono font-semibold" style={{ color: barColor }}>{a.idlePercent}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${a.idlePercent}%`, backgroundColor: barColor }} />
                          </div>
                          <div className="flex gap-3 text-[10px] text-[var(--text-muted)] mt-0.5">
                            <span>{t('pixelOffice.idleRank.online')} {a.onlineMinutes}m</span>
                            <span>{t('pixelOffice.idleRank.active')} {a.activeMinutes}m</span>
                            <span>{t('pixelOffice.idleRank.idle')} {a.idleMinutes}m</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Fullscreen photograph viewer */}
        {fullscreenPhoto && photographRef.current && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 cursor-pointer"
            onClick={() => {
              if (isMobileViewport && performance.now() - fullscreenPhotoOpenedAtRef.current < 280) return
              setFullscreenPhoto(false)
            }}
          >
            <img src={photographRef.current.src} alt="photograph" className="max-w-[90%] max-h-[90%] object-contain rounded-lg shadow-2xl" />
            <button onClick={() => setFullscreenPhoto(false)} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none">×</button>
          </div>
        )}

        {/* Editor overlays */}
        {isEditMode && (
          <>
            <EditActionBar
              isDirty={editor.isDirty}
              canUndo={editor.undoStack.length > 0}
              canRedo={editor.redoStack.length > 0}
              onUndo={handleUndo} onRedo={handleRedo}
              onSave={handleSave} onReset={handleReset} />
            <EditorToolbar
              activeTool={editor.activeTool}
              selectedTileType={editor.selectedTileType}
              selectedFurnitureType={editor.selectedFurnitureType}
              selectedFurnitureUid={editor.selectedFurnitureUid}
              selectedFurnitureColor={selectedItem?.color ?? null}
              floorColor={editor.floorColor}
              wallColor={editor.wallColor}
              onToolChange={handleToolChange}
              onTileTypeChange={handleTileTypeChange}
              onFloorColorChange={handleFloorColorChange}
              onWallColorChange={handleWallColorChange}
              onSelectedFurnitureColorChange={handleSelectedFurnitureColorChange}
              onFurnitureTypeChange={handleFurnitureTypeChange}
              onDeleteFurniture={() => {
                const office = officeRef.current
                const editor = editorRef.current
                if (!office || !editor.selectedFurnitureUid) return
                applyEdit(removeFurniture(office.layout, editor.selectedFurnitureUid))
                editor.clearSelection()
                forceEditorUpdate()
              }} />
          </>
        )}
      </div>
    </div>
  )
}
