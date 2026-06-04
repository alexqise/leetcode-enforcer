const RULE_ID_BASE = 1000;

function blockPageUrl(originalUrl) {
  const block = chrome.runtime.getURL('block/block.html');
  return `${block}?from=${encodeURIComponent(originalUrl)}`;
}

export async function applyBlockRules(blocklist, blockEnabled) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  let addRules = [];
  if (blockEnabled && blocklist.length > 0) {
    addRules = blocklist.map((domain, i) => ({
      id: RULE_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          regexSubstitution: chrome.runtime.getURL('block/block.html') + '?from=\\0'
        }
      },
      condition: {
        regexFilter: `^https?://(www\\.)?${escapeRegex(domain)}.*`,
        resourceTypes: ['main_frame']
      }
    }));
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
  console.log('[LCE] blocklist rules applied', { enabled: blockEnabled, count: addRules.length });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function clearBlockRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length === 0) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id)
  });
}
