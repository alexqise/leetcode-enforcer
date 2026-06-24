# LeetCode Enforcer — Design Guidelines

The canonical source for all UI work in this extension. Based on the viewer (`viewer1/`) which was iterated to a Linear-inspired, refined dark aesthetic. Every surface (popup, options, onboarding, block screen, viewer) should align with these tokens and patterns.

When a user asks for UI changes, **read this file first**. When the user gives a clear design direction change ("more breathable spacing", "switch the accent to violet", "no emojis anywhere"), **update this file after applying the change** so it stays the single source of truth.

---

## 1 · Core principles

1. **Rationed accent, two roles.** The UI carries two accent colors — **primary** signal orange `#FF6F3C` and **secondary** periwinkle `#97A3FF` — on a warm plum-black neutral scale. Primary marks the user's way forward: progress fill, the hover state of the one primary action, focus rings, the brand dot, the done-state numeral. Secondary marks reference/recall material: review intervals, secondary-link hovers, and the banner sky family. Neither appears on default text, container backgrounds, or resting buttons. The neutral scale still carries 95% of the UI. (Replaces the single acid-lime accent, 2026-06-09.)
2. **No emojis. Use icons.** Replace `🔥`, `📊`, `⚙`, `🔍`, `★`, `●` etc. with inline SVGs (16-18px stroke icons) or unicode glyphs at carefully chosen sizes. Emojis look unprofessional, render inconsistently across systems, and break the "designed" feel. The status mark icons `●`, `★`, `◌` are acceptable because they are abstract geometric glyphs, not full-color emojis — but prefer inline SVG when introducing new icon affordances.
3. **Quiet density.** Linear-style. Headers are 12px, body is 13px, cells use 18px vertical padding (12px in compact mode). Generous horizontal padding (24-32px). Borders are hairline (1px) and use the `--border` token so they whisper.
4. **No layout shift on interaction.** Sort indicators always reserve their space (38px right padding on sortable headers, absolutely positioned glyph). Filter chips don't change height when toggled. Search field height fixed. Table row height stays constant unless the user explicitly clicks an "expand" affordance.
5. **Viewport-locked, never page-scrolling.** Apps use `height: 100vh` + `overflow: hidden` on body. Scrolling happens inside designated regions (`.table-wrap`, `.filters`) only.
6. **Soft-black, not pure-black.** Background is `#131316` — a slight warm off-black. Pure `#000000` is too harsh.
7. **Open content over boxes.** Page content is not wrapped in bordered cards by default. Hierarchy and grouping come from the spacing scale, section labels, and type weight; hover states may tint the background (with a small negative-margin bleed) without resting borders. Boxes are reserved for true containment: modals, inputs, and the rare element that floats above other content. One structural hairline (e.g. the footer `border-top` separating the emergency override) is allowed per page; lists do not get per-row borders.
8. **Motion conveys state, never decorates.** No entrance/stagger choreography on page load — surfaces appear instantly, fully composed (the user is mid-task or mid-interruption; don't make them watch the UI arrive). No ambient/idle animation: pulsing dots, shimmer loops, background glow ellipses. Transitions exist for state change and interaction feedback only (hover, progress fill, modal open), 100–250ms, ease-out. Skeleton pulse during loading is allowed (it conveys "in progress") and must go static under `prefers-reduced-motion`.

---

## 2 · Color tokens

All colors live in `:root` as CSS custom properties.

**Canonical palette: "dusk-signal" (2026-06-09).** Warm plum-black neutrals + a two-accent system. The block page is the reference implementation; popup, options, viewer, and onboarding still carry the legacy lime/cool-black values and migrate the next time each is touched.

### Surfaces (4-step hierarchy, warm plum-tinted)
```
--bg:           #161216   /* canvas — page background */
--surface:      #1D181D   /* hover tint for list rows, modal bg, inputs-on-modal */
--surface-2:    #251F25   /* subtle elevation, chip default */
--surface-3:    #2F272E   /* progress-segment track, active chip bg */
```

### Borders (hairline)
```
--border:       #2B242B   /* structural hairlines (footer rule), input borders */
--border-2:     #3B323A   /* hover border, modal border, "next" progress segment */
```

### Text (3-step hierarchy + faint)
```
--fg:           #F0EDEA   /* primary content — titles, numerals, active text */
--fg-2:         #ADA6A6   /* secondary content — labels, body, placeholders */
--fg-3:         #8A8386   /* muted — section headings, hints, meta (≥4.5:1 on bg & surface) */
--fg-4:         #3E3840   /* faint — decorative only (resting arrow affordances), never text */
```

**Contrast floor:** any text the user is meant to read must hit ≥4.5:1 against its surface. Placeholders use `--fg-2`, not `--fg-3` — a placeholder is an instruction, not decoration.

### Accents (two roles — see principle 1)
```
--primary:       #FF6F3C                      /* signal orange — the way forward */
--primary-dim:   rgba(255, 111, 60, 0.12)     /* ::selection, soft primary tints */
--secondary:     #97A3FF                      /* periwinkle — recall/reference accents */
--secondary-dim: rgba(151, 163, 255, 0.12)
```

### Status colors (functional, not decorative)
```
--easy:         #57C690   /* Easy difficulty, level-4 confidence */
--medium:       #E2A95B   /* Medium difficulty, level-2/3 confidence, streak flame */
--hard:         #EF6F6C   /* Hard difficulty, destructive actions, errors */
--mastered:     #E8C847   /* Mastered status icon (legacy value, retune on migration) */
```

Easy/Medium/Hard colors are MUTED, not vibrant — desaturated so lists don't look like a Christmas tree.

### Legacy palette (pre-2026-06-09)
Cool-black neutrals (`--bg #131316`, `--fg #E8E9EE`, `--fg-3 #7E828E`, borders `#26272F`/`#34353F`) with single acid-lime accent `--acc #B4F500`. Still live in `popup/`, `options/`, `viewer1/`, `onboarding/`; replace with the dusk-signal tokens above when those surfaces are next touched. Lime's former jobs split: progress/focus/active → `--primary`; informational accents → `--secondary`.

---

## 3 · Typography

### Fonts (self-hosted via @fontsource — extension pages never load fonts from the network)
- **One face everywhere: Figtree** (variable, weights 400–700), `'Figtree Variable', system-ui, -apple-system, sans-serif`.
- **Mono is retired** (2026-06-10, user-directed): numerals, dates, intervals, counts, and code-ish content all render in Figtree. Weight and color carry the distinction that the second face used to. The `--font-mono` token still exists but resolves to Figtree so stray utilities can't reintroduce a system mono. The LC overlay (shadow DOM) keeps the system font stack.

### Sizes
| Use | Size | Weight | Letter-spacing |
|---|---|---|---|
| Page title / brand text | 14px | 600 | -0.018em |
| Body cell (default) | 13px | 400 | -0.005em |
| Title cell link | 13px | 500 | -0.008em |
| Header cell | 12px | 500 | -0.005em |
| Button label | 12px | 500 | -0.003em |
| Filter chip | 12px | 500 | -0.003em |
| Section heading (h3) | 11px | 600 | -0.005em |
| Topic chip / status pill | 11px | 500 | -0.003em |
| Count badge, status bar | 11px | 400 | 0 |
| Notes preview | 12px | 400 | -0.003em |
| Sort header (uppercase NO) | 12px | 500 | -0.005em (uppercase off) |

**Never use** `text-transform: uppercase` on data labels. Section headings stay sentence case ("Status", not "STATUS"). Linear's headers are sentence case at 12px.

**Negative letter-spacing** is a Linear hallmark — tightens type at small sizes. Bigger text gets more negative (-0.018em on 14px display), body gets less (-0.005em on 13px).

---

## 4 · Spacing — 8pt grid

All spacing is a multiple of 4 (preferred multiples of 8). Use `--r-sm` / `--r` / `--r-lg` for radii.

```
--r-sm: 4px
--r:    6px
--r-lg: 8px
```

### Component spacing
- **Toolbar height:** 68px
- **Toolbar horizontal padding:** 32px (24px at narrower breakpoints)
- **Inter-group gap (toolbar):** 24px
- **Filter sidebar width:** 288px
- **Filter sidebar padding:** 32px vertical, 28px horizontal
- **Filter-section gap:** 40px
- **Filter-chip height:** 30px, gap 6px
- **Table cell padding:** 18px / 24px (compact: 12px / 24px)
- **Table first/last cell edge padding:** 32px
- **Status bar height:** 40px, padding 32px horizontal, gap 20px between items
- **Status bar items:** small dot + count + label (use `--easy`/`--acc`/`--hard` for dot)

---

## 5 · Component patterns

### 5.1 — Table header with sort indicator (reserved-space pattern)
**Rule:** Sortable column headers reserve a fixed 38px right padding for the sort indicator. The indicator is absolutely positioned. Width never changes between sorted / unsorted / hovered states.

```html
<th data-sort="title">Title</th>
```

```css
th[data-sort] {
  cursor: pointer;
  padding-right: 38px;
  position: relative;
}
th[data-sort]::after {
  content: '';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 12px;
  opacity: 0;
  background-image: url("data:image/svg+xml;utf8,<chevrons-up-down svg/>");
}
th[data-sort]:hover::after { opacity: 1; }  /* hint on hover */
th[data-sorted]::after { opacity: 1; }       /* full on sorted */
th[data-sorted="asc"]::after { background-image: url("data:image/svg+xml;utf8,<arrow-up svg/>"); }
th[data-sorted="desc"]::after { background-image: url("data:image/svg+xml;utf8,<arrow-down svg/>"); }
```

JS just toggles `data-sorted` attribute — never inserts/removes DOM nodes.

### 5.2 — Filter chips (3-state)
**States:**
- **Neutral** (no class) — when the category's filter Set is empty (no filter applied)
- **`.on`** — chip's value is in the Set
- **`.inactive`** — Set is non-empty but this chip's value is NOT in it (greyed out)

**Behavior:**
- Empty Set = no filter (show all)
- Click first chip → that chip becomes `.on`, all others in the category become `.inactive`
- Click an inactive chip → adds to the set, becomes `.on`
- Click an active chip → removes from set; if set becomes empty, all chips return to neutral
- Categories are independent

**Visual:**
- Neutral: `--surface` bg, `--fg-2` text, `--border` border
- `.on`: `--surface-3` bg, `--fg` text, `--border-2` border, inset 1px box-shadow
- `.inactive`: transparent bg, `--fg-4` text, `--border` border, opacity 0.55

Click handler uses **document-level event delegation** (`document.addEventListener('click', ...)`) so it survives panel rebuilds.

### 5.3 — Title column (single-line ellipsis)
- Min-width 320px, max-width 480px
- Inner span wraps the text: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
- External-link `↗` glyph appears next to text on hover (opacity 0 → 1)
- Full title in `title=` HTML attribute for tooltip access
- Anchor uses `display: inline-flex; gap: 6px; max-width: 100%` so text gets the available width and the arrow lives at the end

### 5.4 — Topics column (nowrap with +N expand)
- Default: `flex-wrap: nowrap`, `overflow: hidden`, max-width 360px
- Show first 3 topics + a `+N more` pill (dashed border, `--fg-3` color, `cursor: pointer`)
- Click `+N` → cell expands inline (`flex-wrap: wrap`, `overflow: visible`), all topics show, the trailing pill becomes a solid "collapse" pill
- Click `collapse` → reverts
- Row height grows only when explicitly expanded
- Each row's expansion state is independent

### 5.5 — Notes column (click-to-expand)
- Min-width 280px, max-width 480px
- Default: single-line ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)
- `cursor: pointer`, hover brightens text from `--fg-3` to `--fg-2`
- Click anywhere on the cell → expands: `white-space: pre-wrap`, `word-break: break-word`, overflow visible
- A small "collapse" chip appears below the expanded text
- Click again to collapse
- Title attribute `title="Click to expand"` hints discoverability

