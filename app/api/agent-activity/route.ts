import { NextResponse } from 'next/server'
import { promises as fs, existsSync } from 'fs'
import path from 'path'
import { parseJsonText } from '@/lib/json'
import { formatAgentDisplayName } from '@/lib/pixel-office/agentDisplayName'
import { OPENCLAW_AGENTS_DIR, OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from '@/lib/openclaw-paths'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const SESSION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PARENT_SESSIONS_TO_PARSE = 40
const ORPHAN_FALLBACK_WINDOW_MS = 15 * 60 * 1000
const SUBAGENT_MAX_ACTIVE_MS = 30 * 60 * 1000
const SUBAGENT_ACTIVITY_EVENT_LIMIT = 6
const SUBAGENT_ACTIVITY_TEXT_MAX_LEN = 80

type SessionsIndex = Record<string, { sessionId?: string; updatedAt?: number }>
type CronStoreJob = {
  id: string
  agentId?: string
  sessionKey?: string
  name?: string
  enabled?: boolean
  payload?: { kind?: string; message?: string; text?: string }
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastDurationMs?: number
    lastStatus?: string
    lastError?: string
    consecutiveErrors?: number
  }
}

export interface SubagentActivityEvent {
  key: string
  text: string
  at: number
}

export interface SubagentInfo {
  toolId: string
  label: string
  sessionKey?: string
  childSessionKey?: string
  activityEvents?: SubagentActivityEvent[]
}

export interface CronJobInfo {
  key: string
  jobId: string
  label: string
  isRunning: boolean
  lastRunAt: number
  nextRunAt?: number
  durationMs?: number
  lastStatus: 'success' | 'running' | 'failed'
  lastSummary?: string
  consecutiveFailures: number
}

export interface AgentActivity {
  agentId: string
  name: string
  emoji: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTool?: string
  toolStatus?: string
  lastActive: number
  subagents?: SubagentInfo[]
  cronJobs?: CronJobInfo[]
}

type AgentConfigEntry = {
  id: string
  name?: string
  emoji?: string
  identity?: { emoji?: string }
}

async function loadAgentList(config: any, agentsDir: string): Promise<AgentConfigEntry[]> {
  const configured = Array.isArray(config?.agents?.list)
    ? config.agents.list.filter((agent: any) => agent && typeof agent.id === 'string' && agent.id)
    : []
  if (configured.length > 0) return configured

  try {
    if (!existsSync(agentsDir)) return []
    const dirs = await fs.readdir(agentsDir, { withFileTypes: true })
    return dirs
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({ id: entry.name }))
  } catch {
    return []
  }
}

function isSubtaskDescription(desc: string): boolean {
  const d = desc.toLowerCase()
  return desc.startsWith('Subtask:') || desc.startsWith('子任务') || d.includes('subtask')
}

function isSpawnTool(name: string): boolean {
  return name === 'sessions_spawn' || name === 'session_spawn'
}

function pickSubagentLabel(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'Subtask'
  const args = raw as Record<string, unknown>
  if (typeof args.label === 'string' && args.label.trim()) return args.label.trim()
  if (typeof args.task === 'string' && args.task.trim()) return args.task.trim()
  if (typeof args.description === 'string' && args.description.trim()) return args.description.trim()
  return 'Subtask'
}

function extractCompletedSubagentLabel(text: string): string | null {
  if (!text) return null
  const patterns = [
    /A subagent task\s+"([^"]+)"\s+just completed/i,
    /A subagent task\s+'([^']+)'\s+just completed/i,
    /subagent task\s+"([^"]+)"\s+.*completed/i,
    /subagent task\s+'([^']+)'\s+.*completed/i,
    /子任务[“"]([^”"]+)[”"].{0,12}完成/,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

function parseRecordTimestamp(record: unknown): number {
  if (!record || typeof record !== 'object') return 0
  const rec = record as Record<string, unknown>
  if (typeof rec.timestamp === 'string') {
    const t = Date.parse(rec.timestamp)
    if (Number.isFinite(t)) return t
  }
  if (typeof rec.timestamp === 'number' && Number.isFinite(rec.timestamp)) return rec.timestamp
  const msg = rec.message
  if (msg && typeof msg === 'object') {
    const m = msg as Record<string, unknown>
    if (typeof m.timestamp === 'string') {
      const t = Date.parse(m.timestamp)
      if (Number.isFinite(t)) return t
    }
    if (typeof m.timestamp === 'number' && Number.isFinite(m.timestamp)) return m.timestamp
  }
  return 0
}

function normalizeActivityText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const compact = raw.replace(/\s+/g, ' ').trim()
  if (!compact) return null
  return compact.length > SUBAGENT_ACTIVITY_TEXT_MAX_LEN
    ? `${compact.slice(0, SUBAGENT_ACTIVITY_TEXT_MAX_LEN - 1)}…`
    : compact
}

