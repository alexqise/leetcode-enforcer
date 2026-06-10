import type { ReactNode } from 'react'

interface SectionLabelProps {
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/** Small icon + text heading used to label open content sections. */
export function SectionLabel({ icon, children, className = 'mb-3.5' }: SectionLabelProps) {
  return (
    <h2
      className={`m-0 inline-flex items-center gap-[7px] text-xs font-semibold tracking-[-0.003em] text-fg-2 [&_svg]:text-fg-3 ${className}`}
    >
      {icon}
      {children}
    </h2>
  )
}