### 5.6 — Brand mark
- **Topbars are wordmark-only** (2026-06-10): the brand is the bold text ("Enforcer" / "Problems") in `--fg`, no glyph beside it — the icon read as a stray button.
- The outlined SVG glyph survives only as the boxed mark on auth gates (§5.10): monochrome, stroke 1.4–1.6, `currentColor`, 18–22px.
- Never colored letters or gradient backgrounds.

### 5.7 — Confidence rendering
- 5 horizontal segments (`.seg`), 12×4px, gap 3px
- Each segment is `.on` if its index ≤ the confidence value
- Active-segment color graduates by max level: 1=hard, 2=medium muted, 3=medium, 4=easy, 5=acc lime
- Empty/null confidence → em-dash in `.muted` color

### 5.8 — Search box (toolbar)
- Width 100% up to 520px max
- Left-padded icon (search SVG, 14×14, `--fg-3`)
- Right-padded `⌘K` `kbd` glyph in `--surface-3` chip
- Border `--border`, on focus → `--border-2` and `--bg-2` background
- Single-line, no spell check, `autocomplete="off"`
- Focus via `⌘K` / `Ctrl+K`, clear and blur via `Esc`

### 5.9 — Buttons

Canonical implementation: `src/components/Button.tsx`. Six variants — `outline`, `ghost`, `primary`, `danger`, `raised`, `raised-danger`.

