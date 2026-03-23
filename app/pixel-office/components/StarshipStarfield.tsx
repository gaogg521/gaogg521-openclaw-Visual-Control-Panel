'use client'

import { useMemo } from 'react'

/** 确定性「随机」星点 box-shadow（单层视口尺寸约 w×h） */
function makeStarShadows(
  count: number,
  seed: number,
  w: number,
  h: number,
  opts?: { bigChance?: number; glowChance?: number },
): string {
  let a = seed >>> 0
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
  const bigChance = opts?.bigChance ?? 0.03
  const glowChance = opts?.glowChance ?? 0.06
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const opacity = 0.15 + rnd() * 0.85
    const blur = rnd() < glowChance ? 1 + rnd() * 2 : 0
    const spread = rnd() < bigChance ? 1 : 0
    const r = 210 + Math.floor(rnd() * 45)
    const g = 230 + Math.floor(rnd() * 25)
    const b = 255
    parts.push(`${x.toFixed(1)}px ${y.toFixed(1)}px ${blur.toFixed(1)}px ${spread}px rgba(${r},${g},${b},${opacity.toFixed(3)})`)
  }
  return parts.join(', ')
}

export function StarshipStarfield() {
  const dense = useMemo(() => makeStarShadows(140, 0x5f3759df, 1200, 1400, { bigChance: 0.04, glowChance: 0.08 }), [])
  const sparse = useMemo(() => makeStarShadows(42, 0xdeadbeef, 1200, 1400, { bigChance: 0.12, glowChance: 0.35 }), [])

  return (
    <>
      <style>{`
        @keyframes starship-sf-parallax-fast {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }
        @keyframes starship-sf-parallax-slow {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }
        @keyframes starship-sf-twinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.92; }
        }
        .starship-sf-fast {
          animation: starship-sf-parallax-fast 95s linear infinite;
        }
        .starship-sf-slow {
          animation: starship-sf-parallax-slow 220s linear infinite, starship-sf-twinkle 5.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .starship-sf-fast,
          .starship-sf-slow {
            animation: none !important;
          }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        aria-hidden
      >
        {/* 快层：密星，无缝纵向循环 */}
        <div
          className="starship-sf-fast absolute left-0 top-0 w-full will-change-transform"
          style={{ height: '200%' }}
        >
          {[0, 1].map((k) => (
            <div key={k} className="relative h-1/2 w-full">
              <div
                className="absolute left-0 top-0 h-px w-px bg-transparent"
                style={{ boxShadow: dense }}
              />
            </div>
          ))}
        </div>
        {/* 慢层：大星 / 光晕，视差 */}
        <div
          className="starship-sf-slow absolute left-0 top-0 w-full will-change-transform opacity-90"
          style={{ height: '200%' }}
        >
          {[0, 1].map((k) => (
            <div key={k} className="relative h-1/2 w-full">
              <div
                className="absolute left-0 top-0 h-px w-px bg-transparent"
                style={{ boxShadow: sparse }}
              />
            </div>
          ))}
        </div>
        {/* 舰桥窗缘暗角（与 canvas 内 vignette 呼应，仅外圈） */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_50%_40%,transparent_0%,transparent_45%,rgba(2,8,20,0.55)_100%)]"
          aria-hidden
        />
      </div>
    </>
  )
}
