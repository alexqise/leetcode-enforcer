// Popup main layout — the variant-picker winner (2026-06-10): segmented
// quota ring with the coach headline beside it, then the due list and
// log-a-problem. Ring honors the discrete-count rule (one arc per
// problem, design.md §5.13).

import {
  blockStateText,
  DueList,
  FootAuth,
  FootGithub,
  HeaderActions,
  LogProblem,
  type PopupMainProps,
  StreakInline,
  SyncError,
} from './parts'

function SegmentedRing({ total, filled }: { total: number; filled: number }) {
  const size = 104
  const r = 44
  const c = 2 * Math.PI * r
  const gapDeg = total > 1 ? 14 : 0
  const segDeg = 360 / total - gapDeg
  const segLen = (segDeg / 360) * c

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${filled} of ${total} solved`}
    >
      {Array.from({ length: total }, (_, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={i < filled ? 'stroke-primary' : 'stroke-surface-3'}
          strokeDasharray={`${segLen} ${c - segLen}`}
          transform={`rotate(${-90 + gapDeg / 2 + i * (segDeg + gapDeg)} ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  )
}

export function PopupMain({ status, refresh, onSignOutClick }: PopupMainProps) {
  const quota = status?.settings.dailyQuota ?? 1
  const solved = status?.state.solvesToday ?? 0
  const remaining = Math.max(0, quota - solved)
  const overrideActive = !!status?.state.overrideActiveUntil && !status.blockActive

  return (
    <div className="flex w-[340px] flex-col">
      <header className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <span className="text-[13px] font-semibold tracking-[-0.015em] text-fg">Enforcer</span>
        <HeaderActions />
      </header>

      {status && <SyncError status={status} onRetried={refresh} />}

      <section className="flex items-center gap-5 px-5 pt-4 pb-2" aria-label="Today">
        <div className="relative shrink-0">
          <SegmentedRing total={Math.max(1, quota)} filled={solved} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-medium leading-none tracking-[-0.01em] text-fg">
              {solved}
              <span className="text-[12px] text-fg-3">/{quota}</span>
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="m-0 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-fg">
            {remaining === 0 ? (
              <>You're clear for today.</>
            ) : (
              <>
                Solve <span className="text-primary">{remaining}</span> more to unlock your sites.
              </>
            )}
          </h1>
          <div className="mt-2">
            <StreakInline status={status} />
          </div>
          {overrideActive && (
            <div className="mt-1.5 text-[11px] tracking-[-0.003em] text-fg-3">
              {blockStateText(status)}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pt-4" aria-label="Review queue">
        <h2 className="m-0 mb-1 text-[11px] font-semibold tracking-[-0.003em] text-fg-3">
          Due now
        </h2>
        <DueList status={status} cap={5} />
      </section>

      <section className="px-4 pt-4 pb-3" aria-label="Log a problem">
        <LogProblem onSaved={refresh} />
      </section>

      <footer className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <FootAuth status={status} onSignOutClick={onSignOutClick} />
        <FootGithub status={status} />
      </footer>
    </div>
  )
}