#### Soft-fill variants (`outline` · `ghost` · `primary` · `danger`)

Borderless soft fills (2026-06-10). No outlined chips on resting buttons; accents never sit on default button faces (principle 1).

| Variant | Rest | Hover |
|---|---|---|
| `outline` | `--surface-2` bg, `--fg-2` text | `--surface-3` bg, `--fg` text |
| `ghost` | transparent, `--fg-2` text | `--surface-2` bg, `--fg` text |
| `primary` | inverted warm-white (`--fg` bg, `--bg` text, semibold) | `#FFFCF7` bg |
| `danger` | soft red tint `rgba(239,111,108,0.14)`, `--hard` text | stronger red tint |

Shared base: `inline-flex`, `rounded-lg` (8px), `px-3.5` (14px) horizontal, `py-[7px]` (~7px) vertical, 13px medium weight, `-0.003em` tracking, 100ms color transition, 8px gap when an icon precedes the label. Use for dialog actions, inline secondary controls, compact/toolbar contexts, and destructive confirms.

#### Raised button (`raised`) — settings primary CTA

A subtle skeuomorphic push button for **page-level primary actions** on the open settings document (and other full-page surfaces when they migrate). Reference: options page — Add, Import history, Authorize/Connect GitHub, Sign in with Google, full-width section CTAs. **Not** for ghost secondary actions (Test, Disconnect, Sign out) or dialog buttons. Page-level destructive actions use `raised-danger` (below); compact/dialog destructive keeps soft-fill `danger`.

