/**
 * 星舰 / 林间 背景音乐：Web Audio 实时合成。
 * - 乐句有起落（铺垫 → 对峙 → 爆发 → 回落），抑扬顿挫。
 * - 专家处于 working 时节奏加快、鼓点加密、滤波打开，偏战斗/紧迫风格。
 */

export type ProceduralBgmTheme = 'starship' | 'grove'

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let seqTimer: ReturnType<typeof setInterval> | null = null
let activeTheme: ProceduralBgmTheme | null = null
let variationSeed = 0

let droneNodes: OscillatorNode[] = []
let padNodes: OscillatorNode[] = []

/** 0 = 无人奋战，1 = 全力输出；由页面按 working 比例写入 */
let workloadTarget = 0
let workloadSmoothed = 0

const MASTER_BASE = 0.13
const STEPS_PER_BAR = 16
const BARS_PER_PHRASE = 8
const PHRASE_STEPS = STEPS_PER_BAR * BARS_PER_PHRASE

let noiseBuffer: AudioBuffer | null = null

export function setProceduralBgmWorkloadIntensity(intensity01: number): void {
  const t = Number(intensity01)
  workloadTarget = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
}

function ensureCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const len = Math.floor(ctx.sampleRate * 0.35)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

function connectMaster(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -26
    comp.knee.value = 8
    comp.ratio.value = 3.2
    comp.attack.value = 0.003
    comp.release.value = 0.18
    masterGain = ctx.createGain()
    masterGain.gain.value = MASTER_BASE
    masterGain.connect(comp)
    comp.connect(ctx.destination)
  }
  return masterGain
}

function stopDrone(): void {
  for (const o of droneNodes) {
    try {
      o.stop()
      o.disconnect()
    } catch {
      /* noop */
    }
  }
  droneNodes = []
}

function stopPad(): void {
  for (const o of padNodes) {
    try {
      o.stop()
      o.disconnect()
    } catch {
      /* noop */
    }
  }
  padNodes = []
}

export function stopProceduralBgm(): void {
  if (seqTimer !== null) {
    clearInterval(seqTimer)
    seqTimer = null
  }
  stopDrone()
  stopPad()
  activeTheme = null
}

export function skipProceduralVariation(): void {
  const t = activeTheme
  if (!t) return
  variationSeed = (variationSeed + 9973 + Math.floor(Math.random() * 9999)) % 1_000_000
  stopProceduralBgm()
  void startProceduralBgm(t)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    let t = (a = (a + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 乐句内动态：0=沉，1=顶；与 workload 相乘得到最终能量 */
function phraseDynamics(phraseStep: number): number {
  const s = phraseStep % PHRASE_STEPS
  const bar = Math.floor(s / STEPS_PER_BAR)
  // 0-1 铺垫，2-3 爬升，4-5 对峙（略收），6-7 爆发
  if (bar <= 1) return 0.35 + (bar + (s % STEPS_PER_BAR) / STEPS_PER_BAR) * 0.12
  if (bar <= 3) return 0.55 + ((s % (STEPS_PER_BAR * 2)) / (STEPS_PER_BAR * 2)) * 0.25
  if (bar <= 5) return 0.62 + Math.sin(s * 0.35) * 0.08
  return 0.78 + Math.sin(s * 0.5) * 0.22
}

function playKick(ctx: AudioContext, master: GainNode, t0: number, vel: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const g = ctx.createGain()
  osc.frequency.setValueAtTime(185, t0)
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.09)
  g.gain.setValueAtTime(0.001, t0)
  g.gain.linearRampToValueAtTime(0.22 * vel, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + 0.22)
}

function playSnare(ctx: AudioContext, master: GainNode, t0: number, vel: number): void {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200
  bp.Q.value = 0.9
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.001, t0)
  g.gain.linearRampToValueAtTime(0.14 * vel, t0 + 0.002)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11)
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t0, 0, 0.12)
}

function playHat(ctx: AudioContext, master: GainNode, t0: number, vel: number, bright: boolean): void {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = bright ? 9000 : 6500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.001, t0)
  g.gain.linearRampToValueAtTime(0.06 * vel, t0 + 0.001)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045)
  src.connect(hp)
  hp.connect(g)
  g.connect(master)
  src.start(t0, 0, 0.05)
}

function playBass(
  ctx: AudioContext,
  master: GainNode,
  t0: number,
  freq: number,
  vel: number,
  theme: ProceduralBgmTheme,
): void {
  const osc = ctx.createOscillator()
  osc.type = theme === 'starship' ? 'sawtooth' : 'triangle'
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = theme === 'starship' ? 420 : 380
  const g = ctx.createGain()
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.001, t0)
  g.gain.linearRampToValueAtTime(0.1 * vel, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22)
  osc.connect(f)
  f.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + 0.24)
}

function playArpHit(
  ctx: AudioContext,
  master: GainNode,
  t0: number,
  freq: number,
  vel: number,
  theme: ProceduralBgmTheme,
): void {
  const osc = ctx.createOscillator()
  osc.type = theme === 'starship' ? 'square' : 'triangle'
  osc.frequency.setValueAtTime(freq, t0)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = theme === 'starship' ? 2400 : 2000
  f.Q.value = 0.6
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.001, t0)
  g.gain.linearRampToValueAtTime(0.09 * vel, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + (theme === 'starship' ? 0.14 : 0.18))
  osc.connect(f)
  f.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + 0.2)
}

