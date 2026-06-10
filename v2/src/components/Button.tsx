import type { ButtonHTMLAttributes } from 'react'

type Variant = 'outline' | 'ghost' | 'primary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const base =
  'cursor-pointer rounded-md border px-4 py-2 text-[12.5px] font-medium tracking-[-0.003em] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  outline:
    'border-border-2 bg-transparent text-fg-2 hover:enabled:border-fg-3 hover:enabled:bg-surface-2 hover:enabled:text-fg',
  ghost:
    'border-transparent bg-transparent text-fg-2 hover:enabled:border-border hover:enabled:bg-surface-2 hover:enabled:text-fg',
  primary:
    'border-primary bg-primary font-semibold text-bg hover:enabled:border-[#FF8456] hover:enabled:bg-[#FF8456]',
  danger:
    'border-hard bg-hard font-semibold text-bg hover:enabled:border-[#FF8B88] hover:enabled:bg-[#FF8B88]',
}

export function Button({
  variant = 'outline',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />
}
