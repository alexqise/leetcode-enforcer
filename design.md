# LeetCode Enforcer — Design Guidelines

The canonical source for all UI work in this extension. Based on the viewer (`viewer1/`) which was iterated to a Linear-inspired, refined dark aesthetic. Every surface (popup, options, onboarding, block screen, viewer) should align with these tokens and patterns.

When a user asks for UI changes, **read this file first**. When the user gives a clear design direction change ("more breathable spacing", "switch the accent to violet", "no emojis anywhere"), **update this file after applying the change** so it stays the single source of truth.

---

## 1 · Core principles

1. **Rationed accent.** The acid lime `#B4F500` is the only color outside the gray/black scale. It is used ONLY for moments that need attention: `due-today` dates, `Active` status icon, the sorted column indicator in a table header, focus rings, and brand-mark accents on the auth gate. Never on default text, never on container backgrounds, never on buttons by default. The gray scale carries 95% of the UI.
2. **No emojis. Use icons.** Replace `🔥`, `📊`, `⚙`, `🔍`, `★`, `●` etc. with inline SVGs (16-18px stroke icons) or unicode glyphs at carefully chosen sizes. Emojis look unprofessional, render inconsistently across systems, and break the "designed" feel. The status mark icons `●`, `★`, `◌` are acceptable because they are abstract geometric glyphs, not full-color emojis — but prefer inline SVG when introducing new icon affordances.
3. **Quiet density.** Linear-style. Headers are 12px, body is 13px, cells use 18px vertical padding (12px in compact mode). Generous horizontal padding (24-32px). Borders are hairline (1px) and use the `--border` token so they whisper.
4. **No layout shift on interaction.** Sort indicators always reserve their space (38px right padding on sortable headers, absolutely positioned glyph). Filter chips don't change height when toggled. Search field height fixed. Table row height stays constant unless the user explicitly clicks an "expand" affordance.
5. **Viewport-locked, never page-scrolling.** Apps use `height: 100vh` + `overflow: hidden` on body. Scrolling happens inside designated regions (`.table-wrap`, `.filters`) only.
6. **Soft-black, not pure-black.** Background is `#131316` — a slight warm off-black. Pure `#000000` is too harsh.

---

## 2 · Color tokens

All colors live in `:root` as CSS custom properties.

### Surfaces (4-step hierarchy)
```
--bg:           #131316   /* canvas — page background */
--surface:      #1A1A1E   /* search input, count pill, table-header-cell hover, brand mark bg */
--surface-2:    #212128   /* subtle elevation, sticky-header bg-on-hover, chip default */
--surface-3:    #2A2B33   /* active chip bg, brand mark surface, expanded notes */
```

### Borders (hairline)
```
--border:       #26272F   /* hairlines, default chip border, default button border */
--border-2:     #34353F   /* hover border, active chip border, scrollbar thumb */
```

### Text (3-step hierarchy + faint)
```
--fg:           #E8E9EE   /* primary content — titles, sorted column headers, active chip text */
--fg-2:         #A2A5AE   /* secondary content — body cell text, button labels, inactive header */
--fg-3:         #61656F   /* muted — section headings, placeholder, count pills, em-dashes */
--fg-4:         #36383E   /* faint — disabled, neutral chip dots */
```

### Accent (rationed)
```
--acc:          #B4F500   /* acid lime — see "rationed accent" principle */
--acc-dim:      rgba(180, 245, 0, 0.10)   /* hover bg for accent-keyed elements */
```

### Status colors (functional, not decorative)
```
--easy:         #4FCF8B   /* Easy difficulty, level-4 confidence */
--medium:       #E8B547   /* Medium difficulty, level-2/3 confidence */
--hard:         #F26F6F   /* Hard difficulty, overdue dates, level-1 confidence */
--mastered:     #E8C847   /* Mastered status icon */
```

Easy/Medium/Hard colors are MUTED, not vibrant — desaturated so the table doesn't look like a Christmas tree.

---

## 3 · Typography

### Fonts (Google Fonts, preconnect + preload)
- **UI:** `'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
  - Weights used: 400, 500, 600, 700
  - `font-feature-settings: 'cv11', 'ss03'` (better number alternates)
- **Mono:** `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`
  - For numerics ONLY: row numbers, dates, intervals, count badges, kbd glyphs

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
- **Monochrome only.** No colored letters, no gradient backgrounds.
- Use an outlined SVG glyph that hints at the page's purpose (e.g., a list/table icon for the viewer)
- Stroke width 1.4–1.6, `currentColor`, color `--fg-3`
- 16–22px size depending on context
- Pairs with bold text wordmark in `--fg`

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
- **Default ghost button (`.btn`):** transparent bg, `--border` border, `--fg-2` text, `--fg-3` icon. Hover: `--surface` bg, `--fg` text, `--border-2` border.
- **Active button:** `--surface-2` bg, `--fg` text, `--border-2` border.
- **Badge inside button:** `--acc` bg, `--bg` text (black on lime), 10px font, 700 weight, 99px radius.
- Height 34px (was 30 in initial design — bumped for breathability).
- Padding 14px horizontal, 8px gap to label.

### 5.10 — Auth gate (sign-in screen)
- Full-screen `position: fixed; inset: 0` with `--bg` background
- Centered single column, max-width 440px, padding 40px 32px
- Brand mark icon at top (56×56, `--surface` bg with `--border-2`, contains the outlined glyph in `--fg-2`)
- Headline at 22px, weight 600, letter-spacing -0.02em
- Subhead at 13.5px, `--fg-2`, line-height 1.55, margin-bottom 28px
- Primary CTA: `--fg` bg, `--bg` text (inverted), 11px×20px padding, 14px font, 600 weight, 6px radius
- Error state: 8px×12px padding, `rgba(242,111,111,0.08)` bg, `rgba(242,111,111,0.2)` border, `--hard` text

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
