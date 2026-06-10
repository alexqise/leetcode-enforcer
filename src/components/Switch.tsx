import { Switch as BaseSwitch } from '@base-ui-components/react/switch'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label'?: string
  id?: string
}

/** Boolean toggle on Base UI — monochrome: warm-white track when on. */
export function Switch({ checked, onChange, ...rest }: SwitchProps) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      className="relative flex h-[20px] w-[34px] shrink-0 cursor-pointer rounded-full border-0 bg-surface-3 p-[3px] transition-colors duration-150 data-[checked]:bg-fg"
      {...rest}
    >
      <BaseSwitch.Thumb className="aspect-square h-full rounded-full bg-fg-3 transition-[transform,background-color] duration-150 ease-out data-[checked]:translate-x-[14px] data-[checked]:bg-bg" />
    </BaseSwitch.Root>
  )
}
