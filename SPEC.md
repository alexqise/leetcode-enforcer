# LeetCode Enforcer — Spec

## Context

A Chrome extension that uses hard-blocking distracting sites as the forcing function for daily LeetCode practice, with spaced repetition built in. Blocks YouTube/IG/TikTok/etc. until a daily problem quota is met. Problems are auto-detected when solved on leetcode.com, rated inline, and synced to a Notion-styled Google Sheet. Spaced repetition surfaces past problems for review through the block screen, popup, and an inline banner on leetcode.com — keeping the backlog small because LC problems are expensive (20–40 min each, not Anki flashcards).

The **user is the source of truth.** LC autosync and history-import are convenience helpers, not authoritative.

This spec is the output of an interview-driven design pass and is the single reference for implementation.

## Repo location

`/Users/user/Documents/repositories/leetcode-enforcer`

The folder doesn't exist yet — create it as the first step. Copy this spec into the folder as `SPEC.md`.

## Tech stack

- **Manifest V3** Chrome extension
- **Vanilla JS + HTML + CSS** — no framework, no build step
- `chrome.storage.local` for persistence
- `chrome.identity` for Google OAuth
- `chrome.declarativeNetRequest` for redirect-based blocking
- `chrome.alarms` for the 03:00 quota reset
- Google Sheets API v4 for sync
- LeetCode public GraphQL (`https://leetcode.com/graphql/`) using the user's session cookie for history import + daily challenge

## File structure

```
leetcode-enforcer/
├── manifest.json
├── README.md
├── SPEC.md
├── icons/                           16/48/128/256/512
├── background/
│   └── service_worker.js            block enforcement, OAuth, Sheets sync, alarms
├── content/
│   ├── leetcode_content.js          overlay UI, MAIN-world script injector, inline review banner
│   ├── leetcode_inject.js           MAIN-world: monkey-patches fetch to capture submissions
│   └── overlay.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── onboarding/
│   ├── onboarding.html              3-step wizard, opens on install
│   ├── onboarding.js
│   └── onboarding.css
├── block/
│   ├── block.html                   takeover page shown on blocked sites
│   ├── block.js
│   └── block.css
└── lib/
    ├── storage.js                   chrome.storage abstraction + schema
    ├── srs.js                       fixed-ladder interval math
    ├── sheets.js                    Google Sheets API client
    ├── oauth.js                     chrome.identity wrappers
    ├── leetcode_api.js              GraphQL: history import, daily challenge, problem catalog
    ├── blocklist.js                 DNR rule management
    └── stats.js                     chart-data computation
```

