import { FlameIcon } from './icons'

interface StreakChipProps {
  days: number
}

/**
 * Glass chip for the banner topbar — the one sanctioned glass use
 * (legibility over imagery, design.md §5). Colors are scene literals,
 * not palette tokens, because it sits on the banner art.
 */
export function StreakChip({ days }: StreakChipProps) {
  return (
    <div
      title="Current streak"
      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(18,12,20,0.5)] px-3 py-[5px] text-[11.5px] tracking-[-0.003em] text-[#E9E5EC] backdrop-blur-[6px]"
    >
      <FlameIcon className="shrink-0 text-medium" />
      <span>
        <span className="font-medium text-[#FFFFFF]">{days}</span>
        -day streak
      </span>
    </div>
  )
}
