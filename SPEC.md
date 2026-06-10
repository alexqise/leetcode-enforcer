# LeetCode Enforcer v2 — Rebuild Spec

> **Status (2026-06-10): shipped.** The rebuild described below is complete and
> promoted to the repo root — `v2/` paths in this document now read as `./`.
> v1 was retired in the same commit series. Kept as the record of what was
> decided and why; §7's credential-dependent checks run in daily use.

Greenfield rebuild of the extension in `v2/` as a Vite + React + TypeScript project.
UI is rebuilt from scratch; the engine is ported file-by-file and typed during the port.
v1 at the repo root stays loadable and untouched until v2 reaches parity.

Decided 2026-06-09 via interview. PRODUCT.md (strategy) and design.md (visuals) continue to govern.

---

## 1 · Tech stack (locked)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **React 19** | All five surfaces + the LC overlay |
| Language | **TypeScript, strict** | Engine files typed *during* the port, not after |
| Build | **Vite + @crxjs/vite-plugin** | Reads manifest, bundles SW/content scripts, HMR for extension pages. Pin versions; if crxjs breaks on a Vite major, fall back to manual multi-entry |
| Styling | **Tailwind v4** with dusk-signal tokens via `@theme` | Banner SVG scenes and other art stay handwritten CSS/SVG |
| State | **Custom hooks only** | `useStorage(key)` subscribed to `chrome.storage.onChanged` + typed `sendMessage` RPC. No state library |
| Package manager | **bun** | |
| Lint/format | **Biome** | One tool, minimal config |
| Tests | **Vitest, pure logic only** | SRS ladder math, streak/03:00-reset edge cases, message protocol types. No UI tests |

## 2 · Architecture

```
v2/
  manifest.json          ← v1 manifest ported; SAME "key" field (critical, see §6)
  vite.config.ts
  src/
    messages.ts          ← discriminated-union message protocol; single source of truth
                           for every chrome.runtime.sendMessage type + response shape
    background/          ← service worker (ported from v1, typed)
    engine/              ← lib ports: storage, srs, stats, blocklist, oauth,
                           supabase, github, leetcode_api  (all → .ts)
    content/
      inject.ts          ← MAIN-world fetch monkey-patch — stays a tiny plain script,
                           no React, document_start (port verbatim, then type)
      overlay/           ← React root mounted in a closed Shadow DOM on leetcode.com
    surfaces/
      block/  popup/  options/  onboarding/  viewer/   ← one HTML entry + React root each
    components/          ← shared: Dialog, StreakChip, SegmentedBar, DueRow,
                           SectionLabel, Skeleton, BannerScene
    styles/
      tokens.css         ← dusk-signal custom properties (mirrored into Tailwind @theme)
```

**Message protocol.** Every background interaction goes through `messages.ts`:
a `Msg` discriminated union (`{ type: 'getStatus' } | { type: 'startOverride', phrase: string } | …`)
with a mapped `MsgResponse<T>` type and one typed `send()` helper. This is the
single biggest correctness win of the rebuild — no stringly-typed RPC anywhere.

## 3 · Engine port inventory (from v1)

Port + type (≈2,300 lines total):

- `background/service_worker.js` — blocking (declarativeNetRequest), quota/state,
  daily 03:00 reset alarms, streak, message router, sync orchestration
- `lib/storage.js` → `engine/storage.ts` — settings/state defaults + accessors
- `lib/srs.js` — interval ladder logic *(gets Vitest coverage)*
- `lib/stats.js` — computeStats (imported by SW; alive)
- `lib/blocklist.js` — domain rules
- `lib/oauth.js` — Google sign-in via `chrome.identity.launchWebAuthFlow`
- `lib/supabase.js` — the live sync backend
- `lib/github.js` — PAT + device-flow OAuth, per-solve commits (kept; strict parity)
- `lib/leetcode_api.js` — daily challenge / random / history / login status
- `content/leetcode_inject.js` — fetch monkey-patch (most fragile file; port verbatim,
  type minimally, do not restructure)
- `content/leetcode_content.js` — rebuilt as the Shadow-DOM React overlay

**Left behind:** `lib/sheets.js` (zero importers — dead), all Sheets references in copy.
README's Sheets documentation is stale and gets rewritten at promotion time (§6).
`lib/dialog.js` is superseded by the shared React `<Dialog>` component.

## 4 · Surfaces