function normalizeCronLabel(raw: unknown, fallbackKey: string): string {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/^Cron:\s*/i, '').trim() || fallbackKey
  }
  return fallbackKey
}

function truncateSummary(raw: string, maxLen = 120): string {
  const compact = raw.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLen ? `${compact.slice(0, maxLen - 1)}…` : compact
}

function resolveCronStorePath(config: any): string {
  const raw = typeof config?.cron?.store === 'string' ? config.cron.store.trim() : ''
  if (!raw) return path.join(OPENCLAW_HOME, 'cron', 'jobs.json')
  if (raw.startsWith('~')) return path.join(process.env.HOME || '', raw.slice(1))
  return path.resolve(raw)
}

async function loadCronJobs(config: any): Promise<CronStoreJob[]> {
  const storePath = resolveCronStorePath(config)
  if (!existsSync(storePath)) return []
  try {
    const raw = await fs.readFile(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.jobs) ? parsed.jobs.filter(Boolean) : []
  } catch {
    return []
  }
}

function inferCronOwnerAgentId(job: CronStoreJob): string {
  if (typeof job.agentId === 'string' && job.agentId.trim()) return job.agentId.trim()
  if (typeof job.sessionKey === 'string' && job.sessionKey.startsWith('agent:')) {
    const parts = job.sessionKey.split(':')
    if (parts[1]?.trim()) return parts[1].trim()
  }
  return 'main'
}

function deriveCronSummaryFromJob(job: CronStoreJob): string | undefined {
  const lastError = typeof job.state?.lastError === 'string' ? truncateSummary(job.state.lastError) : ''
  if (lastError) return lastError
  const payloadText =
    typeof job.payload?.message === 'string'
      ? job.payload.message
      : typeof job.payload?.text === 'string'
        ? job.payload.text
        : ''
  return payloadText ? truncateSummary(payloadText) : undefined
}

function mapCronStatus(status: string | undefined): 'success' | 'running' | 'failed' {
  const normalized = (status || '').trim().toLowerCase()
  if (normalized === 'error' || normalized === 'failed') return 'failed'
  if (normalized === 'running') return 'running'
  return 'success'
}