## Manifest permissions

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "identity",
    "alarms",
    "tabs",
    "scripting",
    "notifications",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess"
  ],
  "host_permissions": [
    "https://leetcode.com/*",
    "https://sheets.googleapis.com/*",
    "https://www.googleapis.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/*"],
      "js": ["content/leetcode_content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": { "service_worker": "background/service_worker.js" },
  "web_accessible_resources": [
    { "resources": ["content/leetcode_inject.js"], "matches": ["https://leetcode.com/*"] }
  ],
  "action": { "default_popup": "popup/popup.html" }
}
```

## Core mechanics

### Daily quota
- Default: **1 problem/day**, settable 1–5 in onboarding/options
- **Reviews count toward quota** by default — so doing 1 review OR 1 new solve unblocks the day
- Resets at **03:00 local time** via a `chrome.alarms` cron
- Streak rules: **strict** — miss a day → reset to 0

### Blocking
- Uses `declarativeNetRequest` redirect rules → `block.html?from=<encoded-url>`
- Activates when `solvesToday < dailyQuota` AND `now > overrideActiveUntil`
- Rules toggle on/off via `updateDynamicRules` when quota state changes
- **Default blocklist** (user can add/remove): youtube.com, instagram.com, tiktok.com, reddit.com, twitter.com, x.com, facebook.com, snapchat.com, netflix.com, hulu.com, disneyplus.com, twitch.tv
- "Always-on" model: no time-of-day logic in v1

### Block screen (`block.html`)
Shows, top to bottom:
1. Big headline: `"X problems left today"` + animated progress bar
2. **Suggested actions row**:
   - LeetCode daily challenge (fetched via GraphQL `activeDailyCodingChallengeQuestion`)
   - 1 random unsolved-and-not-mastered problem (uses LC problem catalog, filtered against local Problems table)
3. **Review queue**: top 1–3 due reviews, click-to-open in LC
4. Streak chip: `"🔥 N day streak — don't break it"`
5. **Emergency override**: button `"Override 10 minutes (1 left today)"`. Click → modal with textarea, must type exactly `"I am being weak"` → flips `overrideActiveUntil` to now+10min, increments `overrideUsedToday`, logged.

### Detection — MAIN-world fetch monkey-patch
- Content script on `leetcode.com/*` injects `leetcode_inject.js` into the MAIN world via a `<script src="...">` tag pulled from `web_accessible_resources` (required because LC CSP blocks inline injection)
- Inject script wraps `window.fetch`:
  ```js
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const res = await orig(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const isSubmission = url?.includes('/submissions/detail/')
      || (args[1]?.body && /submitCode|submissionResult/.test(String(args[1].body)));
    if (isSubmission) {
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      if (data?.status_msg === 'Accepted' || data?.state === 'SUCCESS') {
        window.postMessage({ source: 'lce-detector', payload: data }, '*');
      }
    }
    return res;
  };
  ```
- Content script listens for `lce-detector` postMessages, reads problem # / title / URL / difficulty / topic tags from the LC page DOM, and fires the inline rating overlay
- **No history-poll fallback** — mobile/external solves require manual entry from popup

### Inline rating overlay
- Mounted via **Shadow DOM** in the content script to isolate styles from LC
- Fires immediately after a detected "Accepted" submission
- Fields:
  - **Confidence**: 5 segmented buttons (1–5)
  - **Notes**: textarea, markdown allowed
  - **Need-review toggle** (default off)
  - **Mastered toggle** (default off — always available, per user choice)
  - **Save** → commits to local storage, writes to Sheet, schedules next review
  - **Skip for now** → appends to `state.needsRatingQueue`, accessible from popup

### Inline banner on leetcode.com
- On any leetcode.com page, if `dueReviews.length > 0`, a slim top banner appears: `"📚 N reviews due — start one →"`
- Clicking opens the top due problem in the current tab
- Dismissible per-session (X button)

### SRS — fixed escalating ladder
- Ladder: `[1, 3, 7, 14, 30]` days, editable in options
- **First solve**: enters at step 0 (1 day)
- **Clean review** (no need-review toggle): advances one step
- **Need-review toggle on**: stays at current step (next review at current interval again) — this matches the user's "if you redo it and still need to review, ask again at the current cadence" intuition without resetting
- **Mastered toggle**: status → `Mastered`, removed from review queue, retained in sheet for stats. Always available from any solve.
- `nextDue = lastReviewed + srsIntervalDays`
- A problem is "due" when `now >= nextDue` AND `status === 'Active'`

### Review surfacing (all three)
1. **Block screen** — top 1–3 due reviews
2. **Popup** — persistent review queue list (always visible)
3. **Inline banner** on leetcode.com

### History import (on first OAuth, one-time)
- LC GraphQL: `recentAcSubmissionList(username, limit)` and `problemsetQuestionList` — both work with the user's logged-in LC session cookie
- Walk paginated history, dedupe by problem slug
- Insert each as: `status='Mastered'`, `srsIntervalDays=30`, `notes=''`, `lastReviewed=firstSolved`, `latestConfidence=null`
- Surface a "Re-add to review" button per-row in popup/options so user can selectively un-master
- No subsequent polling — autosync via the fetch patch only

### Manual entry (popup)
- "Log a problem" button → small form
- Autocomplete from cached LC problem catalog (fetched once on first connect, refreshed weekly)
- Same fields as inline overlay
- Used for: mobile solves, paper interviews, other platforms

## Google Sheets

### Auth
- `chrome.identity.getAuthToken` with scope `https://www.googleapis.com/auth/spreadsheets`
- OAuth client ID registered in Google Cloud Console (Chrome Extension type, must match extension's stable ID — README will document the dev-time setup with the unpacked extension's ID)
- Tokens auto-refreshed by `chrome.identity`

### Sheet provisioning
- On first OAuth success, call `spreadsheets.create` with two tabs:
  - **Problems** (one row per unique problem, current state)
  - **Stats** (charts + KPI cards)
- Spreadsheet ID stored in `settings.sheetId`
- "Open sheet" button in popup uses the saved URL

### Aesthetic — Notion-inspired
- Sheet background: `#FBFBFA`
- Header band: `#37352F` bg, white text, bold, sticky frozen row 1
- Alternating row stripes: `#F7F6F3`
- **Topics**: comma-joined in cell, with conditional formatting that wraps each tag with a colored background pill (limited approximation — Sheets cell rendering can't true-pill, so use colored background per-row mapped to dominant topic)
- **Status icons**: `🟢 Active`, `⭐ Mastered`, `📦 Archived` (emoji prefix, plain text after)
- **Difficulty pills** via conditional formatting on column D: `🟩 Easy` (green bg), `🟨 Medium` (amber bg), `🟥 Hard` (red bg)
- Font: default Arial (Sheets doesn't support custom font loading per cell; muted palette is what carries the Notion feel)

### Problems tab columns
| Col | Field | Notes |
|---|---|---|
| A | # | LC problem number |
| B | Title | `=HYPERLINK(C, "Title")` |
| C | URL | full leetcode.com URL |
| D | Difficulty | Easy / Medium / Hard, with conditional pill formatting |
| E | Topics | comma-separated tags |
| F | First solved | ISO date |
| G | Last reviewed | ISO date |
| H | Times reviewed | integer |
| I | SRS interval (days) | one of the ladder values |
| J | Next due | computed `=G+I` formatted as date |
| K | Status | `🟢 Active` / `⭐ Mastered` / `📦 Archived` |
| L | Latest confidence | 1–5 |
| M | Notes | **comma-separated accumulation across all solves/reviews** — never overwrites, always appends |

### Stats tab
- **Top row — KPI cards** (merged cells, large font):
  - Current streak (days)
  - Problems this week
  - Total active
  - Total mastered
- **Chart 1**: Problems-solved per day, last 90 days, bar chart
- **Chart 2**: Difficulty mix %, stacked horizontal bar
- **Chart 3**: Weekly avg confidence over time, line chart
- All built via `spreadsheets.batchUpdate` with `addChart` requests
- Underlying data ranges populated by the extension on each sync

### Sync model — write-through, fail loud
- Every solve / review / setting change fires `spreadsheets.values.update` or `.append` immediately
- On failure: red badge on extension icon (`chrome.action.setBadgeText`) + popup banner showing the error
- **No silent retry queue** — per user choice
- "Retry sync" button in popup re-pushes the last failed write

## Onboarding wizard (opens on install)

3 steps, ~60 seconds:

1. **Connect Google** — single button → OAuth flow → on success, create the spreadsheet (Notion-styled template)
2. **Set quota** — slider 1–5 problems/day, default 1
3. **Confirm blocklist** — default 11 sites pre-checked, uncheck any, add custom via text input. "Done" closes the wizard.

After finish: popup opens automatically with `"✅ You're ready"` and a `"Import LeetCode history"` button (optional, user can skip).

## Settings (options page)

- Daily quota (1–5)
- Blocklist add/remove
- SRS interval ladder (advanced — edit the array `[1,3,7,14,30]`)
- Emergency override: enable/disable, count per day (default 1), duration (default 10 min), passphrase (default "I am being weak")
- Quota reset hour (default 03:00 local)
- Google Sheet: reconnect, open URL, force re-sync, change spreadsheet
- Setting: "Separate review quota from new-solve quota" (default off) — when on, user has both an `N reviews/day` and `M new solves/day` target
- Reset all data (with confirmation dialog)

## Storage schema (`chrome.storage.local`)

```js
{
  settings: {
    dailyQuota: 1,
    splitReviewQuota: false,
    reviewQuota: 0,
    newSolveQuota: 1,
    intervalLadder: [1, 3, 7, 14, 30],
    blocklist: ["youtube.com", "instagram.com", /* ... */],
    overrideEnabled: true,
    overrideCountPerDay: 1,
    overrideDurationMin: 10,
    overridePhrase: "I am being weak",
    sheetId: "abc123...",
    quotaResetHour: 3
  },
  state: {
    quotaResetAt: "2026-06-04T03:00:00-04:00",
    solvesToday: 0,             // counts reviews + new solves combined (default mode)
    reviewsToday: 0,            // tracked separately for stats
    newSolvesToday: 0,          // tracked separately
    overrideUsedToday: 0,
    overrideActiveUntil: null,  // ISO timestamp or null
    streakDays: 0,
    streakLastUpdated: "2026-06-03",
    lastSyncError: null,
    needsRatingQueue: []        // detected but unrated submissions
  },
  problems: {
    "two-sum": {
      number: 1,
      title: "Two Sum",
      url: "https://leetcode.com/problems/two-sum/",
      difficulty: "Easy",
      topics: ["Array", "Hash Table"],
      firstSolved: "2026-06-01",
      lastReviewed: "2026-06-03",
      timesReviewed: 3,
      srsIntervalDays: 7,
      status: "Active",
      latestConfidence: 4,
      notes: "Use hashmap, O(n), edge case empty arr"
    }
  },
  problemCatalog: {
    fetchedAt: "2026-06-01",
    items: [ /* {slug, number, title, difficulty, topics} ... */ ]
  }
}
```

## Verification

End-to-end test plan after implementation:

1. **Load extension**: `chrome://extensions` → Load unpacked → select folder → onboarding tab opens.
2. **OAuth**: Click Connect Google → grant scopes → verify a new sheet was created with both tabs and Notion styling.
3. **Block engages**: With `solvesToday = 0`, open youtube.com → redirects to block page showing "1 problem left today", progress bar at 0%, daily challenge + 1 random problem suggested.
4. **Detection**: On leetcode.com, solve any Easy → after "Accepted", inline overlay appears within 2s. Rate confidence 4, type a note, save.
5. **Sheet write-through**: Immediately check the sheet — Problems tab has the new row with the note. Turn off Wi-Fi, solve again → red badge on icon, popup banner shows sync error.
6. **Block lifts**: With quota satisfied, reload youtube.com → loads normally.
7. **Override**: Manually clear `solvesToday`, try youtube.com → block page → click override → modal → type "I am being weak" → unblock for 10 min. Counter persists.
8. **Review surfacing**: Manually set a problem's `nextDue` to yesterday → reload popup → review queue shows it. Reload leetcode.com → inline banner appears.
9. **SRS ladder**: Solve fresh problem → interval = 1d. Review without flag → 3d. Review again without flag → 7d. Toggle "need review" on next review → stays at 7d.
10. **Mastery**: Toggle Mastered on a problem from popup → disappears from review queue, status updates in sheet to `⭐ Mastered`.
11. **Streak**: Solve quota two consecutive days → streak = 2. Skip a day → next 03:00 reset → streak = 0.
12. **History import**: Click "Import history" → all past LC solves appear in sheet as `⭐ Mastered`.
13. **Manual entry**: Popup → Log a problem → autocomplete works → entry shows up in sheet.

## Out of scope (v1)

- Firefox / Edge support
- LeetCode mobile / cross-browser solve detection (manual entry only)
- Multi-device local-state sync (the Sheet is the cross-device mirror; local state isn't synced)
- Apps Script triggers on the sheet side
- AI-powered problem analysis or topic suggestions
- Two-way settings sync (sheet → extension)
