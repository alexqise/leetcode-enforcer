import { defineManifest } from '@crxjs/vite-plugin'

/**
 * The "key" field is copied verbatim from v1 — it pins the extension ID,
 * which preserves chrome.storage.local data and the OAuth redirect URI
 * (https://<ID>.chromiumapp.org/). Never change it. See v2/SPEC.md §6.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'LeetCode Enforcer',
  version: '0.2.0',
  description:
    'Blocks distracting sites until you solve your daily LeetCode quota. Spaced repetition + Supabase sync.',
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoVO3PVSp4o8WyHY/2q8Wh52pHMGb0eWnZwkZlGz9uPGdGCQAywLsnOIbYQq8Gsgi34kJvjOZ+BjoAXRWTY1+6YPcVL39fpEE6Bjpxu7gMGTwQwdc5mpeNXR0xNrFGZZrZF40ZQOL2s+Toi0cH81uBVawHt/DvAYN7PqUpOuDkeYUmFG/IXp0g3j4rBlVCt9uC45EQnOu9F66TPMHJYRn4mDgWq47gpQl1fuMQNV8az62M0Hh2qdmo6K0n1oachmImp6R/MBn30YR2sy0odsGFzQBDWcT80VZiLi4FwAs3PHP2FzHppoqKZR7VbZy05VYUFp4PdfSH69QuCKMnpLgUQIDAQAB',
  permissions: [
    'storage',
    'identity',
    'alarms',
    'tabs',
    'scripting',
    'notifications',
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
    'webNavigation',
  ],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://leetcode.com/*'],
      js: ['src/content/inject.ts'],
      world: 'MAIN',
      run_at: 'document_start',
    },
    {
      matches: ['https://leetcode.com/*'],
      js: ['src/content/overlay/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/surfaces/block/index.html'],
      matches: ['<all_urls>'],
    },
  ],
  action: {
    default_popup: 'src/surfaces/popup/index.html',
    default_title: 'LeetCode Enforcer',
  },
  options_ui: {
    page: 'src/surfaces/options/index.html',
    open_in_tab: true,
  },
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
})
