# LeetCode Enforcer

A Chrome (MV3) extension that blocks distracting sites until you solve your daily LeetCode quota. Built-in spaced repetition and private Supabase sync.

## Why

LC problems are expensive (20–40 min each), not 5-second Anki flashcards — so the backlog needs to stay small and the practice needs a real forcing function. This extension uses hard site blocking as that function and surfaces past problems for review at the right time.

## Features

- **Hard block** YouTube, Instagram, TikTok, Reddit, X, Facebook, Snapchat, Netflix, Hulu, Disney+, Twitch (configurable) until you've solved your daily quota
- **Auto-detect** accepted submissions on leetcode.com via a MAIN-world fetch/XHR/WebSocket patch
- **Inline rating overlay** — confidence (1–5), notes, need-review/mastered toggles — rendered in a closed Shadow DOM
- **Spaced repetition** with a configurable escalating ladder (default 1d → 3d → 7d → 14d → 30d)
- **Review surfaces**: block page, popup, queue-first viewer, inline LC banner
- **Supabase sync** — problems, settings, and daily state sync privately to your Google account (PKCE OAuth, row-level security)
- **Optional GitHub sync** — auto-created **private** repo, one commit per accepted submission, code + per-problem README (device-flow OAuth or fine-grained PAT)
- **Emergency override**: limited uses per day, requires typing a deterrence phrase
- **Streak** tracking with a 03:00 local-time daily reset

## Stack

React 19 · TypeScript (strict) · Vite + [@crxjs/vite-plugin](https://crxjs.dev) · Tailwind v4 (dusk-signal tokens via `@theme`) · bun · Biome · Vitest. See `SPEC.md` for the architecture and `design.md` for the design system.

```
manifest.config.ts        crxjs manifest (carries the identity-pinning "key" — never change it)
src/
  messages.ts             typed message protocol — single source of truth for all runtime messages
  background/             MV3 service worker: blocking, quota, alarms, streak, sync orchestration
  engine/                 pure logic: storage, srs, streak, stats, blocklist, supabase, github, leetcode-api
  content/
    inject.ts             MAIN-world submission detector (fragile — do not restructure)
    overlay/              rating overlay + due banner, React in closed Shadow DOM
  surfaces/               block / popup / options / onboarding / viewer — one HTML entry + React root each
  components/             shared dusk-signal components (BannerScene, Dialog, SegmentedBar, …)
  styles/tokens.css       design tokens (Tailwind @theme)
```

## Development

```sh
bun install
bun run build        # production build → dist/
bun run dev          # Vite dev server with extension HMR
bun run typecheck    # tsc --noEmit
bun run lint         # biome check src
bun run test         # vitest (SRS ladder + streak/reset edge cases)
```

Load `dist/` unpacked at `chrome://extensions` (Developer mode → Load unpacked). After a rebuild, press the reload arrow on the extension card — reloads keep `chrome.storage`; removing the extension wipes it.

### Identity & auth (important)

`manifest.config.ts` pins the extension ID via the `"key"` field. That ID determines the OAuth redirect URI (`https://<ID>.chromiumapp.org/`) registered with the Supabase project's Google provider, and it keys all stored user data. **Never change the key.** Sign-in flows through Supabase PKCE OAuth using `chrome.identity.launchWebAuthFlow` — no client secrets live in the extension; the Supabase publishable key is safe to ship because row access is enforced by RLS.

To run against your own backend, create a Supabase project with Google auth enabled and three tables — `problems` (unique on `user_id, slug`), `settings` (unique on `user_id`), `day_state` (unique on `user_id, date`) — all with owner-only RLS, then replace `SUPABASE_URL`/`SUPABASE_KEY` in `src/engine/supabase.ts`.

## Data model

The user is the source of truth: LC auto-detection and history import are convenience helpers, not authoritative. Local `chrome.storage.local` is the working copy; Supabase is the durable copy. Sync is write-through on every solve/review/settings change, and the worker pulls from the cloud on sign-in, on browser startup, and on extension reload. "Force re-sync" in Settings is bidirectional (pull, then push).