**Shape & spacing**
- Corner radius: **10px** (`rounded-[10px]`) — slightly rounder than soft-fill buttons (8px), not fully pill.
- Padding: **14px vertical** (`py-3.5`), **14px horizontal** (`px-3.5` from shared base).
- Width: **content-sized** by default; add `className="w-full"` for standalone section CTAs that should span the content column. Inline pairings (e.g. blocklist input + Add) stay auto-width with `shrink-0`.
- Height is padding-driven (~42px with label) — taller than soft-fill buttons for a substantial click target.

**Typography**
- 13px Figtree, **semibold** (600), `-0.003em` tracking.
- Rest: `--fg-2`. Hover: `--fg`. Optional leading SVG icon at 14px with 8px gap (same as base).

**Surface & lighting**

Depth comes from a **low-contrast vertical gradient** and a **single inset top highlight** — never from CSS borders or outer drop shadows.

```
Rest gradient:   --surface-2  →  --surface     (#251F25 → #1D181D)
Hover gradient:  --surface-3  →  --surface-2   (#2F272E → #251F25)
```

The gradient step is intentionally small (one surface tier, not `surface-3 → bg`) so the face reads soft, not glossy.

**Top rim light (rest / hover):** one inset hairline simulating light from above —
`box-shadow: inset 0 1px 0 0 rgba(240, 237, 234, 0.045)` (4.5% of `--fg`).

**Pressed (active):** swap rim for an inset depth shadow —
`box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.28)`. No outer shadow on active either.

**Explicit bans on raised buttons:**
- **No CSS `border`** — a visible stroke plus inset highlight reads as a double edge.
- **No bottom inset edge** — `inset 0 -1px …` looks like a sub-border.
- **No outer `box-shadow`** — blur always traces `border-radius`; on wide rounded buttons it produces a visible pill-shaped silhouette behind the control. Negative spread only shifts the ghost; it does not remove it. Depth is gradient + top inset only.

**Interaction**
- 100ms `transition-colors` on gradient and text (inherits base). No `translateY` lift on hover or active (§8).
- Focus: global 2px `--primary` `:focus-visible` ring from `tokens.css`.
- Loading: `disabled` + inline `Spinner` in the label slot; never `…` ellipsis.

**CSS recipe (reference)**

```css
.btn-raised {
  border: 0;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.003em;
  color: var(--fg-2);
  background: linear-gradient(to bottom, var(--surface-2), var(--surface));
  box-shadow: inset 0 1px 0 0 rgba(240, 237, 234, 0.045);
  transition: color 100ms ease-out, background 100ms ease-out;
}
.btn-raised:hover:enabled {
  color: var(--fg);
  background: linear-gradient(to bottom, var(--surface-3), var(--surface-2));
}
.btn-raised:active:enabled {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.28);
}
```

#### Raised danger (`raised-danger`) — settings destructive CTA

Same shape, spacing, lighting rules, and interaction as `raised` (§5.9 above). Reference: options **Reset all data**. Muted red tint in the surface hierarchy — not a flat `--hard` fill.

```
Rest gradient:   color-mix(surface-2 88%, hard 12%)  →  color-mix(surface 92%, hard 8%)
Hover gradient:  color-mix(surface-3 85%, hard 15%)  →  color-mix(surface-2 88%, hard 12%)
```

- Text: `--hard` at rest and hover.
- Top rim light: `inset 0 1px 0 0 rgba(239, 111, 108, 0.12)` (12% of `--hard`).
- Active: same inset press shadow as `raised`. Same bans — no border, no outer drop shadow.

#### Legacy `.btn` (viewer1 / pre-v2 CSS surfaces)

Pre-v2 surfaces still reference ghost `.btn` chips: transparent bg, `--border` border, `--fg-2` text; hover `--surface` bg. Height 34px, 14px horizontal padding. Migrate to the React `Button` variants above when those surfaces are touched.

### 5.10 — Auth gate (sign-in screen)
- Full-screen `position: fixed; inset: 0` with `--bg` background
- Centered single column, max-width 440px, padding 40px 32px
- Brand mark icon at top (56×56, `--surface` bg with `--border-2`, contains the outlined glyph in `--fg-2`)
- Headline at 22px, weight 600, letter-spacing -0.02em
- Subhead at 13.5px, `--fg-2`, line-height 1.55, margin-bottom 28px
- Primary CTA: `--fg` bg, `--bg` text (inverted), 11px×20px padding, 14px font, 600 weight, 6px radius
- Error state: 8px×12px padding, `rgba(242,111,111,0.08)` bg, `rgba(242,111,111,0.2)` border, `--hard` text

