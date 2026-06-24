import type { ButtonHTMLAttributes } from 'react'

type Variant = 'outline' | 'ghost' | 'primary' | 'danger' | 'raised' | 'raised-danger'

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
  raised:
    'rounded-[10px] border-0 bg-gradient-to-b from-surface-2 to-surface py-3.5 font-semibold text-fg-2 shadow-[inset_0_1px_0_0_rgba(240,237,234,0.045)] hover:enabled:from-surface-3 hover:enabled:to-surface-2 hover:enabled:text-fg active:enabled:shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)]',
  'raised-danger':
    'rounded-[10px] border-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--color-surface-2)_88%,var(--color-hard)_12%)] to-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-hard)_8%)] py-3.5 font-semibold text-hard shadow-[inset_0_1px_0_0_rgba(239,111,108,0.12)] hover:enabled:from-[color-mix(in_srgb,var(--color-surface-3)_85%,var(--color-hard)_15%)] hover:enabled:to-[color-mix(in_srgb,var(--color-surface-2)_88%,var(--color-hard)_12%)] active:enabled:shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)]',
}

export function Button({
  variant = 'outline',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />
}
