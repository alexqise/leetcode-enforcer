# Project rules for Claude

## Design work — required reading

**Before touching ANY UI/frontend code (TSX, CSS, anything visual)** read `design.md` at the project root in full. It captures the canonical color palette (dusk-signal), typography, spacing scale, component patterns, interaction conventions, and the "no emojis, use icons" rule. Match those tokens and patterns. Don't reinvent.

**After making UI changes that the user has explicitly directed as a design-level shift** (e.g. "switch the accent color", "use more spacing", "no emojis anywhere", "headers should be sentence case", "add multi-select filter pattern"), update `design.md` to reflect the new direction in the relevant section AND append a one-line entry to the Changelog at the bottom dated today.

Don't update `design.md` for one-off bug fixes or content tweaks. Only update when the *guideline itself* changes.

## Surfaces governed by design.md

`design.md` is the source of truth for every surface under `src/surfaces/` — `block` (the canonical reference implementation), `popup`, `options`, `onboarding`, `viewer` — and the leetcode.com overlay in `src/content/overlay/`.

The shared components in `src/components/` are the canonical implementations of the documented patterns (BannerScene, SegmentedBar, DueRow, Dialog, …) — use them instead of re-implementing. Tokens live in `src/styles/tokens.css` as a Tailwind v4 `@theme`; a new surface imports that file and gets the full system. The Tailwind default palette is deliberately wiped — if a color utility doesn't exist, that's the design system telling you to use a token.

## Never use emojis

Repeat from `design.md`: emojis in the UI are banned. Replace any `🔥 ⭐ ✓ ✗ 📊 ⚙ 🔍 🟢 🟨 🟥 📚 🎉 🔒` etc. with inline SVG icons (outline style, `currentColor`, `aria-hidden="true"`) — see `src/components/icons.tsx`. Abstract unicode glyphs (`↗ ↑ ↓ ● ★ ◌ № ⌘`) are acceptable but prefer SVG when reasonable.

## Stack & conventions

- **React 19 + TypeScript strict + Vite/crxjs + Tailwind v4, managed with bun.** Run the gates after changes: `bun run typecheck && bun run lint && bun run test && bun run build`. Biome owns formatting (`bunx biome check --write src`).
- **No auto-commit.** Don't `git commit` unless the user explicitly asks. Leave changes in the working tree.
- **Never change the `"key"` field in `manifest.config.ts`.** It pins the extension ID, which keys all user data and the OAuth redirect URI registered with Supabase/GCP. Changing it bricks sign-in and orphans user storage.
- **All runtime messaging goes through `src/messages.ts`.** Add new message types to the `Msg` union and `MsgResponses` map; never call `chrome.runtime.sendMessage` with an ad-hoc shape.
- **`src/engine/` stays UI-free** — pure logic plus Chrome storage/network APIs, importable by the worker and any surface. New testable logic (date math, SRS, merge rules) belongs there with Vitest coverage.
- **`src/content/inject.ts` is fragile.** It's the verbatim-ported MAIN-world submission detector. Don't restructure it without re-verifying solve detection on leetcode.com.
- **The LC overlay can't use Tailwind.** It renders in a closed Shadow DOM; styles are handwritten dusk-signal CSS inside the shadow root, system font stack (extension font assets don't resolve from page-injected CSS).
- **Supabase schema is what's live, not what's pretty**: tables `problems`, `settings`, `day_state` (with a `date` column). The names are verified against the running project — v1 died on assumed names; probe before assuming.
- **`[hidden]` attribute trap.** When using `display: flex/grid` on an element that toggles visibility via the `hidden` HTML attribute, keep the global `[hidden] { display: none !important; }` guard (it lives in `tokens.css`). Without it, the CSS `display` rule overrides the HTML hidden attribute. This bug has surfaced multiple times during development.
- **Viewport-locked layouts** for full-page surfaces — see `design.md` §7.
