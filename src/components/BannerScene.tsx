import type { ReactNode } from 'react'

type Variant = 'dusk' | 'sunrise'

interface BannerSceneProps {
  /** dusk = block page; sunrise = onboarding (design.md §5.15). */
  variant?: Variant
  /** Wrapper sizing — override to stretch the scene (full-bleed, side panel). */
  className?: string
  /** Topbar content overlaid on the scene (brand, streak chip). */
  children?: ReactNode
}

interface ScenePalette {
  skyStops: [string, string, string, string]
  sun: string
  glowOpacity: number
  starOpacity: number
  ridgeBack: string
  ridgeLine: string
  ridgeLineOpacity: number
  ridgeMid: string
}

// Same geometry, different light. The front ridge is always --bg so the
// art dissolves into the page with no separating line.
const scenes: Record<Variant, ScenePalette> = {
  dusk: {
    skyStops: ['#1B1733', '#322549', '#523054', '#74404F'],
    sun: '#FF6F3C',
    glowOpacity: 0.5,
    starOpacity: 1,
    ridgeBack: '#2B2144',
    ridgeLine: '#97A3FF',
    ridgeLineOpacity: 0.22,
    ridgeMid: '#1F1830',
  },
  sunrise: {
    skyStops: ['#1F1839', '#3D2C55', '#7A4458', '#BC6B52'],
    sun: '#FFA94D',
    glowOpacity: 0.6,
    starOpacity: 0.45,
    ridgeBack: '#33244A',
    ridgeLine: '#B9C2FF',
    ridgeLineOpacity: 0.16,
    ridgeMid: '#241A33',
  },
}

/**
 * Banner scene (design.md §5.15). Handwritten SVG, not a component
 * system: sky gradient, star field, sun anchored right (cx=1180 +
 * xMaxYMax slice keeps it visible at any width), three ridges. Grain
 * sits behind the front ridge.
 */
export function BannerScene({
  variant = 'dusk',
  className = 'h-[232px] max-sm:h-[176px]',
  children,
}: BannerSceneProps) {
  const s = scenes[variant]
  const skyId = `lce-sky-${variant}`
  const glowId = `lce-glow-${variant}`
  const grainId = `lce-grain-${variant}`

  return (
    <div className={`relative ${className}`} style={{ background: s.skyStops[0] }}>
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox="0 0 1440 232"
        preserveAspectRatio="xMaxYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.skyStops[0]} />
            <stop offset="0.52" stopColor={s.skyStops[1]} />
            <stop offset="0.80" stopColor={s.skyStops[2]} />
            <stop offset="1" stopColor={s.skyStops[3]} />
          </linearGradient>
          <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={s.sun} stopOpacity={s.glowOpacity} />
            <stop offset="1" stopColor={s.sun} stopOpacity="0" />
          </radialGradient>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0" />
          </filter>
        </defs>

        <rect width="1440" height="232" fill={`url(#${skyId})`} />

        <g fill="#B9C2FF" opacity={s.starOpacity}>
          <circle cx="140" cy="38" r="1.4" opacity="0.7" />
          <circle cx="260" cy="70" r="1" opacity="0.5" />
          <circle cx="430" cy="30" r="1.2" opacity="0.6" />
          <circle cx="582" cy="82" r="1" opacity="0.4" />
          <circle cx="704" cy="24" r="1" opacity="0.5" />
          <circle cx="822" cy="42" r="1.4" opacity="0.6" />
          <circle cx="958" cy="64" r="1" opacity="0.45" />
          <circle cx="1120" cy="30" r="1" opacity="0.5" />
          <circle cx="1268" cy="56" r="1.2" opacity="0.55" />
          <circle cx="1382" cy="34" r="1" opacity="0.45" />
        </g>

        <circle cx="1180" cy="174" r="150" fill={`url(#${glowId})`} />
        <circle cx="1180" cy="168" r="42" fill={s.sun} />

        <path
          d="M0 156 C160 128 340 166 520 146 C720 124 880 168 1060 152 C1240 138 1360 158 1440 148 L1440 232 L0 232 Z"
          fill={s.ridgeBack}
        />
        <path
          d="M0 150 C240 118 480 160 720 138 C960 118 1200 152 1440 128"
          stroke={s.ridgeLine}
          strokeWidth="1"
          fill="none"
          opacity={s.ridgeLineOpacity}
        />
        <path
          d="M0 190 C220 164 440 200 660 182 C880 164 1100 202 1290 186 C1350 180 1410 188 1440 184 L1440 232 L0 232 Z"
          fill={s.ridgeMid}
        />

        <rect width="1440" height="232" filter={`url(#${grainId})`} opacity="0.05" />

        <path
          d="M0 214 C260 198 540 224 840 210 C1100 198 1320 220 1440 208 L1440 232 L0 232 Z"
          fill="#161216"
        />
      </svg>

      {children}
    </div>
  )
}
