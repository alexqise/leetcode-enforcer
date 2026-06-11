// Variant E — "Full scene": the entire viewport is the dusk scene.
// Content floats over the art on a bottom scrim, cinematic lock-screen
// energy; reviews live quietly in the top corner.

import { BannerScene } from '../../components/BannerScene'
import { diffTextClass } from '../../components/difficulty'
import { SegmentedBar } from '../../components/SegmentedBar'
import { StreakChip } from '../../components/StreakChip'
import {
  type BlockMainProps,
  coachHeadline,
  DailyLink,
  quotaNumbers,
  RandomLine,
  useFromUrl,
  useOverride,
  useSuggestions,
} from './parts'

export default function BlockMain({ status }: BlockMainProps) {
  const from = useFromUrl()
  const sug = useSuggestions()
  const override = useOverride(status)
  const { quota, solved, remaining } = quotaNumbers(status)
  const due = status?.due ?? []

  return (
    <div className="relative h-screen overflow-hidden">
      <BannerScene className="h-full" />
      {/* legibility scrim over the lower scene */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-bg via-bg/85 to-transparent" />

      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-5">
        <span className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#F4F1F6]">
          Enforcer
        </span>
        <StreakChip days={status?.state.streakDays ?? 0} />
      </header>

      {due.length > 0 && (
        <aside
          aria-label="Reviews due"
          className="absolute top-20 right-10 w-[260px] max-[720px]:hidden"
        >
          <h2 className="m-0 mb-2 text-[11px] font-semibold tracking-[-0.003em] text-[rgba(244,241,246,0.6)]">
            Reviews due
          </h2>
          <div className="flex flex-col gap-1">
            {due.slice(0, 3).map((p) => (
              <a
                key={p.slug}
                href={p.url}
                target="_top"
                title={p.title}
                className="flex items-baseline gap-2 truncate text-[12.5px] font-medium text-[#F4F1F6] no-underline hover:text-primary"
              >
                <span className="min-w-0 truncate">
                  {p.number ? `${p.number}. ` : ''}
                  {p.title}
                </span>
                <span className={`ml-auto shrink-0 text-[10.5px] ${diffTextClass(p.difficulty)}`}>
                  {p.srsIntervalDays}d
                </span>
              </a>
            ))}
          </div>
        </aside>
      )}

      <main className="absolute inset-x-0 bottom-0 px-10 pb-12 max-sm:px-6 max-sm:pb-8">
        <div className="max-w-[640px]">
          <h1 className="m-0 text-[34px] font-semibold leading-[1.2] tracking-[-0.028em] text-fg max-sm:text-[26px]">
            {coachHeadline(remaining, from)}
          </h1>
          <SegmentedBar
            total={quota}
            filled={solved}
            label="Daily quota"
            className="mt-5 mb-1.5 max-w-[320px]"
          />
          <div className="text-[11.5px] text-fg-3">
            {status ? `${solved} of ${quota} solved today` : ''}
          </div>

          <div className="mt-9">
            <DailyLink sug={sug} size="lg" />
            <div className="mt-3.5">
              <RandomLine sug={sug} />
            </div>
          </div>

          <div className="mt-9 text-[11.5px] tracking-[-0.003em] text-fg-4">
            <button
              type="button"
              disabled={override.disabled}
              onClick={override.open}
              title={override.hint}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-fg-4 transition-colors duration-100 hover:text-fg-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Emergency override…
            </button>
          </div>
        </div>
      </main>

      {override.modal}
    </div>
  )
}