function inferCronStatusFromTranscript(lines: string[], updatedAt: number): {
  isRunning: boolean
  lastStatus: 'success' | 'running' | 'failed'
  lastSummary?: string
  durationMs?: number
} {
  let lastAssistantText: string | undefined
  let lastAssistantError: string | undefined
  let lastToolError: string | undefined
  let lastToolText: string | undefined
  let sawTerminalAssistant = false
  let sawToolUseWithoutResult = false
  let firstAt = 0
  let lastAt = 0

  for (const line of lines) {
    let record: any
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    const msg = record?.message
    if (!msg || typeof msg !== 'object') continue
    const at = parseRecordTimestamp(record)
    if (at > 0 && (firstAt === 0 || at < firstAt)) firstAt = at
    if (at > lastAt) lastAt = at

    if (record.type === 'message') {
      const role = typeof msg.role === 'string' ? msg.role : ''
      const blocks = Array.isArray(msg.content) ? msg.content : []

      if (role === 'assistant') {
        for (const block of blocks) {
          if (!block || typeof block !== 'object') continue
          const b = block as Record<string, unknown>
          if ((b.type === 'toolCall' || b.type === 'tool_use') && typeof b.name === 'string') {
            sawToolUseWithoutResult = true
          }
          if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
            lastAssistantText = truncateSummary(b.text)
          }
        }
        if (typeof msg.errorMessage === 'string' && msg.errorMessage.trim()) {
          lastAssistantError = truncateSummary(msg.errorMessage)
        }
        const stopReason = typeof msg.stopReason === 'string' ? msg.stopReason : ''
        if (stopReason === 'stop' || stopReason === 'error') {
          sawTerminalAssistant = true
        }
      }

      if (role === 'toolResult') {
        const details = isPlainObject(msg.details) ? msg.details : null
        const status = typeof details?.status === 'string' ? details.status : ''
        if (status.toLowerCase() === 'error' || msg.isError === true) {
          const detailError =
            typeof details?.error === 'string' && details.error.trim()
              ? details.error
              : typeof details?.aggregated === 'string' && details.aggregated.trim()
                ? details.aggregated
                : ''
          if (detailError) lastToolError = truncateSummary(detailError)
        } else {
          const detailText =
            typeof details?.aggregated === 'string' && details.aggregated.trim()
              ? details.aggregated
              : Array.isArray(msg.content)
                ? msg.content
                    .map((block: any) => (block?.type === 'text' && typeof block.text === 'string') ? block.text : '')
                    .join(' ')
                : ''
          if (detailText.trim()) lastToolText = truncateSummary(detailText)
        }
        sawToolUseWithoutResult = false
      }
    }
  }

  if (lastAssistantError || lastToolError) {
    return {
      isRunning: false,
      lastStatus: 'failed',
      lastSummary: lastAssistantError || lastToolError,
      durationMs: firstAt > 0 && lastAt >= firstAt ? lastAt - firstAt : undefined,
    }
  }

  if (sawTerminalAssistant && lastAssistantText) {
    return {
      isRunning: false,
      lastStatus: 'success',
      lastSummary: lastAssistantText,
      durationMs: firstAt > 0 && lastAt >= firstAt ? lastAt - firstAt : undefined,
    }
  }

  const recentlyUpdated = updatedAt > 0 && Date.now() - updatedAt <= 2 * 60 * 1000
  if (sawToolUseWithoutResult || recentlyUpdated) {
    return {
      isRunning: true,
      lastStatus: 'running',
      lastSummary: lastAssistantText || lastToolText,
      durationMs: firstAt > 0 ? Math.max(0, Date.now() - firstAt) : undefined,
    }
  }

  return {
    isRunning: false,
    lastStatus: lastToolText ? 'success' : 'running',
    lastSummary: lastAssistantText || lastToolText,
    durationMs: firstAt > 0 && lastAt >= firstAt ? lastAt - firstAt : undefined,
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractChildSessionKeyFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const direct = data.childSessionKey
  if (typeof direct === 'string' && direct.includes(':subagent:')) return direct

  const details = data.details
  if (details && typeof details === 'object') {
    const fromDetails = (details as Record<string, unknown>).childSessionKey
    if (typeof fromDetails === 'string' && fromDetails.includes(':subagent:')) return fromDetails
  }
  return null
}

function extractChildSessionKeyFromText(rawText: unknown): string | null {
  if (typeof rawText !== 'string' || !rawText.trim()) return null
  try {
    const parsed = JSON.parse(rawText)
    return extractChildSessionKeyFromPayload(parsed)
  } catch {
    const match = rawText.match(/agent:[^:\s]+:subagent:[a-f0-9-]+/i)
    return match ? match[0] : null
  }
}

function extractChildSessionKeyFromToolResultMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as Record<string, unknown>
  const fromPayload = extractChildSessionKeyFromPayload(msg)
  if (fromPayload) return fromPayload

  const content = msg.content
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const text = (block as Record<string, unknown>).text
    const fromText = extractChildSessionKeyFromText(text)
    if (fromText) return fromText
  }
  return null
}

function getSubagentSessionIdFromKey(sessionKey: string): string | null {
  const idx = sessionKey.indexOf(':subagent:')
  if (idx < 0) return null
  const sessionId = sessionKey.slice(idx + ':subagent:'.length).trim()
  return sessionId || null
}

function resolveSubagentSessionId(
  childSessionKey: string,
  sessionsIndex?: SessionsIndex,
): string | null {
  const fromIndex = sessionsIndex?.[childSessionKey]?.sessionId
  if (typeof fromIndex === 'string' && fromIndex.trim()) return fromIndex.trim()
  return getSubagentSessionIdFromKey(childSessionKey)
}