function startDroneAndPad(ctx: AudioContext, master: GainNode, theme: ProceduralBgmTheme, rand: () => number): void {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = theme === 'starship' ? 340 + rand() * 100 : 420 + rand() * 80
  filter.Q.value = 0.65

  if (theme === 'starship') {
    const drone = ctx.createOscillator()
    drone.type = 'sawtooth'
    drone.frequency.value = 55 + rand() * 3
    const dg = ctx.createGain()
    dg.gain.value = 0.038
    drone.connect(filter)
    filter.connect(dg)
    dg.connect(master)
    drone.start()
    droneNodes.push(drone)

    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 110
    const sg = ctx.createGain()
    sg.gain.value = 0.026
    sub.connect(sg)
    sg.connect(master)
    sub.start()
    droneNodes.push(sub)
  } else {
    const freqs = [196.0, 246.94, 293.66, 349.23]
    for (const f0 of freqs) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f0 * (0.994 + rand() * 0.012)
      const g = ctx.createGain()
      g.gain.value = 0.014 + rand() * 0.006
      osc.connect(g)
      g.connect(master)
      osc.start()
      padNodes.push(osc)
    }
  }
}

function startSequencer(ctx: AudioContext, master: GainNode, theme: ProceduralBgmTheme): void {
  const rand = mulberry32(variationSeed ^ (theme === 'grove' ? 0xface : 0xcafe))
  const roots =
    theme === 'starship'
      ? [146.83, 174.61, 196.0, 220.0, 246.94, 293.66]
      : [196.0, 220.0, 246.94, 293.66, 329.63, 349.23]

  const order = [...roots].sort(() => rand() - 0.5)
  let step = 0
  let lastTick = performance.now()
  let carryMs = 0

  // 战斗型鼓型：第 16 步为一小节
  const kickSparse = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]
  const kickWar = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0]
  const snSparse = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
  const snWar = [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1]
  const hatSparse = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
  const hatWar = [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1]

  seqTimer = setInterval(() => {
    if (!audioCtx || activeTheme !== theme) return

    const now = performance.now()
    const dt = Math.min(0.12, (now - lastTick) / 1000)
    lastTick = now

    workloadSmoothed += (workloadTarget - workloadSmoothed) * 0.14

    const baseMs = theme === 'starship' ? 118 : 128
    const fastMs = 62

    carryMs += dt * 1000

    while (carryMs > 0) {
      const phrase = phraseDynamics(step)
      const energy = Math.min(1, 0.25 + phrase * 0.55 + workloadSmoothed * 0.55)
      const war = energy
      const stepMs = baseMs - (baseMs - fastMs) * war * 0.92
      if (carryMs < stepMs) break
      carryMs -= stepMs

      const t0 = audioCtx.currentTime + 0.02
      const si = step % STEPS_PER_BAR
      const phraseStep = step % PHRASE_STEPS

      const kPat = war > 0.55 ? kickWar : kickSparse
      const sPat = war > 0.45 ? snWar : snSparse
      const hPat = war > 0.5 ? hatWar : hatSparse

      const vDrum = 0.45 + war * 0.95
      if (kPat[si]) playKick(audioCtx, master, t0, vDrum * (theme === 'grove' ? 0.85 : 1))
      if (sPat[si]) playSnare(audioCtx, master, t0, vDrum * 0.95)
      if (hPat[si]) playHat(audioCtx, master, t0, vDrum * 0.55 * (si % 2 === 0 ? 1 : 0.65), war > 0.65)

      if (war > 0.78 && si >= 12) playHat(audioCtx, master, t0 + 0.028, vDrum * 0.35, true)

      const bassEvery = war > 0.62 ? 2 : 4
      if (step % bassEvery === 0) {
        const ri = Math.floor((step / bassEvery) % order.length)
        playBass(audioCtx, master, t0, order[ri] * 0.5, (0.5 + war * 0.5) * (theme === 'grove' ? 0.9 : 1), theme)
      }

      const arpRoll = rand()
      const arpChance = 0.28 + war * 0.52
      if (arpRoll < arpChance) {
        const note = order[(step + Math.floor(war * 3)) % order.length] * (si % 4 === 0 ? 1 : 2)
        const stab = si === 0 || si === 8 || (war > 0.72 && (si === 4 || si === 12))
        playArpHit(
          audioCtx,
          master,
          t0,
          note * (stab ? 1 : 0.5),
          (stab ? 1.15 : 0.72) * (0.4 + phraseDynamics(phraseStep) * 0.6),
          theme,
        )
      }

      if (phraseStep % STEPS_PER_BAR === STEPS_PER_BAR - 1 && war > 0.6) {
        const hi = audioCtx.createOscillator()
        hi.type = 'sine'
        hi.frequency.setValueAtTime(880 * (1 + war * 0.4), t0)
        const hg = audioCtx.createGain()
        hg.gain.setValueAtTime(0.001, t0)
        hg.gain.linearRampToValueAtTime(0.04 * war, t0 + 0.02)
        hg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
        hi.connect(hg)
        hg.connect(master)
        hi.start(t0)
        hi.stop(t0 + 0.22)
      }

      if (masterGain) {
        const swell = 0.72 + energy * 0.38
        masterGain.gain.setTargetAtTime(MASTER_BASE * swell, audioCtx.currentTime, 0.08)
      }

      step++
    }
  }, 45)
}

export async function startProceduralBgm(theme: ProceduralBgmTheme): Promise<void> {
  stopProceduralBgm()
  activeTheme = theme
  workloadSmoothed = workloadTarget
  const ctx = ensureCtx()
  if (ctx.state === 'suspended') await ctx.resume()
  const master = connectMaster(ctx)
  const rand = mulberry32(variationSeed)

  startDroneAndPad(ctx, master, theme, rand)
  startSequencer(ctx, master, theme)
}

export function isProceduralBgmActive(): boolean {
  return activeTheme !== null
}
