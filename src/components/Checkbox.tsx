import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label'?: string
  id?: string
}

/** Checkbox on Base UI — monochrome: warm-white fill when checked. */
export function Checkbox({ checked, onChange, ...rest }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={onChange}
      className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-border-2 bg-surface p-0 transition-colors duration-100 hover:border-fg-3 data-[checked]:border-fg data-[checked]:bg-fg"
      {...rest}
    >
      <BaseCheckbox.Indicator className="text-bg data-[unchecked]:hidden">
        <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
          <path
            d="M3 8.5l3.5 3.5L13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