async function parseSubagentActivityEvents(
  agentSessionsDir: string,
  childSessionKey: string,
  sessionsIndex?: SessionsIndex,
): Promise<SubagentActivityEvent[]> {
  const sessionId = resolveSubagentSessionId(childSessionKey, sessionsIndex)
  if (!sessionId) return []
  const transcriptPath = path.join(agentSessionsDir, `${sessionId}.jsonl`)
  if (!existsSync(transcriptPath)) return []

  try {
    const content = await fs.readFile(transcriptPath, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())
    const events: SubagentActivityEvent[] = []
    for (let i = 0; i < lines.length; i++) {
      let record: any
      try {
        record = JSON.parse(lines[i])
      } catch {
        continue
      }
      if (record?.type !== 'message' || !record?.message) continue
      const at = parseRecordTimestamp(record)
      const msg = record.message
      const role = typeof msg.role === 'string' ? msg.role : ''
      const blocks = Array.isArray(msg.content) ? msg.content : []
      if (role === 'assistant') {
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]
          if (!block || typeof block !== 'object') continue
          const b = block as Record<string, unknown>

          if ((b.type === 'toolCall' || b.type === 'tool_use') && typeof b.name === 'string' && b.name) {
            events.push({
              key: `${record.id || i}:tool:${b.id || bi}`,
              text: `tool: ${b.name}`,
              at,
            })
            continue
          }

          if (b.type === 'text') {
            const normalized = normalizeActivityText(b.text)
            if (!normalized) continue
            events.push({
              key: `${record.id || i}:msg:${bi}`,
              text: normalized,
              at,
            })
          }
        }
        continue
      }

      if (role === 'toolResult') {
        const toolName = typeof msg.toolName === 'string' ? msg.toolName.trim() : ''
        const details = (msg.details && typeof msg.details === 'object')
          ? (msg.details as Record<string, unknown>)
          : null
        const status = typeof details?.status === 'string' ? details.status : ''
        if (toolName) {
          const statusTail = status ? ` (${status})` : ''
          events.push({
            key: `${record.id || i}:result:${msg.toolCallId || ''}`,
            text: `result: ${toolName}${statusTail}`,
            at,
          })
        }
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]
          if (!block || typeof block !== 'object') continue
          const normalized = normalizeActivityText((block as Record<string, unknown>).text)
          if (!normalized) continue
          events.push({
            key: `${record.id || i}:result-text:${bi}`,
            text: normalized,
            at,
          })
        }
        continue
      }

      if (role === 'user') {
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]
          if (!block || typeof block !== 'object') continue
          const normalized = normalizeActivityText((block as Record<string, unknown>).text)
          if (!normalized) continue
          events.push({
            key: `${record.id || i}:user:${bi}`,
            text: `task: ${normalized}`,
            at,
          })
        }
      }
    }

    events.sort((a, b) => a.at - b.at)
    const deduped: SubagentActivityEvent[] = []
    const recentTextAt = new Map<string, number>()
    for (const event of events) {
      const lastAt = recentTextAt.get(event.text)
      // Skip near-duplicate text emitted within 1.5s from the same subagent timeline.
      if (typeof lastAt === 'number' && Math.abs(event.at - lastAt) <= 1500) continue
      recentTextAt.set(event.text, event.at)
      deduped.push(event)
    }
    return deduped.slice(-SUBAGENT_ACTIVITY_EVENT_LIMIT)
  } catch {
    return []
  }
}

