// Dispatcher shim (jmoui): renders the variant selected in the floating
// picker. Collapses to the winning layout once the user picks.

import { useUIPicker } from '../../_uipicker/UIPickerContext'
import BlockMainA from './BlockMain.variant-a'
import BlockMainE from './BlockMain.variant-e'
import type { BlockMainProps } from './parts'

const VARIANTS: Record<string, (props: BlockMainProps) => React.JSX.Element> = {
  a: BlockMainA,
  e: BlockMainE,
}

export function BlockMain(props: BlockMainProps) {
  const { selected } = useUIPicker()
  const Component = VARIANTS[selected] ?? BlockMainA
  return <Component {...props} />
}
