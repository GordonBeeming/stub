# Design System — stub

Canonical design spec for the `stub` monorepo. Both `apps/marketing` (Astro) and `apps/app` (Next.js on Cloudflare via `@opennextjs/cloudflare`) consume this system through `packages/design-system`.

This file is the **source of truth**. If a value isn't here, it doesn't exist. When something needs to change, change it here first, then propagate.

---

## 1. Voice & tone rules

These are as important as the tokens. The design only feels right when the writing matches it.

Stub has one voice across the product: warm, direct, first-person where it fits. The `<Hero>`, `<SectionHeader>` (with `num`), and `<Comment>` components are still in the library, but they're opt-in now — reach for them deliberately, never as page scaffolding.

### 1.1 Rules

- **Sentence case, always.** Never title case. Never ALL CAPS except in uppercase-transformed mono labels (nav items, meta text) where `letter-spacing` carries the feel.
- **Sans for headings.** Plain `<h1>`/`<h2>` in `var(--font-sans)`, weight 500, sized by hierarchy. Serif is reserved for genuine editorial moments (rare — the main example is the numbered-pitch showcase). Never for body.
- **Monospace for meta, system, and technical text.** Timestamps, version tags, service names, CLI examples, route paths, code identifiers, page chrome like the brand line and footer.
- **`// comments` earn their place, not required.** If a `//` aside clarifies something, use it. Don't prefix every section with one. They should feel like margin notes, not scaffolding.
- **Numbered sections are an option, not a default.** `<SectionHeader>` accepts a `num` prop for when a genuine step-through matters (a numbered showcase, a tutorial where order is load-bearing). Most app pages skip it — a plain `<h2>` or un-numbered `<SectionHeader>` is lighter and reads better.
- **First-person allowed.** "I wanted a way to…" is fine. So is "we" when it means the single-tenant owner.
- **Two weights: 400 and 500.** Never 600 or 700. The design leans on contrast between mono/serif/sans and between size, not on weight.
- **Numbers get formatted.** Round floats. `toLocaleString()` for large integers. Never let `0.30000000000000004` reach the screen.

### 1.2 Prose hygiene — things to avoid

AI writing patterns creep in when you're not looking. Skim every paragraph against this list before shipping:

- **Em-dash overuse.** Sparingly. Replace with a period or comma when possible.
- **Rule of three.** Lists of three clauses or imperatives ("clone, configure, deploy") read as machine output. Break the pattern.
- **AI vocabulary.** `crucial`, `key` (adjective), `showcase`, `underscore`, `align with`, `enhance`, `additionally`, `seamless`, `intricate`, `landscape` (abstract), `tapestry`, `testament`.
- **Stock phrases.** "good problem to have", "nothing else", "simply", "in short".
- **Rule-following without opinion.** A line of real voice is better than five lines of polished spec.

---

## 2. Tokens

All tokens exported as CSS custom properties from `packages/design-system/src/tokens.css`. Both apps import this file once at the root.

### 2.1 Colors

Stub ships in light and dark. System preference picks the default via `prefers-color-scheme`. The user can override with the `<ThemeToggle>` in the `<PageHeader>`; that choice is written to `localStorage` and applied as `data-theme` on `<html>` before first paint (no flash).

The palette is Gordon Beeming's personal brand. Six brand tokens are authoritative. Everything else (`--bg-2`, `--bg-3`, `--line`, `--line-soft`, `--text-3`, `--primary-dim`, `--bg-deep`, `--danger`, `--success`) is derived to serve stub's UI needs while staying in brand tone.