### 5.11 — Settings card
For options/settings surfaces. Each setting group lives in a self-contained card with a clear head/body split.
- Container: `--surface` bg, 1px `--border`, 8px radius, `overflow: hidden`
- **Card head:** padding 18px 22px 12px, bottom border 1px `--border`
  - Title: 13px, weight 600, color `--fg`
  - Subtitle: 12px, color `--fg-3`, line-height 1.5
- **Card body:** padding 16px 22px 18px, `display: flex; flex-direction: column; gap: 12px`
- Rows inside the body use `display: flex; gap: 12px; flex-wrap: wrap` with a left-side `label` of fixed min-width (~180px) and inputs in the remaining space.
- Inline action rows (`.row.inline-actions`) keep the action button + a hint link adjacent.
- A `tag` pill (10px, `--surface-2` bg, `--border`) can sit next to the title to mark "optional" or "beta".
- Danger card variant: red-tinted top gradient + softened red border (`rgba(242,111,111,0.20)`). Hosts the danger-btn variant inside.

### 5.12 — Primary action + demoted alternate
When a surface offers the user a "do this next" choice between a recommended path and a fallback (e.g. daily challenge vs. random problem on the block page), never render them as twin cards with competing CTAs. One clear next step:
- **Primary (canonical, open variant — per principle 7):** no card box, no CTA chip. An open stack inside the page flow: small `--fg-3` label ("Daily challenge") → the problem **title as the link** (19–21px, weight 600, `--fg`) with a trailing arrow SVG (`--fg-4` at rest) → muted meta line. On hover the title and arrow turn `--primary` and the arrow nudges +3px right. The whole stack is one anchor. Never a solid-color button chip for a navigation action.
- **Alternate:** a plain text row beneath — `--fg-3` lead-in ("or try a random one:"), `--fg-2` link (hover `--secondary`) with a small ↗ SVG. Keep the link's trailing words + arrow in a `white-space: nowrap` span so the arrow never wraps alone.
- **Compact surfaces (popup):** the bordered-card variant with a CTA chip is still acceptable where the open stack lacks room to breathe; prefer migrating to the open variant when touched.

### 5.13 — Earned numeral hero
A large display number (64–88px, weight 600, letter-spacing ~-0.035em) is allowed **only when the number is the page's answer** — e.g. "how many problems until the block lifts". It is solid `--fg`; switch to solid `--primary` only for the zero/done state. Never gradient-filled (`background-clip: text` is banned), never haloed, never decorative stat-card filler. Baseline-align an 18–20px `--fg-2` label beside it; mono sub-line below. The hero sits as open content (no panel/box).

**Quota progress is always a segmented bar** — one segment per problem (`--primary` solved, `--border-2` current target, `--surface-3` remaining), 4–6px tall, 3–4px gaps, pill radius. Never a continuous percentage fill; the quota is a count of discrete solves and the bar should read as one.

### 5.14 — Open list rows
Short lists (≤ ~5 rows: reviews due, recent items) use open rows, not bordered row-cards and (per principle 7) not per-row hairlines: rows separated by vertical padding alone (~9px each side), hover = `--surface` bg tint with a small negative-margin bleed and `--r` radius. Lead with a 6px status dot when rows carry difficulty/status; trailing meta in mono (`--secondary` for recall data like review intervals, with the difficulty word in its muted status color). Empty state is a plain `--fg-3` sentence, no dashed placeholder box. (Hairline-separated rows remain in the popup until its migration.)

### 5.15 — Banner cover (Notion-style page header)
Full-bleed decorative header for full-page surfaces that need identity (the block page is the reference). Rules:
- **Inline SVG scene, never a raster asset** — ships offline, zero requests, crisp at any DPI. The block page's scene: dusk-sky `linearGradient` (deep indigo `#1B1733` → mauve → `#74404F` at the horizon), a `--primary` sun disc with a soft radial glow, three layered ridge silhouettes darkening toward the foreground (front ridge near `--bg`), sparse 1–1.5px periwinkle stars, two thin `--secondary` contour strokes, and a `feTurbulence` grain rect at ~5% opacity.
- **Geometry:** `viewBox="0 0 1440 232"`, height 232px desktop / 176px mobile, `preserveAspectRatio="xMaxYMax slice"` so the focal sun survives narrow viewports and the horizon stays anchored on wide ones. **No bottom border** — the scene's foreground ridge sits near `--bg` so the banner dissolves into the page; the composition ends the header, not a line.
- **Topbar floats over the art** (absolute, full width): brand in near-white, and any chip on imagery uses the glass treatment — `rgba` dark fill + 1px `rgba(255,255,255,0.14)` border + `backdrop-filter: blur(6px)`. Glass is allowed *only* here (legibility over imagery), never on flat surfaces.
- Content below starts as open flow (no overlap panel). Scene composition may vary per surface, but stays in the palette's hue family and stays **static** — no parallax, no ambient animation (principle 8).

