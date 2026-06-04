# Project rules for Claude

## Design work — required reading

**Before touching ANY UI/frontend code (HTML, CSS, anything visual)** read `design.md` at the project root in full. It captures the canonical color palette, typography, spacing scale, component patterns, interaction conventions, and the "no emojis, use icons" rule. Match those tokens and patterns. Don't reinvent.

**After making UI changes that the user has explicitly directed as a design-level shift** (e.g. "switch the accent color", "use more spacing", "no emojis anywhere", "headers should be sentence case", "add multi-select filter pattern"), update `design.md` to reflect the new direction in the relevant section AND append a one-line entry to the Changelog at the bottom dated today.

Don't update `design.md` for one-off bug fixes or content tweaks. Only update when the *guideline itself* changes.

## Surfaces governed by design.md

`design.md` is the source of truth for:
- `viewer1/` (the canonical reference implementation)
- `popup/`
- `options/`
- `onboarding/`
- `block/`

If you're adding a new surface, copy the `:root` token block from `viewer1/viewer.css` so colors and fonts stay consistent.

## Never use emojis

Repeat from `design.md`: emojis in the UI are banned. Replace any `🔥 ⭐ ✓ ✗ 📊 ⚙ 🔍 🟢 🟨 🟥 📚 🎉 🔒` etc. with inline SVG icons (outline style, `currentColor`, `aria-hidden="true"`). Abstract unicode glyphs (`↗ ↑ ↓ ● ★ ◌ № ⌘`) are acceptable but prefer SVG when reasonable.

## Existing project conventions (also active)

- **No auto-commit.** Don't `git commit` unless the user explicitly asks. Leave changes in the working tree.
- **Vanilla JS only.** No React, no bundler, no npm dependencies. This is a Chrome MV3 extension built with native modules.
- **`[hidden]` attribute trap.** When using `display: flex/grid` on an element that toggles visibility via the `hidden` HTML attribute, always include `[hidden] { display: none !important; }` in that file's CSS. Without it, the CSS `display` rule overrides the HTML hidden attribute. This bug has surfaced multiple times during development.
- **Viewport-locked layouts** for full-page surfaces — see `design.md` §7.