```css
:root {
  /* DARK is the default when no preference can be read. */
  --bg:          #1A1A1A;
  --bg-2:        #222228;  /* cards */
  --bg-3:        #2C2C2C;  /* hover / elevated — brand ui-accents */
  --bg-deep:     #0E0E10;  /* terminal / CLIBlock */

  --line:        #3A3A42;
  --line-soft:   #2C2C2C;

  --text:        #E0E0E0;
  --text-2:      #D1D5DB;
  --text-3:      #9CA3AF;

  --primary:     #46CBFF;
  --primary-dim: #2B8AAB;
  --accent:      #0063B2;  /* brand accent */

  --danger:      #F87171;
  --success:     #4ADE80;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg:          #F8F9FA;
    --bg-2:        #FFFFFF;
    --bg-3:        #E9ECEF;  /* brand ui-accents */
    --bg-deep:     #E4E6EA;

    --line:        #D4D7DC;
    --line-soft:   #E9ECEF;

    --text:        #1A1A1A;
    --text-2:      #374151;
    --text-3:      #6B7280;

    --primary:     #0063B2;
    --primary-dim: #0075A3;
    --accent:      #0075A3;

    --danger:      #B91C1C;
    --success:     #15803D;
  }
}

/* User override wins over system preference. */
[data-theme='dark'] {
  --bg:          #1A1A1A;
  --bg-2:        #222228;
  --bg-3:        #2C2C2C;
  --bg-deep:     #0E0E10;
  --line:        #3A3A42;
  --line-soft:   #2C2C2C;
  --text:        #E0E0E0;
  --text-2:      #D1D5DB;
  --text-3:      #9CA3AF;
  --primary:     #46CBFF;
  --primary-dim: #2B8AAB;
  --accent:      #0063B2;
  --danger:      #F87171;
  --success:     #4ADE80;
}

[data-theme='light'] {
  --bg:          #F8F9FA;
  --bg-2:        #FFFFFF;
  --bg-3:        #E9ECEF;
  --bg-deep:     #E4E6EA;
  --line:        #D4D7DC;
  --line-soft:   #E9ECEF;
  --text:        #1A1A1A;
  --text-2:      #374151;
  --text-3:      #6B7280;
  --primary:     #0063B2;
  --primary-dim: #0075A3;
  --accent:      #0075A3;
  --danger:      #B91C1C;
  --success:     #15803D;
}
```

**Rules**:
- Body copy uses `--text-2`, not `--text`. `--text` is for headings and emphasized inline elements.
- Never put `--primary` on `--bg-2` without checking the contrast in both modes. Use `--primary-dim` on tinted backgrounds when contrast is marginal.
- Every component references tokens, never literal hex. SVGs do the same — `fill="var(--bg-2)"` instead of `fill="#222228"`.
- Only one accent colour per screen. Don't mix `--accent`, `--danger`, and `--success` in the same view unless they carry semantic meaning.
- Every token pair meets WCAG 2.1 AA (4.5:1 for body text, 3:1 for large) in both modes. If you add a derived token, verify both directions before shipping.

### 2.2 Typography

```css
:root {
  --font-mono:  'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-sans:  'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
}
```

Load via Fontsource packages (`@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/instrument-serif`) in the design system entry point. Do NOT use Google Fonts `<link>` tags — they hurt LCP and require CSP exceptions.

**Type scale**:

| Element       | Font   | Size               | Weight | Letter-spacing | Line-height |
|---------------|--------|--------------------|--------|----------------|-------------|
| Hero (h1)     | serif  | `clamp(48px, 7vw, 88px)` | 400 | `-0.02em`      | `1`         |
| h2 section    | mono   | `12px`             | 400    | `0.12em` upper | `1.4`       |
| h3 / feat     | sans   | `15px` / `17px`    | 500    | `-0.01em`      | `1.4`       |
| Body          | sans   | `15px`             | 400    | `0`            | `1.6`       |
| Body small    | sans   | `13px`             | 400    | `0`            | `1.55`      |
| Meta / mono   | mono   | `11px`             | 400    | `0.08em` upper | `1.5`       |
| Eyebrow       | mono   | `11px`             | 400    | `0.15em` upper | `1`         |
| Code inline   | mono   | inherit            | 400    | `0`            | inherit     |
| Verdict title | serif  | `26px`             | 400    | `-0.01em`      | `1.3`       |
| Kbd           | mono   | `12px`             | 400    | `0`            | `1`         |