### 5.16 — Modal (confirmation / destructive action)
For the override modal and other gated confirmations.

**Never use native `alert()` / `confirm()`** — they're unstyled, blocking, and unreliable inside extension popups. For simple confirm/notice dialogs, import `confirmDialog` / `noticeDialog` from `lib/dialog.js` (implements this pattern; requires the `.dlg-*` styles block in the surface's CSS). Destructive confirms pass `danger: true` — red mark, red primary, and initial focus lands on Cancel so Enter can't destroy data. Redundant success dialogs are noise: when the UI itself re-renders to show the new state (e.g. "Connected as X" status row), don't also announce it.
- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000`
- Card: `--surface` bg, 1px `--border-2`, 12px radius, padding 24px, max-width 440px, shadow `0 24px 64px rgba(0,0,0,0.5)`
- **Head row:** small mark icon (32×32, tinted by intent — `--medium` for warning, `--hard` for destructive) + title (16px, weight 600, letter-spacing -0.015em)
- **Body:** 12.5px, `--fg-2`, line-height 1.55
- For phrase-confirm modals: render the phrase in a `<code>` block at 12.5px in mono on `--bg` bg, followed by a mono-font input for the user to retype. **The phrase must be typed by hand** — the `<code>` is `select-none` (and cancels `copy`) and the input cancels `paste`/`drop`. Copy-paste would collapse the deliberate friction these modals exist to impose.
- **Actions row:** right-aligned ghost + primary button pair. Primary button uses `--hard` bg with `--bg` text when the action is destructive.
- Error text: 11.5px, `--hard`, `min-height: 16px` so the layout doesn't shift when an error appears.

---

## 6 · Icons (NEVER emojis)

**Rule: never use emoji characters in the UI.** Use inline SVG icons. Acceptable exception: geometric unicode glyphs that read as abstract shapes, not emojis (`↗`, `↑`, `↓`, `●`, `★`, `◌`, `№`) — and even those should be replaced with SVGs when possible.

**Banned glyphs:** 🔥 📊 ⚙ ✓ ✗ 🎯 🔍 🔒 📚 🟢 🟨 🟥 🎉 ⭐ etc.

When introducing a new icon affordance:
1. Pick an outline-style icon (Lucide / Tabler / Heroicons-outline)
2. Inline as SVG with `currentColor` so it picks up parent color
3. Standard sizes: 13–14px in buttons, 16px in headers, 18–22px in marks
4. Stroke width 1.4 for small (≤14px), 1.6 for medium (16–20px), 1.8 for larger
5. Set `aria-hidden="true"` if the SVG is decorative (label text carries the meaning)

Example pattern:
```html
<button>
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path d="..." stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </svg>
  Filter
</button>
```

---

## 7 · Layout primitives

### Viewport-locked app shell
Every full-page extension surface (viewer, options) uses this pattern:
```css
html, body { height: 100%; overflow: hidden; overflow-anchor: none; }
.app {
  display: grid;
  grid-template-rows: <toolbar> 1fr <statusbar>;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}