Parity bar: **everything ships before the flip** — block, popup, options, onboarding,
viewer, LC overlay. Strict behavior parity except where noted.

- **Block** — port of the just-shipped v1 design: banner scene, open hero, two-column
  grid, title-as-link daily challenge, open review rows, override footer + phrase modal.
- **Popup** — same content model as v1 (progress, review queue capped at 8, log-a-problem,
  footer links), restyled to dusk-signal with shared components.
- **Options** — same settings cards model, dusk-signal skin, shared Dialog for all confirms.
- **Onboarding** — **rework (same steps, tighter execution):** connect → quota → blocklist
  order stays, but rebuilt properly: visible step progress, per-step skip paths,
  real error states (OAuth failure, offline), and a sunrise-variant banner scene.
- **Viewer** — **rethink while rebuilding:** review-queue-first dashboard as the landing
  view (what's due now, streak, stats), with the full Linear-style problem table as the
  second view. Table keeps v1's iterated interaction patterns (reserved-space sort
  indicators, 3-state filter chips, expanding notes/topics, ⌘K search).
- **LC overlay** — React in a closed Shadow DOM: confidence 1–5, notes,
  need-review/mastered toggles on Accepted verdict. React loads only on leetcode.com.

## 5 · Design direction

- **Palette:** dusk-signal (design.md §2) — warm plum-black neutrals, primary `#FF6F3C`,
  secondary `#97A3FF`. v2 is born on it; no legacy lime anywhere.
- **Type:** **Figtree** (UI face, weights 400/500/600/700) + **JetBrains Mono** (numerals,
  dates, intervals, code). Self-host via `@fontsource` — extension pages must not
  depend on Google Fonts at runtime.
- **Banner scenes:** block (dusk, existing composition) + onboarding (sunrise variant —
  same geometry, dawn gradient). Popup/options/viewer stay clean tool surfaces.
- **Principles carried from design.md:** open content over boxes; motion conveys state
  only (no load choreography); segmented quota bars; title-as-link primary actions;
  no native dialogs; WCAG AA contrast floor; no emojis — inline SVG icons.
- design.md gets a v2 section when the first surface lands; component patterns migrate
  from prose+CSS recipes to actual shared React components.

## 6 · Migration & identity (the part that must not be botched)

1. **Copy the `"key"` field** from v1 `manifest.json` into v2's manifest → identical
   extension ID → same `chrome.storage.local` (all problems/streak/tokens survive) and
   same OAuth redirect URI (`https://<ID>.chromiumapp.org/`) → zero GCP/Supabase changes.
2. Develop with v1 loaded; verify v2 via `bun run build` → load `v2/dist` unpacked
   (swap which one is enabled — never both at once, they'd fight over blocking rules).
3. Flip when all §4 surfaces pass the §7 checklist. Run v2 for a few days.
4. **Promote:** delete v1 root files, move `v2/` contents to repo root, rewrite README
   (Supabase reality, bun workflow), update CLAUDE.md (retire "vanilla JS / no bundler"
   rule, point at v2 conventions).

## 7 · Verification checklist (manual, one-time — ported code should behave identically)

- [ ] Block redirect fires on a blocklisted site; block page renders with real data
- [ ] Accepted submission on leetcode.com → overlay appears → save → quota increments → block lifts
- [ ] Override phrase flow (count decrements, timer expires, re-block)
- [ ] 03:00 reset + streak increment/break logic (Vitest + one manual day-boundary check)
- [ ] Google sign-in (existing token reuse AND fresh sign-in)
- [ ] Supabase write-through on solve/review/manual entry
- [ ] GitHub device flow + PAT connect + per-solve commit
- [ ] History import; daily challenge + random fetch signed-out behavior
- [ ] Onboarding end-to-end as a fresh profile (new chrome profile, no stored state)

## 8 · Build order

1. Scaffold (bun + Vite + crxjs + Tailwind + Biome + Vitest), manifest with copied key,
   CI-less `bun run build` producing a loadable `dist/`
2. `messages.ts` protocol + `engine/` port with types (Vitest on srs/streak as written)
3. Background worker port → extension blocks/unblocks end-to-end with zero UI
4. Block surface (reference implementation of components + tokens)
5. Popup → Options (shared Dialog, forms)
6. LC overlay (Shadow DOM root) — closes the solve-detect loop
7. Onboarding rework → Viewer rethink
8. Verification checklist → flip → soak → promote (§6.4)