### 2.3 Spacing, radii, layout

```css
:root {
  /* radii */
  --radius-sm: 3px;   /* badges, tags, inline pills */
  --radius-md: 6px;   /* cards, inputs, buttons */
  --radius-lg: 8px;   /* hero containers, large surfaces */

  /* layout */
  --wrap-max: 920px;   /* primary content width */
  --wrap-px:  32px;    /* horizontal padding desktop */
  --wrap-px-sm: 20px;  /* horizontal padding mobile */

  /* component internals */
  --pad-cell-y: 20px;
  --pad-cell-x: 24px;
}
```

**Spacing rhythm**: use rem for vertical rhythm between sections (`1rem`, `1.5rem`, `2rem`, `3rem`, `4.5rem`). Use px for component-internal gaps (`8px`, `12px`, `16px`, `24px`). Don't mix them.

**Grid background**: the page itself has a subtle 48px × 48px grid overlay using `--line-soft`. This lives on `body` and is part of the aesthetic. Both apps inherit it.

```css
body {
  background-image:
    radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--primary) 6%, transparent), transparent 40%),
    radial-gradient(circle at 85% 80%, color-mix(in oklab, var(--accent) 4%, transparent), transparent 40%),
    linear-gradient(var(--line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
  background-size: auto, auto, 48px 48px, 48px 48px;
}
```

Both radial gradients use tokens via `color-mix`, so the ornament re-tints automatically when the theme flips.

---

## 3. Component inventory

Every component below exists in `packages/design-system/src/components/`. Both apps import from `@gordonbeeming/design-system`. A reference implementation of every component rendered together lives at `packages/design-system/showcase/index.html` (use the existing `stub-pitch.html` as the starting point — it already uses every component).

Components are listed in the rough order they appear in the pitch. Each has a stable export name, a purpose, and the structural rules that make it feel right.

### 3.1 `<PageHeader>`

Top bar of the page. Meta-level chrome — brand on left, version/status on right. Mono font throughout, bottom border, generous padding below.

- `brand` (required): JSX, usually `<>// <b>GordonBeeming</b> · pitch document</>`
- `meta` (optional): right-side text, e.g. `v0.1 · draft`

**Structural rules**: always has a bottom border in `--line`. The `//` prefix is part of the pattern, not decoration.

### 3.2 `<Hero>`

Opt-in pitch-doc hero. Serif h1 with optional blinking cursor, preceded by a mono eyebrow, followed by a mono tagline block. Most app pages skip this — a plain sans h1 sized with tokens reads better in 2026 and lets the voice carry the weight. Keep Hero for showcase / editorial surfaces where the flourish earns its keep.

- `eyebrow`: short uppercase label, e.g. `"proposal"`
- `title`: JSX. Multi-line allowed. Italic via `<i>` maps to `--text-2`.
- `cursor`: boolean, shows a blinking block cursor at end of title
- `tagline`: JSX tagline block, expected to contain `<Comment>` and `<Token>` inline components

**Structural rules**: eyebrow has a 24px leading line in `--primary`. Title is serif, 400 weight, negative letter-spacing. Cursor uses `steps(2)` animation, 1s infinite. Tagline is mono `14px` at `--text-2`.

### 3.3 `<SectionHeader>`

Section divider. Optional `01`, `02`, `03`… prefix in primary color, uppercase mono label. Default usage is un-numbered; the numbered form is for places where the sequence is load-bearing (a tutorial, a changelog, the design-system showcase).

- `num` (optional): zero-padded number as string, e.g. `"01"`. Omit for un-numbered headings.
- `children` (required): the section label

**Structural rules**: renders as an `<h2>`. Bottom border, `--text-3` color, `0.12em` letter-spacing. When present, number in `--primary` weight 500. Always `margin-bottom: 24px` after.

### 3.4 `<NameRow>`

Row in a vertical list of candidate names (or any word + description + badge pattern). Three columns: word, description, badge.

