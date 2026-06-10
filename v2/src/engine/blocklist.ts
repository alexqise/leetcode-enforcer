// Port of v1 lib/blocklist.js — declarativeNetRequest dynamic redirect
// rules. The block page moved to src/surfaces/block/index.html in v2;
// BLOCK_PAGE_PATH is the single place that knows it.

const RULE_ID_BASE = 1000

export const BLOCK_PAGE_PATH = 'src/surfaces/block/index.html'

export function blockPageUrl(originalUrl: string): string {
  const block = chrome.runtime.getURL(BLOCK_PAGE_PATH)
  return `${block}?from=${encodeURIComponent(originalUrl)}`
}

export async function applyBlockRules(blocklist: string[], blockEnabled: boolean): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existing.map((r) => r.id)

  let addRules: chrome.declarativeNetRequest.Rule[] = []
  if (blockEnabled && blocklist.length > 0) {
    addRules = blocklist.map((domain, i) => ({
      id: RULE_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
        redirect: {
          regexSubstitution: `${chrome.runtime.getURL(BLOCK_PAGE_PATH)}?from=\\0`,
        },
      },
      condition: {
        regexFilter: `^https?://(www\\.)?${escapeRegex(domain)}.*`,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    }))
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })
  console.log('[LCE] blocklist rules applied', { enabled: blockEnabled, count: addRules.length })
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function clearBlockRules(): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  if (existing.length === 0) return
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
  })
}