async function parseSubagentsFromSessionFile(
  agentSessionsDir: string,
  filePath: string,
  sessionKey: string,
  sessionsIndex?: SessionsIndex,
): Promise<SubagentInfo[]> {
  const subagents: SubagentInfo[] = []
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())

    const activeSubtasks = new Map<string, { label: string; at: number; childSessionKey?: string }>()
    const spawnToolIds = new Set<string>()

    for (const line of lines) {
      try {
        const record = JSON.parse(line)
        const eventAt = parseRecordTimestamp(record)

        // Legacy format
        if (record.type === 'assistant' && record.message?.content) {
          const blocks = Array.isArray(record.message.content) ? record.message.content : []
          for (const block of blocks) {
            if (block.type !== 'tool_use' || typeof block.id !== 'string' || !block.id) continue
            if (typeof block.name === 'string' && isSpawnTool(block.name)) {
              activeSubtasks.set(block.id, { label: pickSubagentLabel(block.input), at: eventAt })
              spawnToolIds.add(block.id)
              continue
            }
            if (typeof block.input?.description === 'string' && isSubtaskDescription(block.input.description)) {
              activeSubtasks.set(block.id, { label: block.input.description, at: eventAt })
            }
          }
        }
        if (record.type === 'user' && record.message?.content) {
          const blocks = Array.isArray(record.message.content) ? record.message.content : []
          for (const block of blocks) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              if (spawnToolIds.has(block.tool_use_id)) {
                const childSessionKey = extractChildSessionKeyFromToolResultMessage(block)
                if (childSessionKey && activeSubtasks.has(block.tool_use_id)) {
                  const prev = activeSubtasks.get(block.tool_use_id)!
                  activeSubtasks.set(block.tool_use_id, { ...prev, childSessionKey })
                }
                continue
              }
              activeSubtasks.delete(block.tool_use_id)
            }
          }
        }

        // New format
        if (record.type === 'message' && record.message) {
          const msg = record.message
          const role = typeof msg.role === 'string' ? msg.role : ''
          const blocks = Array.isArray(msg.content) ? msg.content : []
          if (role === 'assistant') {
            for (const block of blocks) {
              if (block?.type === 'toolCall' && typeof block.id === 'string' && block.id) {
                if (typeof block.name === 'string' && isSpawnTool(block.name)) {
                  activeSubtasks.set(block.id, { label: pickSubagentLabel(block.arguments), at: eventAt })
                  spawnToolIds.add(block.id)
                } else if (typeof block.arguments?.description === 'string' && isSubtaskDescription(block.arguments.description)) {
                  activeSubtasks.set(block.id, { label: block.arguments.description, at: eventAt })
                }
              } else if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.input?.description === 'string') {
                if (isSubtaskDescription(block.input.description)) activeSubtasks.set(block.id, { label: block.input.description, at: eventAt })
              }
            }
          } else if (role === 'toolResult') {
            const toolCallId = typeof msg.toolCallId === 'string' ? msg.toolCallId : ''
            const toolName = typeof msg.toolName === 'string' ? msg.toolName : ''
            if (toolCallId && spawnToolIds.has(toolCallId)) {
              const childSessionKey = extractChildSessionKeyFromToolResultMessage(msg)
              if (childSessionKey && activeSubtasks.has(toolCallId)) {
                const prev = activeSubtasks.get(toolCallId)!
                activeSubtasks.set(toolCallId, { ...prev, childSessionKey })
              }
              continue
            }
            if (toolCallId && !isSpawnTool(toolName) && !spawnToolIds.has(toolCallId)) {
              activeSubtasks.delete(toolCallId)
            }
          } else if (role === 'user') {
            const text = blocks
              .map((b: { type?: string; text?: string }) => (b?.type === 'text' && typeof b.text === 'string') ? b.text : '')
              .join('\n')
            const completedLabel = extractCompletedSubagentLabel(text)
            if (completedLabel) {
              for (const [id, state] of activeSubtasks.entries()) {
                if (state.label === completedLabel || state.label.includes(completedLabel) || completedLabel.includes(state.label)) {
                  activeSubtasks.delete(id)
                  break
                }
              }
            }
          }
        }
      } catch {
        // Skip bad line
      }
    }

    const now = Date.now()
    for (const [toolId, state] of activeSubtasks.entries()) {
      if (state.at > 0 && now - state.at > SUBAGENT_MAX_ACTIVE_MS) continue
      const label = state.label
      let activityEvents: SubagentActivityEvent[] | undefined
      if (state.childSessionKey) {
        activityEvents = await parseSubagentActivityEvents(agentSessionsDir, state.childSessionKey, sessionsIndex)
      }
      subagents.push({
        toolId,
        label,
        sessionKey,
        childSessionKey: state.childSessionKey,
        activityEvents: activityEvents && activityEvents.length > 0 ? activityEvents : undefined,
      })
    }
  } catch {
    // Ignore parse errors
  }
  return subagents
}