- `word` (required): the name itself, mono
- `tld` (optional): trailing domain bit rendered in `--text-3`
- `children` (required): description text
- `badge` (optional): `{ label, variant: 'top' | 'alt' | 'quirky' }`
- `featured`: boolean, tints the row with `rgba(70, 203, 255, 0.04)` and colors the word `--primary`

**Structural rules**: used inside a `<NameList>` container that handles the outer border and row separation. Hover state shifts background to `--bg-3`.

### 3.5 `<ProblemSplit>`

Two-column "them vs us" comparison. Each side has a colored mono label and a paragraph.

- `vs`: `{ label, children }` — the problem framing
- `us`: `{ label, children }` — the solution framing

**Structural rules**: `vs` label in `--danger`, `us` label in `--success`. Equal-width columns on desktop, stacked on mobile. Each column is a card with `--bg-2` background and `--line` border.

### 3.6 `<DecisionCard>` (also styleable as "verdict")

Heavy, opinionated callout. Has a "VERDICT" label cutting into its top border, serif h3 inside.

- `label` (optional, default `"VERDICT"`): the cut-in label
- `title` (required): serif heading
- `children` (required): body copy

**Structural rules**: linear gradient background from `--bg-2` to `--bg-3`, border in `--primary-dim`. Label overlaps the top border using `position: absolute` with `background: var(--bg)` to create the cut-in effect.

### 3.7 `<Diagram>` wrapper

Container for architecture/flow SVGs. Handles the bordered, padded card that holds the SVG and the caption below it.

- `children` (required): SVG markup
- `caption` (optional): small mono caption

**Structural rules**: `--bg-2` background, `--line` border, 32px internal padding. SVG must be responsive (`width: 100%; height: auto`). Caption is mono `12px` in `--text-3`, centered.

For SVGs themselves, the pitch uses these conventions — follow them:
- `<defs>` markers named `arrow` (neutral `#64646E`) and `arrow-p` (primary `#46CBFF`)
- Boxes: `rx="4"`, fill `#1A1A20`, stroke `#2A2A33` (or `#46CBFF` for primary-highlighted boxes)
- Text: title in `--text` or `--primary`, subtitle in `--text-2`, caption in `--text-3`
- Dashed container strokes (`stroke-dasharray="3 3"`) denote logical groupings like "CLOUDFLARE EDGE"

### 3.8 `<StackGrid>` and `<StackCell>`

2-column grid of service cells. Each cell has a mono service name in primary, a sans role title, and a mono usage note.

- `<StackGrid>`: wrapper, handles the 1px-gap grid with `--line` showing through
- `<StackCell>` props: `svc`, `role`, `usage`

**Structural rules**: grid uses `gap: 1px` and `background: var(--line)` so the line between cells is the grid gap itself. Cells are `--bg-2`. Collapses to single column under 720px.

### 3.9 `<BudgetTable>` and `<BudgetRow>`

Three-column table-like layout showing service / limit / usage. Not a real `<table>` — uses `grid-template-columns: 170px 1fr 160px`.

- `<BudgetTable>`: wrapper
- `<BudgetRow>` props: `svc`, `limit`, `used`, `head` (boolean for header row styling)

**Structural rules**: mono throughout. Header row has `--bg-3` background, `11px` uppercase. Data rows have `--line-soft` dividers. `used` column is right-aligned, `--success` color.

### 3.10 `<FlowSteps>` and `<FlowStep>`

Horizontal 4-step process visualization with arrow connectors between steps.

- `<FlowSteps>`: wrapper, handles the grid
- `<FlowStep>` props: `idx` (e.g. `"01 / bootstrap"`), `title`, `desc`

**Structural rules**: 4 columns desktop, 2 columns mobile. Each step is a card with mono index in `--primary`, sans title, mono description. Arrow `→` positioned absolutely at the right edge of each step except the last. Arrow color `--text-3`.

### 3.11 `<FeatGrid>` and `<Feat>`

