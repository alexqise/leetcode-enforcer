// Variant A — "Coach letter": a single readable column under the banner,
// written to you. Headline names the blocked site, one clear next step,
// reviews as a quiet list, override as a closing line.

import { BannerScene } from '../../components/BannerScene'
import { Button } from '../../components/Button'
import { SegmentedBar } from '../../components/SegmentedBar'
import { StreakChip } from '../../components/StreakChip'
import {
  type BlockMainProps,
  coachHeadline,
  DailyLink,
  DueRows,
  quotaNumbers,
  RandomLine,
  resetNote,
  useFromUrl,
  useOverride,
  useSuggestions,
} from './parts'

export default function BlockMain({ status }: BlockMainProps) {
  const from = useFromUrl()
  const sug = useSuggestions()
  const override = useOverride(status)
  const { quota, solved, remaining } = quotaNumbers(status)

  return (
    <>
      <BannerScene>
        <header className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-5 max-sm:px-5 max-sm:py-4">
          <span className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#F4F1F6]">
            Enforcer
          </span>
          <StreakChip days={status?.state.streakDays ?? 0} />
        </header>
      </BannerScene>

      <main className="mx-auto max-w-[560px] px-6 pb-16">
        <section aria-label="Today's progress" className="mt-12">
          <h1 className="m-0 text-[28px] font-semibold leading-[1.25] tracking-[-0.025em] text-fg">
            {coachHeadline(remaining, from)}
          </h1>
          <SegmentedBar total={quota} filled={solved} label="Daily quota" className="mt-6 mb-2" />
          <div className="flex items-baseline justify-between text-[11.5px] text-fg-3">
            <span>{status ? `${solved} of ${quota} solved` : ''}</span>
            <span>{resetNote(status)}</span>
          </div>
        </section>

        <section aria-label="Suggested problems" className="mt-14">
          <DailyLink sug={sug} label="Start here — today's challenge" size="lg" />
          <div className="mt-4">
            <RandomLine sug={sug} />
          </div>
        </section>

        <section aria-label="Reviews due" className="mt-12">
          <h2 className="m-0 mb-1 text-[11.5px] font-semibold tracking-[-0.003em] text-fg-3">
            Or clear a review — they count too
          </h2>
          <DueRows due={status?.due} cap={3} />
        </section>

        <footer className="mt-14 flex items-center justify-between gap-4 border-t border-border pt-5">
          <span className="text-[11.5px] tracking-[-0.003em] text-fg-3">
            Emergency override · {override.hint}
          </span>
          <Button variant="ghost" disabled={override.disabled} onClick={override.open}>
            Override…
          </Button>
        </footer>
      </main>

      {override.modal}
    </>
  )
}