/** Parse subagents from all parent sessions (main/direct/group/openai/cron etc.), grouped by session */
async function parseSubagents(agentSessionsDir: string, agentId: string): Promise<SubagentInfo[]> {
  const allSubagents: SubagentInfo[] = []
  try {
    const cutoff = Date.now() - SESSION_LOOKBACK_MS
    const sessionFiles: Array<{ sessionKey: string; filePath: string; updatedAt: number }> = []
    const knownFilePaths = new Set<string>()
    const subagentSessionIds = new Set<string>()
    let sessionsIndex: SessionsIndex = {}
    const sessionsIndexPath = path.join(agentSessionsDir, 'sessions.json')
    if (existsSync(sessionsIndexPath)) {
      try {
        const sessionsIndexRaw = await fs.readFile(sessionsIndexPath, 'utf8')
        sessionsIndex = JSON.parse(sessionsIndexRaw) as SessionsIndex
        for (const [sessionKey, meta] of Object.entries(sessionsIndex)) {
          if (!meta || typeof meta.sessionId !== 'string' || !meta.sessionId) continue
          if (sessionKey.includes(':subagent:')) {
            subagentSessionIds.add(meta.sessionId)
            continue
          }
          const filePath = path.join(agentSessionsDir, `${meta.sessionId}.jsonl`)
          if (!existsSync(filePath)) continue
          let updatedAt = 0
          if (typeof meta.updatedAt === 'number' && meta.updatedAt > 0) {
            updatedAt = meta.updatedAt
          } else {
            try {
              const stat = await fs.stat(filePath)
              updatedAt = stat.mtimeMs
            } catch {
              updatedAt = 0
            }
          }
          if (updatedAt > 0 && updatedAt < cutoff) continue
          sessionFiles.push({ sessionKey, filePath, updatedAt })
          knownFilePaths.add(filePath)
        }
      } catch {
        // Ignore index parse errors
      }
    }

    // Fallback: include recent parent session files that are missing in sessions.json mapping.
    try {
      const orphanCutoff = Date.now() - ORPHAN_FALLBACK_WINDOW_MS
      const files = await fs.readdir(agentSessionsDir)
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        if (file.startsWith('probe-')) continue
        const filePath = path.join(agentSessionsDir, file)
        if (knownFilePaths.has(filePath)) continue
        const sessionId = file.slice(0, -'.jsonl'.length)
        if (subagentSessionIds.has(sessionId)) continue
        const stat = await fs.stat(filePath)
        if (stat.mtimeMs < orphanCutoff) continue
        if (stat.mtimeMs < cutoff) continue
        sessionFiles.push({
          sessionKey: `agent:${agentId}:orphan:${sessionId}`,
          filePath,
          updatedAt: stat.mtimeMs,
        })
      }
    } catch {
      // Ignore fallback scan errors
    }

    sessionFiles.sort((a, b) => b.updatedAt - a.updatedAt)
    const candidates = sessionFiles.slice(0, MAX_PARENT_SESSIONS_TO_PARSE)
    const nested = await Promise.all(candidates.map((s) => parseSubagentsFromSessionFile(agentSessionsDir, s.filePath, s.sessionKey, sessionsIndex)))
    const dedupe = new Set<string>()
    for (const list of nested) {
      for (const sub of list) {
        const key = `${sub.sessionKey || ''}::${sub.toolId}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        allSubagents.push(sub)
      }
    }
  } catch {
    // Ignore parse errors
  }
  return allSubagents
}

async function parseCronJobs(agentSessionsDir: string, cronJobsForAgent: CronStoreJob[]): Promise<CronJobInfo[]> {
  if (cronJobsForAgent.length === 0) return []

  const sessionsIndexPath = path.join(agentSessionsDir, 'sessions.json')
  const sessionsIndex = existsSync(sessionsIndexPath)
    ? JSON.parse(await fs.readFile(sessionsIndexPath, 'utf8')) as Record<string, any>
    : {}

  const cronJobs: CronJobInfo[] = []

  for (const job of cronJobsForAgent) {
    const entries = Object.entries(sessionsIndex)
      .filter(([sessionKey, meta]) => sessionKey.includes(`:cron:${job.id}`) && meta && typeof (meta as any).sessionId === 'string')
      .map(([sessionKey, meta]) => ({
        sessionKey,
        sessionId: (meta as any).sessionId as string,
        updatedAt: typeof (meta as any).updatedAt === 'number' ? (meta as any).updatedAt : 0,
        label: typeof (meta as any).label === 'string' ? (meta as any).label : undefined,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const latest = entries[0]
    let transcriptStatus: ReturnType<typeof inferCronStatusFromTranscript> | null = null

    if (latest) {
      const transcriptPath = path.join(agentSessionsDir, `${latest.sessionId}.jsonl`)
      if (existsSync(transcriptPath)) {
        const transcript = await fs.readFile(transcriptPath, 'utf8')
        transcriptStatus = inferCronStatusFromTranscript(transcript.split('\n').filter((line) => line.trim()), latest.updatedAt)
      }
    }

    const fallbackLabel = latest?.sessionKey?.split(':cron:')[1] || job.id
    const state = job.state || {}
    cronJobs.push({
      key: latest?.sessionKey?.includes(':run:') ? latest.sessionKey.split(':run:')[0] : latest?.sessionKey || `agent:${inferCronOwnerAgentId(job)}:cron:${job.id}`,
      jobId: job.id,
      label: normalizeCronLabel(job.name || latest?.label, fallbackLabel),
      isRunning: transcriptStatus?.isRunning || mapCronStatus(state.lastStatus) === 'running',
      lastRunAt: typeof state.lastRunAtMs === 'number' ? state.lastRunAtMs : latest?.updatedAt || 0,
      nextRunAt: typeof state.nextRunAtMs === 'number' ? state.nextRunAtMs : undefined,
      durationMs: typeof state.lastDurationMs === 'number' ? state.lastDurationMs : transcriptStatus?.durationMs,
      lastStatus: transcriptStatus?.lastStatus || mapCronStatus(state.lastStatus),
      lastSummary: transcriptStatus?.lastSummary || deriveCronSummaryFromJob(job),
      consecutiveFailures: typeof state.consecutiveErrors === 'number' ? state.consecutiveErrors : 0,
    })
  }

  cronJobs.sort((a, b) => b.lastRunAt - a.lastRunAt)
  return cronJobs
}

export async function GET() {
  const configPath = OPENCLAW_CONFIG_PATH
  const agentsDir = OPENCLAW_AGENTS_DIR

  const agents: AgentActivity[] = []

  try {
    if (existsSync(configPath)) {
      const configContent = await fs.readFile(configPath, 'utf8')
      const config = parseJsonText(configContent)

      const agentList = await loadAgentList(config, agentsDir)
      if (agentList.length > 0) {
        const now = Date.now()
        const liveCronJobs = await loadCronJobs(config)

        for (const agent of agentList) {
          let lastActive = 0
          let agentSessionsDir = ''

          if (existsSync(agentsDir)) {
            agentSessionsDir = path.join(agentsDir, agent.id, 'sessions')
            if (existsSync(agentSessionsDir)) {
              try {
                const files = await fs.readdir(agentSessionsDir)
                for (const file of files) {
                  const filePath = path.join(agentSessionsDir, file)
                  const stat = await fs.stat(filePath)
                  if (stat.mtimeMs > lastActive) {
                    lastActive = stat.mtimeMs
                  }
                }
              } catch {
                // Ignore
              }
            }
          }

          let state: 'idle' | 'working' | 'waiting' | 'offline'
          const timeDiff = now - lastActive
          if (lastActive === 0 || timeDiff > 10 * 60 * 1000) {
            state = 'offline'
          } else if (timeDiff <= 2 * 60 * 1000) {
            state = 'working'
          } else {
            state = 'idle'
          }

          // Parse subagents for online agents
          let subagents: SubagentInfo[] | undefined
          let cronJobs: CronJobInfo[] | undefined
          if (state !== 'offline' && agentSessionsDir && existsSync(agentSessionsDir)) {
            subagents = await parseSubagents(agentSessionsDir, agent.id)
            if (subagents.length === 0) subagents = undefined
            cronJobs = await parseCronJobs(
              agentSessionsDir,
              liveCronJobs.filter((job) => inferCronOwnerAgentId(job) === agent.id),
            )
            if (cronJobs.length === 0) cronJobs = undefined
          }

          agents.push({
            agentId: agent.id,
            name: formatAgentDisplayName(agent.name || agent.id, agent.id),
            emoji: agent.identity?.emoji || agent.emoji || '🤖',
            state,
            lastActive,
            subagents,
            cronJobs,
          })
        }
      }
    }
  } catch (error) {
    console.error('Error reading agent activity:', error)
  }

  return NextResponse.json(
    { agents },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } },
  )
}
