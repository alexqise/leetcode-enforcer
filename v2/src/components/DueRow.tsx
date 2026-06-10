import type { DueProblem } from '../engine/types'
import { diffDotClass, diffTextClass } from './difficulty'

interface DueRowProps {
  problem: DueProblem
  /** _top for full-page surfaces, _blank for the popup. */
  target?: '_top' | '_blank'
}

/** Open review row: difficulty dot, title link, difficulty + interval meta. */
export function DueRow({ problem: p, target = '_top' }: DueRowProps) {
  const title = `${p.number ? `${p.number}. ` : ''}${p.title}`
  return (
    <div className="-mx-2.5 flex items-center justify-between gap-2.5 rounded-md px-2.5 py-[9px] transition-colors duration-100 hover:bg-surface">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${diffDotClass(p.difficulty)}`} />
      <a
        href={p.url}
        target={target}
        title={title}
        className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.005em] text-fg no-underline"
      >
        {title}
      </a>
      <span className="shrink-0 font-mono text-[11px] text-secondary">
        <span className={`font-medium ${diffTextClass(p.difficulty)}`}>{p.difficulty}</span>
        {` · ${p.srsIntervalDays}d`}
      </span>
    </div>
  )
}