.table-wrap, .filters {
  overflow: auto;
  overflow-anchor: none;
  min-height: 0;
}
```

Reason: prevents browser scroll anchoring from jumping the page when content reflows (filter clicks, sort changes). Status bar stays glued to the bottom.

### Scroll preservation
When re-rendering rows, capture `scrollTop` of the scroll container before changing innerHTML and restore it after. Filter clicks should not jump the table to the top.

### Hidden scrollbars (horizontal only)
The table allows horizontal scroll via trackpad / shift+wheel / touch, but the horizontal scrollbar is hidden:
```css
.table-wrap::-webkit-scrollbar:horizontal { height: 0; display: none; }
.table-wrap { scrollbar-color: var(--border-2) transparent; }
```

### `[hidden]` attribute behavior
Add a global rule whenever you use `display: flex/grid` on elements that toggle visibility via the `hidden` attribute:
```css
[hidden] { display: none !important; }
```
Otherwise CSS `display` will override the HTML hidden attribute (this has bitten us multiple times).

---

## 8 · Interaction & feedback

- **Hover on row:** subtle bg tint (`--surface`), 80ms transition
- **Hover on header (sortable):** color shifts `--fg-3 → --fg-2`, bg `--surface` tint, sort glyph fades in
- **Active button click:** 100ms color transition. No scale/transform animations.
- **Focus rings:** 2px solid `--acc`, 2px offset, `border-radius: 2px`. Apply via `*:focus-visible`.
- **Loading state on a button:** disable, set `pointer-events: none`, replace label with inline SVG spinner (12-14px, currentColor, animated via `@keyframes spin`). Never use `…` (three dots) as a loading affordance — it doesn't communicate "in progress".
- **No `transform: translateY(-1px)` lift on hover** for table rows or buttons. Causes paint cost and feels Bootstrap-y. Linear doesn't lift things.

### Banned decorative patterns
These read as template/AI styling and are never intentional here:
- **Outer box-shadow on raised buttons** — always traces `border-radius` and creates a pill silhouette on wide CTAs; use inset top highlight + surface gradient only (§5.9).
- **Gradient text** — `background-clip: text` over a gradient. Use a solid color; emphasis comes from weight and size.
- **Accent side-stripes/rails** — `border-left`/`border-right` (or a pseudo-element) wider than 1px as a colored accent on cards, rows, or callouts, including slide-in-on-hover rails. Use full borders, bg tints, or nothing.
- **Decorative background glows** — fixed radial-gradient haze/ellipses behind content. Atmosphere is carried by the surface hierarchy, not painted on.
- **Entrance stagger choreography** — sequential fade-up of sections on load (see principle 8).

---

## 9 · Keyboard shortcuts

- **`⌘K` / `Ctrl+K`** focuses the search input
- **`Esc`** clears search if focused, then blurs
- Document-level listeners; check `e.metaKey || e.ctrlKey` for the modifier

---

## 10 · Code/file conventions

- Vanilla JS modules (no React, no bundler)
- CSS custom properties for all color/spacing tokens — never hardcode hex in component styles
- Render functions return HTML strings, joined with `''` for tbody innerHTML (lightweight, no virtual DOM needed for our data sizes)
- Document-level event delegation for any content that re-renders
- Each surface's CSS is self-contained in its own directory (`viewer1/viewer.css`, `popup/popup.css`)
- New surfaces should copy `viewer1/viewer.css`'s `:root` tokens block to stay consistent

---

## 11 · When to deviate

If you have a real reason to break one of these guidelines (e.g., user explicitly asked for an emoji, or a column genuinely needs to wrap), document the deviation inline as a CSS comment so future readers know it was intentional:
```css
/* Per user request 2026-06-15: keep emoji here for streak fire — they like it */
.streak::before { content: '🔥'; }
```

Then update this design.md to call out the exception under the relevant section.

---

## 12 · Changelog of guideline-level decisions

- **2026-06-04** — Initial document. Captures viewer1's iterated design state. Source palette is the post-color-lift soft-black (`#131316` bg, etc). No-emoji rule established. Multi-state filter chip pattern documented. Reserved-space sort indicator pattern documented.
- **2026-06-04** — Popup, options, and block pages migrated from the legacy Notion-light palette to the Linear-dark guideline. Sentence-case section labels everywhere; all emoji (🔥 ⭐ 🎲 📚 ✓ ✗ 👤 🔐) replaced with inline outline SVG icons. Streak chip standardized: flame SVG (`--medium` color) + mono count, both popup and block pages render it identically. Added §5.11 (Settings card pattern) and §5.12 (Modal pattern) to document the head/body card and the override-confirm modal first introduced in options/block.
- **2026-06-09** — Block page rebuilt to production quality; several guideline-level changes extracted from that work. (1) `--fg-3` lifted `#61656F` → `#7E828E` to meet the new ≥4.5:1 contrast floor for readable text; placeholders moved from `--fg-3` to `--fg-2`; other surfaces adopt on next touch. (2) New principle 7: motion conveys state, never decorates — no load choreography, no ambient animation (the block page's entrance stagger, pulsing brand dot, and shimmer loop were removed). (3) New "Banned decorative patterns" list under §8: gradient text, accent side-rails, decorative background glows, entrance staggers. (4) New patterns: §5.12 primary action card + demoted alternate (daily challenge is now the block page's single primary action; random problem is a text-row alternate), §5.13 earned numeral hero, §5.14 hairline list rows. Modal pattern renumbered §5.12 → §5.15. Streak chip copy standardized to "N-day streak". Popup + options polished to the same guidelines in the same pass: new `--fg-3`/placeholder values adopted, popup quota bar switched from continuous fill to the segmented pattern (now documented in §5.13), popup review queue moved to §5.14 hairline rows, options brand/crumb corrected to "Enforcer / Settings", async buttons standardized on the spinner loading pattern. Hardening pass: all native `alert()`/`confirm()` replaced with `lib/dialog.js` confirm/notice modals (rule added to §5.15), double-submission guards, popup review queue capped at 8 with a "View all" escape hatch, search empty/race states handled.
- **2026-06-09 (later)** — User-directed visual redesign, block page first. (1) **New canonical palette "dusk-signal"**: warm plum-black neutrals + two accents — primary signal orange `#FF6F3C`, secondary periwinkle `#97A3FF` — replacing cool-black + acid lime (§2 rewritten; legacy values kept there for un-migrated surfaces; principle 1 updated). (2) **Banner cover pattern** (new §5.15): Notion-style full-bleed header as an inline SVG dusk scene (gradient sky, primary sun, layered ridges, stars, grain), topbar floating over it with glass chips; modal renumbered §5.15 → §5.16. (3) **New principle 7 "Open content over boxes"**: no bordered cards/hairlines in main page content — spacing, labels, and weight carry the structure; one structural hr per page (footer). Block page's hero panel, primary-action card, CTA chip, and per-row hairlines all removed accordingly; §5.12 now specifies the open title-is-the-link pattern with arrow affordance (solid button chips banned for navigation actions), §5.14 is spacing-separated open rows. Motion principle renumbered 7 → 8. Popup/options/viewer/onboarding migrate to all of the above on next touch.
- **2026-06-09 (v2 rebuild)** — All surfaces rebuilt in `v2/` as a Vite + React + TypeScript project per `v2/SPEC.md`; v2 is born on dusk-signal with no legacy palette anywhere. Component patterns migrated from prose+CSS recipes to actual shared React components in `v2/src/components/`: `BannerScene` (banner cover §5.15, now with a parameterized `variant` — `dusk` for block, `sunrise` for onboarding: same geometry, dawn gradient, golden sun, faded stars), `SegmentedBar` (§5.13), `DueRow` (§5.14), `SectionLabel`, `StreakChip`, `Dialog` (§5.16 — replaces `lib/dialog.js`), `Skeleton`, `Button`, `Spinner`, and the full SVG icon set in `icons.tsx` (§6). Typography: UI face is now **Figtree** (variable, self-hosted via @fontsource — extension pages must not load fonts from the network) with JetBrains Mono unchanged; Tailwind v4 carries the tokens via `@theme` in `v2/src/styles/tokens.css`, which wipes Tailwind's default palette so only dusk-signal colors exist. The LC overlay (leetcode.com content script) renders in a closed Shadow DOM with handwritten dusk-signal CSS and the system font stack — Tailwind can't cross the shadow boundary and page-injected CSS can't resolve extension font assets. New v2 pattern: viewer is review-queue-first (queue dashboard landing + the Linear-style table as a second view, keeping reserved-space sort indicators, 3-state filter chips, expanding notes/topics, ⌘K). `viewer1/` remains the v1 reference until the v2 flip, then `v2/src/components/` is canonical.
- **2026-06-10** — Settings rework sets the new form language (user-directed): open settings document (no cards; hairline-paced sections; §5.11's bordered card pattern is retired), label-column form grid with right-aligned controls, underline text fields (hairline bottom border + static faint `--surface` tint, square corners, I-beam cursor, no hover/focus bg shift), auto-save with a transient "Saved" status (no save bar), Base UI primitives for slider/switch/checkbox styled with tokens, borderless soft-fill buttons (outlined chips retired; primary = inverted warm-white per §5.10; danger = soft red tint), segmented control for mode switches, topbar brand reduced to wordmark-only (§5.6). Other surfaces adopt on their rework pass.
- **2026-06-10 (later)** — JetBrains Mono retired entirely (user-directed): Figtree is the single face for everything including numerals, dates, intervals, and device codes; §3 rewritten, @fontsource/jetbrains-mono dropped. Popup layout rebuilt via a five-concept variant round: winner is the segmented quota ring (one arc per problem — the radial expression of §5.13's discrete-count rule) with the coach headline ("Solve N more to unlock your sites.") beside it, due list and log below.
- **2026-06-21** — Phrase-confirm modals (§5.16) must force hand-typing (user-directed): the displayed phrase is `select-none` + `copy`-cancelled and the retype input rejects `paste`/`drop`, so the override can't be shortcut by copy-paste. Applied to the block override modal; the rule governs any future phrase-confirm gate.
- **2026-06-11** — Viewer reworked to dusk-signal open document (user-directed): banner cover header (§5.15) like block/onboarding, review-queue landing removed — the sortable problem table is the only view. Table is borderless (no outer box, no per-row hairlines; §7), underline search, open topic tags, one structural footer rule for status counts. `viewer1/` legacy note in §2 still applies to the retired v1 folder only.
- **2026-06-23** — New **raised button** variant (§5.9): skeuomorphic settings primary CTA — low-contrast `--surface-2 → --surface` gradient, 10px radius, inset top rim light only, no borders or outer drop shadows (pill silhouette ban added to §8). Options page primary actions migrated; soft-fill variants remain for dialogs and secondary controls. **`raised-danger`** added for page-level destructive CTAs (Reset all data).
