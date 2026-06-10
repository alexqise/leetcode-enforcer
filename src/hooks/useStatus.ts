import { useCallback, useEffect, useState } from 'react'
import { isMsgError, type StatusResponse, send } from '../messages'

/**
 * Fetches getStatus from the service worker and refreshes whenever
 * the relevant chrome.storage keys change (solves, overrides, settings
 * edits in another surface).
 */
export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await send({ type: 'getStatus' })
    if (isMsgError(res)) {
      setError(res.error)
    } else {
      setStatus(res)
      setError(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (
        area === 'local' &&
        (changes.state || changes.settings || changes.problems || changes.supabaseSession)
      ) {
        refresh()
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [refresh])

  return { status, error, refresh }
}
