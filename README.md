# LeetCode Enforcer

A Chrome extension that blocks distracting sites until you solve your daily LeetCode quota. Built-in spaced repetition queue and Google Sheets sync.

## Why

LC problems are expensive (20-40 min each), not 5-second Anki flashcards — so the backlog needs to be small and the practice needs a real forcing function. This extension uses hard site blocking as that function and surfaces past problems for review at the right time.

## Features

- **Hard block** YouTube, Instagram, TikTok, Reddit, X, Facebook, Snapchat, Netflix, Hulu, Disney+, Twitch (configurable) until you've solved your daily quota
- **Auto-detect** accepted submissions on leetcode.com via fetch monkey-patch (MAIN-world)
- **Inline rating overlay** — confidence (1-5), notes, need-review/mastered toggles
- **Spaced repetition** with a fixed escalating ladder: 1d → 3d → 7d → 14d → 30d
- **Three review surfaces**: block screen, popup, inline LC banner
- **Google Sheets sync** — Notion-styled spreadsheet, write-through, fail loud
- **Optional GitHub sync** — auto-created **private** repo, one commit per accepted submission, code + per-problem README
- **Emergency override**: 1/day, 10 min, requires typing "I am being weak"
- **Strict streak** tracking with 03:00 local-time daily reset

## Installation (development)

### 1. Set up Google OAuth credentials

The extension uses `chrome.identity` to talk to Google Sheets. You need to register your own OAuth client.

1. Open https://console.cloud.google.com/
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API**
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
5. Application type: **Chrome Extension**
6. You will need this extension's unpacked ID to register the OAuth client. To get it:
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** → select this folder
   - Copy the generated extension ID (long alphanumeric string)
7. Paste the ID into the OAuth client form, save
8. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`)
9. Open `manifest.json` and replace `REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com` with your real client ID
10. Back at `chrome://extensions`, click the reload icon on the LeetCode Enforcer card

### 2. Add icons

Drop your icon PNGs in `icons/`:
- `icon-16.png`
- `icon-48.png`
- `icon-128.png`

The extension will still load without icons; Chrome shows a default puzzle piece.

### 3. First run

After loading the extension, the onboarding wizard opens in a new tab:
1. **Connect Google** — OAuth grants access to Sheets, creates a new spreadsheet for you
2. **Set quota** — slider 1-5 problems/day (default 1)
3. **Confirm blocklist** — uncheck any you don't want, add custom sites

After finishing, the popup opens with an optional "Import LeetCode history" button. Make sure you are logged into leetcode.com in the same browser for history import and daily-challenge fetching to work.

### 4. Optional — connect GitHub (push code to a private repo)

Each accepted submission pushes the code + a per-problem README as a single commit to a **private** repo. The repo is auto-created on first connect.

1. Create a fine-grained PAT at https://github.com/settings/tokens?type=beta
2. Repository access: **All repositories** (or **Only select repositories** if you're picky — but the extension needs to create the repo on first use, which requires All-repos for `Administration: write`)
3. Permissions (Repository):
   - **Administration**: Read and write (needed to create the repo)
   - **Contents**: Read and write (needed to push commits)
   - **Metadata**: Read-only (granted automatically)
4. Paste the token into the GitHub section of the onboarding final step, or any time later from the options page
5. (Optional) Customize the repo name — default is `leetcode-enforcer-solutions`

The PAT is stored in `chrome.storage.local`, only visible to this extension. Disconnect anytime from options to delete the token locally — the repo and its history are untouched.

#### Repo layout

```
leetcode-enforcer-solutions/
├── 0001-two-sum/
│   ├── solution.py
│   └── README.md
├── 0002-add-two-numbers/
│   ├── solution.cpp
│   └── README.md
└── …
```

Each commit message: `Solve 1. Two Sum [Easy] · 4/5`. The per-problem README lists difficulty, topics, first solved date, accumulated notes, current SRS state, and confidence.

Manual entries and imported history are not pushed (no code captured). Multiple languages on the same problem produce `solution.py` and `solution.cpp` etc. side by side; resubmitting in the same language overwrites that file.

## Daily flow

1. Open a blocked site → redirected to the block page
2. Block page shows: progress, daily challenge link, 1 random problem, top reviews due, your streak
3. Click a problem → solve on LC
4. After "Accepted" verdict → inline overlay appears: rate confidence, optionally take notes, save
5. Block lifts when `solves today >= quota`
6. Override available once per day (10 min, requires typing "I am being weak")

## Spreadsheet structure

Two tabs in the auto-generated sheet:

### Problems
One row per unique problem with current SRS state. Notes accumulate (comma-separated) across all solves/reviews — never overwritten.

### Stats
- KPI cards: streak, problems this week, total active, total mastered
- Bar chart: problems solved per day (last 90 days)
- Stacked bar: difficulty mix (Easy/Medium/Hard %)
- Line chart: weekly avg confidence over time

## Spec

See `SPEC.md` for the full design document.

## Out of scope (v1)

- Firefox / Edge support
- LeetCode mobile / cross-browser solve detection
- Multi-device local-state sync
- Two-way settings sync (sheet → extension)