2-column grid of feature cards. Each has a colored left border, a sans heading, and a short description.

- `<FeatGrid>`: wrapper, 2 columns
- `<Feat>` props: `title`, `children`, `variant: 'primary' | 'alt'` (primary uses `--primary` left border, alt uses `--accent`)

**Structural rules**: left border is `2px` (the one exception to the 1px rule), all other sides `1px` in `--line`. Background `--bg-2`. Corner radius 6px but since there's a single-sided accent border, that's fine because the other three sides are 1px.

### 3.12 `<OSSCallout>` (generic bordered callout)

Side-by-side: circular icon on left, title + description on right. Uses `--success` left border by default.

- `icon`: JSX, typically a unicode glyph or inline SVG
- `title`: JSX
- `children`: description

**Structural rules**: 32px circular icon with 1px border, centered content. Use this component for any "callout" pattern — OSS notice, info banner, deployment note. Swap the accent color as needed.

### 3.13 `<CLIBlock>`

Styled terminal-like code block. Darker background than normal cards, monospace, color-coded tokens.

- `children`: the CLI content with inline spans for tokens

**Structural rules**: background `var(--bg-deep)`, mono font, line-height `1.9`. Inline token classes:
- `.c` — comments, `--text-3`
- `.p` — prompt (`$`, `>`), `--primary`
- `.s` — strings/highlighted args, `--accent`
- `.d` — default command text, `--text-2`

Consumers can also accept a structured `lines` prop where each line is `{ kind: 'comment' | 'cmd' | 'out', text }` and the component handles styling — pick whichever feels cleaner for the repo.

### 3.14 `<Footer>`

Bottom chrome. Mono, small, top border. Left-aligned text + right-aligned text with a terminal-style square glyph.

- `left`: JSX
- `right`: JSX

### 3.15 Inline helpers

Small components for use inside prose:

- `<Token>` — inline mono snippet colored `--primary`. Use for route paths, env var names, package identifiers.
- `<Comment>` — inline mono text with `//` prefix colored `--text-3`. Use inside taglines and for technical asides.
- `<Kbd>` — keyboard key rendering (not used in pitch but likely needed in app). Mono on `--bg-2` with `--line` border, small padding.

---

## 4. Layout rules

### 4.1 Page shell

Every page in both apps uses the same shell:

```
body > .wrap (max-width 920px, padding 48px 32px 96px)
     └ <PageHeader>
     └ <Hero>  (hero pages only)
     └ <section> ... <section>
     └ <Footer>
```

On mobile (< 720px): `.wrap` drops to `32px 20px 64px` padding.

### 4.2 Sections

Every section has `margin-bottom: 72px` (`margin-bottom: 56px` for hero specifically). Sections always begin with a `<SectionHeader>`. Don't nest sections.

### 4.3 Grid breakpoint

There is **one** breakpoint: 720px. Below it:
- Two-column grids collapse to single column
- Four-column grids collapse to two columns
- `NameRow` stacks vertically, badges align left
- `BudgetRow` collapses to two rows

Don't introduce new breakpoints without updating this section.

---

## 5. Motion

Deliberately restrained. Three motion primitives only:

1. **Blinking cursor** — 1s steps(2) infinite, on hero title only
2. **Hover transition** — `background 0.15s ease` on interactive rows and cards
3. **No page transitions, no scroll animations, no entrance animations** — the design leans on composition, not motion. If an animation is being added to "make it feel alive," the layout probably needs work instead.

---

## 6. Accessibility

- All color pairings tested against WCAG 2.1 AA. Primary text (`--text` on `--bg`) is well over 4.5:1. Secondary text (`--text-2` on `--bg`) is at 4.5:1 — don't shrink it below 14px.
- Every interactive element has a visible focus state: `outline: 2px solid var(--primary); outline-offset: 2px`.
- `<SectionHeader>` renders as `<h2>`, `<Feat>` title is an `<h3>`, etc. Don't break the heading hierarchy for styling — use the right element, style it however you want.
- Diagrams include `role="img"` with a `<title>` and `<desc>` for screen readers.
- Motion respects `prefers-reduced-motion` — the blinking cursor in particular pauses when the user has requested reduced motion.

