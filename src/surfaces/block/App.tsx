// Block page — error shell; the layout lives in BlockMain (currently a
// jmoui dispatcher over five concept variants).

import { useStatus } from '../../hooks/useStatus'
import { BlockMain } from './BlockMain'

export function App() {
  const { status, error } = useStatus()

  if (error) {
    return (
      <div className="mx-auto mt-[30vh] max-w-[640px] px-8 text-[13px] leading-relaxed text-fg-2">
        LeetCode Enforcer is unavailable. Reload the page; if that fails, reload the extension from
        chrome://extensions.
      </div>
    )
  }

  return <BlockMain status={status} />
}
