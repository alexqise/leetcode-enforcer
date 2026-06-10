# Product

## Register

product

## Users

People grinding LeetCode on a schedule — interview prep or long-term skill maintenance — who know willpower alone fails them. They install this extension precisely because they want to be blocked. Context of use: a developer at their own machine, mid-procrastination-impulse (just tried to open YouTube/Reddit) or mid-practice (on leetcode.com, just got an "Accepted" verdict). Currently built and dogfooded by one developer; the design target is an eventual public Chrome Web Store release, so every surface must work for a stranger with zero context.

The job to be done: keep a daily problem quota honest, and resurface past problems at the right interval so expensive 20–40-minute solves aren't forgotten.

## Product Purpose

A Chrome MV3 extension that hard-blocks distracting sites (YouTube, Reddit, X, etc.) until the user solves their daily LeetCode quota. It auto-detects accepted submissions, captures a confidence rating + notes inline, schedules spaced-repetition reviews (1d → 3d → 7d → 14d → 30d ladder), and syncs everything write-through to Google Sheets (and optionally GitHub). Success looks like: the user solves their quota daily, reviews show up on time, the streak survives, and the user never thinks about the tool itself.

Surfaces: block page, popup, options, onboarding wizard, problem-table viewer, and an inline overlay on leetcode.com.

## Brand Personality

**Calm utility.** Three words: quiet, factual, unyielding.

The extension is emotionally neutral infrastructure. It states facts — quota progress, reviews due, streak count — and gets out of the way. The block itself is the firmness; the interface never adds nagging, shame, celebration, or gamified dopamine on top. No confetti, no badges, no motivational copy. A solved quota is reported the same way a due review is: plainly.

Reference feel: Linear (already encoded in design.md — quiet density, rationed acid-lime accent, soft-black surfaces, hairline borders).

## Anti-references

- **Duolingo-style gamification** — mascots, guilt-trip notifications, celebration animations, XP framing. The streak is a fact, not a slot machine.
- **Productivity-app moralizing** — "You've got this!", "Stay focused!", shame copy on the block page. The block page is a closed door, not a lecture.
- **Christmas-tree dashboards** — vibrant status colors everywhere, colored cards, hero metrics with gradient accents. Status colors stay muted and functional (already a design.md rule).
- **Bootstrap-era affordances** — hover lifts, heavy shadows, pill buttons, emoji-as-icons. All banned in design.md.

## Design Principles

1. **The tool disappears when you're compliant.** The ideal session with a met quota involves almost no UI. Optimize every surface for the fastest factual read (am I blocked? what's due?) and exit.
2. **State facts, never feelings.** Copy reports numbers and states ("2 of 3 solved", "4 reviews due") without encouragement, judgment, or exclamation marks.
3. **Firm mechanics, quiet surfaces.** Strictness lives in the mechanism (the block, the typed override phrase, the 03:00 reset) — never in the visual volume or the tone.
4. **Respect the interruption context.** The block page catches users at a moment of impulse; it must load instantly, answer "how do I get back?" in one glance, and offer the next concrete action (a problem link), not a wall of stats.
5. **Stranger-proof by default.** Every flow (onboarding, OAuth, GitHub connect, override) must be self-explanatory to a first-time Web Store installer — no knowledge from the README assumed.

## Accessibility & Inclusion

Baseline standing constraints, enforced on every surface:

- WCAG AA contrast (≥4.5:1 body text, ≥3:1 large text) — verify especially on `--fg-3` muted text over dark surfaces.
- Full keyboard operability; visible focus rings (the existing 2px `--acc` focus-visible pattern).
- `prefers-reduced-motion: reduce` fallbacks for any animation (spinners excepted).
- Decorative SVGs carry `aria-hidden="true"`; interactive icons get accessible names.