---

## 7. Framework notes

### 7.1 `packages/design-system` (shared)

Exports:
- `@gordonbeeming/design-system/tokens.css` — CSS custom properties (import once per app at the root layout)
- `@gordonbeeming/design-system/tailwind-preset` — Tailwind preset mapping tokens to utility classes (optional; only used if a consumer adopts Tailwind)
- `@gordonbeeming/design-system` — React component exports for every component listed in §3
- `@gordonbeeming/design-system/fonts` — Fontsource re-exports so consumers don't each install the three font packages

All components are React `.tsx` files. Astro consumes them through the React integration (`@astrojs/react`). No framework-specific variants — one implementation, both apps.

Build with `tsup` or `tsc` to emit both ESM and types. Mark React as a peer dependency. Do NOT bundle styles into JS — tokens are a plain `.css` file the consumer imports.

### 7.2 `apps/marketing` (Astro)

- Adds `@astrojs/react` integration to consume the shared components
- Imports `@gordonbeeming/design-system/tokens.css` in `src/layouts/BaseLayout.astro`
- Imports fonts in the same layout from `@gordonbeeming/design-system/fonts`
- Pages are `.astro` files that compose shared React components with Astro-native markup where possible (static content should stay Astro for zero JS)
- Deploys to `gordonbeeming.com/stub` — confirm path prefix handling in `astro.config.mjs` (`base: '/stub'`) and in all internal links

### 7.3 `apps/app` (Next.js via `@opennextjs/cloudflare`)

- Next.js App Router, deployed as a Worker via `@opennextjs/cloudflare`
- Imports `@gordonbeeming/design-system/tokens.css` in `app/layout.tsx`
- Imports fonts via Fontsource in `app/layout.tsx`
- Cloudflare bindings (D1, KV, Turnstile) configured in `wrangler.toml` and typed via `cloudflare-env.d.ts`
- Server components prefer direct binding access over API calls where possible; client components use Server Actions or Route Handlers for mutations
- Do NOT use Next.js `<Image>` with the default loader — use a loader compatible with Cloudflare, or ship plain `<img>` with explicit width/height

---

## 8. Adding to this spec

When adding a new component, color, or layout rule:

1. Add it to this file first, in the right section
2. Add a reference implementation to `packages/design-system/showcase/index.html`
3. Implement in `packages/design-system/src/`
4. Consume in an app

Never the other way around. Claude Code should refuse to introduce new tokens without updating this file.

---

## 9. Theming

Three theme states: `system`, `dark`, `light`. The system state reads `prefers-color-scheme`. The other two override it. State is held in `localStorage['stub-theme']` and applied as `data-theme` on `<html>` before first paint via a small inline script in the app's root layout.

Rules:

- The single source of truth for palette values is §2.1. Every component reads from tokens — including inline SVGs (`fill="var(--bg-2)"`, `stroke="var(--primary)"`).
- A consumer app imports `@gordonbeeming/design-system/tokens.css` once at the root layout. That file declares the dark defaults on `:root`, the `@media (prefers-color-scheme: light)` overrides, and the `[data-theme='dark' | 'light']` explicit overrides. Consumers do not redeclare tokens.
- `<ThemeToggle>` is the only interactive theme control. It lives in the `PageHeader` meta slot for any app that wants the toggle visible. An app can omit it — the media query still picks the right default.
- No per-component "force dark" or "force light" escape hatches. If a surface needs to stay dark in both modes (e.g. CLIBlock's terminal feel), it does so through a stable token (`--bg-deep`) that mirrors the theme, not through hard-coded colour overrides.
- A theme flip is instantaneous. Components don't animate token changes. If you add a transition, respect `prefers-reduced-motion` and gate it behind a specific user interaction, not a theme change.
