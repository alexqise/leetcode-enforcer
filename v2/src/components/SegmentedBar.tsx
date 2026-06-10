interface SegmentedBarProps {
  /** Total segments (the quota). */
  total: number
  /** Completed segments. */
  filled: number
  label: string
  className?: string
}

/**
 * Segmented quota bar (design.md §5): one rounded segment per quota unit,
 * filled segments in primary, the next segment up in border-2.
 */
export function SegmentedBar({ total, filled, label, className = '' }: SegmentedBarProps) {
  const segs = Math.max(1, total)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={segs}
      aria-valuenow={Math.min(filled, segs)}
      aria-valuetext={`${filled} of ${total} solved`}
      className={`flex h-1.5 gap-1 ${className}`}
    >
      {Array.from({ length: segs }, (_, i) => {
        const state = i < filled ? 'bg-primary' : i === filled ? 'bg-border-2' : 'bg-surface-3'
        // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional by definition
        return <div key={i} className={`flex-1 rounded-full ${state}`} />
      })}
    </div>
  )
}
