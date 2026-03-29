import {
  NOTIFICATION_NOTE_1_HZ,
  NOTIFICATION_NOTE_2_HZ,
  NOTIFICATION_NOTE_1_START_SEC,
  NOTIFICATION_NOTE_2_START_SEC,
  NOTIFICATION_NOTE_DURATION_SEC,
  NOTIFICATION_VOLUME,
} from './constants'
import type { OfficeGameId } from './gameThemes'
import { skipProceduralVariation, startProceduralBgm, stopProceduralBgm } from './proceduralBgm'

let soundEnabled = true
let audioCtx: AudioContext | null = null
let bgmAudio: HTMLAudioElement | null = null
let bgmGestureRetryBound = false
let bgmTracks: string[] = []
let bgmLastIndex = -1
let bgmTracksLoaded = false

const BGM_VOLUME = 0.28

let bgmOfficeGame: OfficeGameId = 'classic'

export function setBackgroundMusicGame(game: OfficeGameId): void {
  bgmOfficeGame = game
}

async function loadTracks(): Promise<void> {
  if (bgmTracksLoaded) return
  bgmTracksLoaded = true
  try {
    const res = await fetch('/api/pixel-office/tracks')
    const data = await res.json()
    if (Array.isArray(data.tracks) && data.tracks.length > 0) {
      bgmTracks = data.tracks
    }
  } catch {
    // fallback: keep empty, pickNextTrack handles it
  }
}

function pickNextTrack(): string {
  if (bgmTracks.length === 0) return '/assets/pixel-office/adventure.mp3'
  if (bgmTracks.length === 1) return bgmTracks[0]
  let idx: number
  do { idx = Math.floor(Math.random() * bgmTracks.length) } while (idx === bgmLastIndex)
  bgmLastIndex = idx
  return bgmTracks[idx]
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  if (!enabled) stopBackgroundMusic()
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

function playNote(ctx: AudioContext, freq: number, startOffset: number): void {
  const t = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)

  gain.gain.setValueAtTime(NOTIFICATION_VOLUME, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + NOTIFICATION_NOTE_DURATION_SEC)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(t)
  osc.stop(t + NOTIFICATION_NOTE_DURATION_SEC)
}

function getBgmAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!bgmAudio) {
    bgmAudio = new Audio(pickNextTrack())
    bgmAudio.loop = false
    bgmAudio.preload = 'auto'
    bgmAudio.volume = BGM_VOLUME
    bgmAudio.addEventListener('ended', () => {
      if (!soundEnabled || !bgmAudio) return
      bgmAudio.src = pickNextTrack()
      bgmAudio.load()
      bgmAudio.play().catch(() => {})
    })
  }
  return bgmAudio
}

function bindBgmGestureRetry(): void {
  if (typeof window === 'undefined' || bgmGestureRetryBound) return
  bgmGestureRetryBound = true

  const cleanup = () => {
    if (typeof window === 'undefined' || !bgmGestureRetryBound) return
    bgmGestureRetryBound = false
    window.removeEventListener('pointerdown', resumeOnGesture)
    window.removeEventListener('touchstart', resumeOnGesture)
    window.removeEventListener('keydown', resumeOnGesture)
  }

  const resumeOnGesture = () => {
    if (!soundEnabled) { cleanup(); return }
    void playBackgroundMusic().then(() => { cleanup() }).catch(() => {})
  }

  window.addEventListener('pointerdown', resumeOnGesture, { passive: true })
  window.addEventListener('touchstart', resumeOnGesture, { passive: true })
  window.addEventListener('keydown', resumeOnGesture)
}

export async function playDoneSound(): Promise<void> {
  if (!soundEnabled) return
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    playNote(audioCtx, NOTIFICATION_NOTE_1_HZ, NOTIFICATION_NOTE_1_START_SEC)
    playNote(audioCtx, NOTIFICATION_NOTE_2_HZ, NOTIFICATION_NOTE_2_START_SEC)
  } catch {
    // Audio may not be available
  }
}

export function unlockAudio(): void {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    // ignore
  }
}

export async function playBackgroundMusic(): Promise<void> {
  if (!soundEnabled) return
  // 星舰 / 林间：使用程序化实时合成 BGM
  if (bgmOfficeGame === 'starship' || bgmOfficeGame === 'grove') {
    try {
      if (bgmAudio) {
        bgmAudio.pause()
        bgmAudio.currentTime = 0
      }
      await startProceduralBgm(bgmOfficeGame)
    } catch {
      bindBgmGestureRetry()
    }
    return
  }
  // 经典办公室：从 public/assets/pixel-office/*.mp3 中选曲播放
  stopProceduralBgm()
  await loadTracks()
  try {
    const audio = getBgmAudio()
    if (!audio) return
    // 若 audio 创建时还没拿到 tracks，换成正确曲目
    if (
      bgmTracks.length > 0 &&
      (audio.src.includes('pixel-adventure') || audio.src.includes('adventure')) &&
      bgmTracks.length > 1
    ) {
      audio.src = pickNextTrack()
      audio.load()
    }
    audio.muted = false
    audio.loop = false
    audio.volume = BGM_VOLUME
    await audio.play()
  } catch {
    bindBgmGestureRetry()
  }
}

export function skipToNextTrack(): void {
  if (bgmOfficeGame === 'starship' || bgmOfficeGame === 'grove') {
    skipProceduralVariation()
    return
  }
  if (!bgmAudio) return
  bgmAudio.src = pickNextTrack()
  bgmAudio.load()
  if (soundEnabled) bgmAudio.play().catch(() => {})
}

export function stopBackgroundMusic(): void {
  stopProceduralBgm()
  if (!bgmAudio) return
  bgmAudio.pause()
  bgmAudio.currentTime = 0
}
