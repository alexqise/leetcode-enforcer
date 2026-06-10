import { Slider as BaseSlider } from '@base-ui-components/react/slider'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  'aria-label'?: string
  className?: string
}

/**
 * Single-value slider on Base UI: hairline track, primary progress fill
 * (sanctioned — progress is the one job primary has on controls), warm
 * white thumb.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  ...rest
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? min) : v)}
      min={min}
      max={max}
      step={step}
      className={className}
      {...rest}
    >
      <BaseSlider.Control className="flex h-5 w-full touch-none select-none items-center">
        <BaseSlider.Track className="h-[3px] w-full select-none rounded-full bg-surface-3">
          <BaseSlider.Indicator className="select-none rounded-full bg-primary" />
          <BaseSlider.Thumb className="size-[15px] select-none rounded-full bg-fg shadow-[0_1px_4px_rgba(0,0,0,0.45)] outline-none transition-shadow duration-100 hover:shadow-[0_0_0_5px_rgba(240,237,234,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
