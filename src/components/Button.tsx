import type { ButtonHTMLAttributes } from 'react'

type Variant = 'outline' | 'ghost' | 'primary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const base =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent px-3.5 py-[7px] text-[13px] font-medium tracking-[-0.003em] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50'

// Borderless soft fills (user-directed, 2026-06-10) — no outlined chips.
// Primary is the inverted warm-white CTA (design.md §5.10); accents never
// sit on resting buttons (principle 1). Danger is a soft red tint.
const variants: Record<Variant, string> = {
  outline: 'bg-surface-2 text-fg-2 hover:enabled:bg-surface-3 hover:enabled:text-fg',
  ghost: 'bg-transparent text-fg-2 hover:enabled:bg-surface-2 hover:enabled:text-fg',
  primary: 'bg-fg font-semibold text-bg hover:enabled:bg-[#FFFCF7]',
  danger:
    'bg-[rgba(239,111,108,0.14)] font-medium text-hard hover:enabled:bg-[rgba(239,111,108,0.24)]',
}

export function Button({
  variant = 'outline',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />
}
