---
version: alpha
name: GitBags
description: Cypherpunk dark-mode launchpad-leaderboard for open-source repos. Built for on-chain native builders. Density, precision, and a single signature purple. Ships with mirrored light palette for accessibility and preference parity; dark is the default.
colors:
  # === DARK THEME (default) ===
  # Surfaces — deep blacks with subtle purple bias
  bg: "#08080C"
  surface: "#101015"
  surface-elevated: "#16161E"
  surface-overlay: "#1C1C25"
  border: "#23232E"
  border-strong: "#33333F"

  # Brand — Bags.fm purple, tuned for dark mode
  primary: "#A855F7"
  primary-hover: "#9333EA"
  primary-pressed: "#7E22CE"
  primary-soft: "#1F1429"

  # Text
  fg: "#F5F5F7"
  fg-secondary: "#9494A0"
  fg-muted: "#5A5A66"
  fg-disabled: "#3A3A45"

  # Semantic
  success: "#22C55E"
  success-soft: "#0F2A1A"
  warning: "#EAB308"
  warning-soft: "#2A2110"
  danger: "#EF4444"
  danger-soft: "#2A1414"
  info: "#3B82F6"
  info-soft: "#0F1F33"

  # Rank tiers (medals)
  rank-gold: "#FBBF24"
  rank-silver: "#CBD5E1"
  rank-bronze: "#D97706"

  # Charts (sparklines, fee curves)
  chart-1: "#A855F7"
  chart-2: "#7E22CE"
  chart-3: "#22C55E"
  chart-4: "#3B82F6"
  chart-5: "#EAB308"

colors-light:
  # === LIGHT THEME (mirror) ===
  # NON-NORMATIVE EXTENSION: spec allows unknown YAML content; agents and the
  # CSS pipeline read this to derive a [data-theme="light"] override layer.
  # Token names mirror `colors` exactly. Same role, inverted substrate.
  bg: "#FAFAFC"
  surface: "#FFFFFF"
  surface-elevated: "#F4F4F8"
  surface-overlay: "#FFFFFF"
  border: "#E5E5EC"
  border-strong: "#D4D4DD"

  # Brand — slightly darkened purple for AA contrast on white
  primary: "#9333EA"
  primary-hover: "#7E22CE"
  primary-pressed: "#6B21A8"
  primary-soft: "#F3E8FF"

  # Text
  fg: "#0F0F14"
  fg-secondary: "#52525B"
  fg-muted: "#8B8B95"
  fg-disabled: "#C4C4CC"

  # Semantic — darkened for AA on white
  success: "#16A34A"
  success-soft: "#DCFCE7"
  warning: "#CA8A04"
  warning-soft: "#FEF9C3"
  danger: "#DC2626"
  danger-soft: "#FEE2E2"
  info: "#2563EB"
  info-soft: "#DBEAFE"

  # Rank tiers — darkened to maintain readability on light cards
  rank-gold: "#D97706"
  rank-silver: "#71717A"
  rank-bronze: "#B45309"

  # Charts
  chart-1: "#9333EA"
  chart-2: "#6B21A8"
  chart-3: "#16A34A"
  chart-4: "#2563EB"
  chart-5: "#CA8A04"

typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.01em
  caption:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.02em
  mono-md:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  mono-sm:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.3

rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  full: 9999px

spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  gutter: 24px
  margin: 32px
  sidebar-width: 240px
  content-max: 1440px

components:
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-elevated:
    backgroundColor: "{colors.surface-elevated}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-interactive:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-interactive-hover:
    backgroundColor: "{colors.surface-elevated}"
    borderColor: "{colors.border-strong}"

  sidebar:
    backgroundColor: "{colors.bg}"
    borderColor: "{colors.border}"
    width: 240px
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.fg-secondary}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    typography: "{typography.label-md}"
  sidebar-item-active:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.fg}"
  sidebar-item-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"

  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.fg}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-secondary}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  button-ghost-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 10px 16px

  pill:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 6px 12px
    typography: "{typography.label-sm}"
  badge-live:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.label-sm}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: 4px 10px

  table:
    backgroundColor: "transparent"
    borderColor: "{colors.border}"
  table-header:
    textColor: "{colors.fg-muted}"
    typography: "{typography.label-sm}"
    padding: 12px 16px
  table-row:
    backgroundColor: "transparent"
    borderColor: "{colors.border}"
    padding: 16px
  table-row-hover:
    backgroundColor: "{colors.surface-elevated}"
  table-cell-numeric:
    typography: "{typography.mono-md}"
    textColor: "{colors.fg}"

  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 10px 14px
    typography: "{typography.body-md}"
  input-focus:
    borderColor: "{colors.primary}"
  input-error:
    borderColor: "{colors.danger}"

  select:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 10px 14px

  modal:
    backgroundColor: "{colors.surface-overlay}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.xl}"
    padding: 32px

  tooltip:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.fg}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    typography: "{typography.body-sm}"

  avatar:
    rounded: "{rounded.full}"
    size: 32px
  avatar-lg:
    rounded: "{rounded.full}"
    size: 48px

  stat-card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px

  rank-medal-gold:
    backgroundColor: "{colors.rank-gold}"
    textColor: "{colors.bg}"
    rounded: "{rounded.full}"
  rank-medal-silver:
    backgroundColor: "{colors.rank-silver}"
    textColor: "{colors.bg}"
    rounded: "{rounded.full}"
  rank-medal-bronze:
    backgroundColor: "{colors.rank-bronze}"
    textColor: "{colors.bg}"
    rounded: "{rounded.full}"
---

# GitBags Design System

## Overview

GitBags is a launchpad-leaderboard hybrid for open-source repos on Solana, powered by Bags.fm. The visual identity sits squarely in the **cypherpunk-dark-neon** territory: near-black surfaces, a single signature purple, monospace numerics, and zero ornamental gradients. Every pixel is in service of conveying motion, money, and merit at a glance.

Emotional target: A trader's terminal that respects the engineer behind every commit. It should feel late-night, focused, and slightly dangerous. Confident enough that putting your repo on it is a flex; legible enough that a maintainer who's never touched a wallet can still understand who is being paid and why.

Density is a feature. Information per square inch should beat any traditional SaaS dashboard. Cards have generous internal padding (24px) but tight inter-card gutters (16-24px). Tables are dense but never cramped: 12-16px row padding, monospace numerics, never wrap.

This is **not** a playful product. No rounded illustrations, no mascot pages, no springy bounce animations. Motion is restricted to subtle transitions (opacity, transform), countdown timers, sparklines, and live indicators (pulsing green dots).

## Colors

The palette is built around a single signature accent (Bags purple) over a deep neutral substrate biased slightly toward cool. Every other color is utility. **Dark is the default and the canonical aesthetic**; a mirrored light palette ships for accessibility, preference parity, and presenters who demo on bright projectors.

### Theming model

GitBags ships **two palettes** in this DESIGN.md:

- **`colors:`** is the dark palette and the canonical token set. All prose, all examples, and all default rendering targets dark.
- **`colors-light:`** is a mirrored light palette. Token names match `colors:` exactly so every component automatically gets a correct light variant via CSS variable redirection. This key is a non-normative extension; the spec tolerates unknown YAML content and the lint passes cleanly.

Theme is selected via `data-theme="dark"` (default) or `data-theme="light"` on the `<html>` element. Implementation uses `next-themes` with `attribute="data-theme"` and `defaultTheme="system"` (falls through to `dark` if no system preference is detected). Both palettes are emitted as CSS custom properties under `:root` (dark) and `[data-theme="light"]` (light overrides), then routed through Tailwind v4's `@theme inline` so utility classes like `bg-surface` resolve correctly per theme without rebuilds.

### Dark palette (canonical)

- **Background (#08080C):** Page substrate. Near-black with a microscopic purple tint that ties the whole UI to the brand without ever calling attention to itself.
- **Surface (#101015):** Default card background. The primary content layer.
- **Surface Elevated (#16161E):** Hover states, sidebar selection, active rows. One step closer to the user.
- **Surface Overlay (#1C1C25):** Modals, popovers, tooltips. The layer above the layer.
- **Border (#23232E):** Default 1px borders for cards and table rows. Visible but never loud.
- **Border Strong (#33333F):** Inputs, prominent dividers, focused emphasis.
- **Primary (#A855F7):** The signature purple. Used exclusively for: brand mark, primary CTA, current SOL amounts, leaderboard score column header, sparkline strokes, active sidebar item indicator. **One primary per visible viewport** is the working ceiling.
- **Primary Soft (#1F1429):** Tinted purple background for pills, hover states, soft callouts.
- **Foreground (#F5F5F7):** Primary text. Off-white, never pure white (which would feel sterile against the warm-cool surfaces).
- **Foreground Secondary (#9494A0):** Secondary text, table headers, descriptions.
- **Foreground Muted (#5A5A66):** USD price subtext, captions, timestamps, breadcrumbs.
- **Success (#22C55E):** Live indicators, gains, "Cron Active" status, positive deltas.
- **Danger (#EF4444):** Kill switches, errors, losses, destructive confirmations.
- **Warning (#EAB308):** Pending payouts, advisory copy, throttle warnings.
- **Info (#3B82F6):** Informational notices, banner inserts.
- **Rank Gold/Silver/Bronze:** Medal icons for top-3 contributors. Used only on the leaderboard.

### Light palette (mirrored)

The light palette inverts the substrate (off-white `#FAFAFC` instead of near-black) while preserving role semantics. Surfaces step up: `bg` is `#FAFAFC`, `surface` is pure white, `surface-elevated` is `#F4F4F8`. Borders flip to light grays. The primary purple shifts darker (`#9333EA` instead of `#A855F7`) to maintain WCAG AA contrast on white.

Semantic colors (success, warning, danger, info) all darken proportionally and pair with light tinted backgrounds (e.g., `success-soft: #DCFCE7`). Rank medals shift to richer, lower-luminance tones so they read as gold/silver/bronze against light cards rather than pastel washes.

The substrate is intentionally **off-white, not pure `#FFFFFF`**. Pure white is sterile and amplifies any subpixel rendering issues in mono numerics. `#FAFAFC` is just warm enough to feel premium without losing the engineered feel.

WCAG: All foreground/surface combinations exceed 4.5:1 contrast in both palettes. The single exception is `fg-disabled` against `bg`, which is intentionally low-contrast and used only for disabled controls.

### Implementation pattern (Tailwind v4)

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  /* Dark palette is the default — exported by `npx @google/design.md export` */
  --bg: #08080C;
  --surface: #101015;
  --surface-elevated: #16161E;
  --surface-overlay: #1C1C25;
  --border: #23232E;
  --border-strong: #33333F;
  --primary: #A855F7;
  --primary-hover: #9333EA;
  --primary-pressed: #7E22CE;
  --primary-soft: #1F1429;
  --fg: #F5F5F7;
  --fg-secondary: #9494A0;
  --fg-muted: #5A5A66;
  /* ...and so on */
}

[data-theme="light"] {
  /* Light palette overrides — token names mirror :root exactly */
  --bg: #FAFAFC;
  --surface: #FFFFFF;
  --surface-elevated: #F4F4F8;
  --surface-overlay: #FFFFFF;
  --border: #E5E5EC;
  --border-strong: #D4D4DD;
  --primary: #9333EA;
  --primary-hover: #7E22CE;
  --primary-pressed: #6B21A8;
  --primary-soft: #F3E8FF;
  --fg: #0F0F14;
  --fg-secondary: #52525B;
  --fg-muted: #8B8B95;
  /* ...and so on */
}

@theme inline {
  /* `inline` keeps CSS variables resolvable at runtime so theme switches don't require a rebuild */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-primary: var(--primary);
  --color-fg: var(--fg);
  /* ...and so on */
}
```

Components reference utility classes (`bg-surface`, `text-fg`, `border-border`) and the right palette renders automatically based on the `data-theme` attribute. No JavaScript needed at the component level.

## Typography

Two type families:

- **Geist (sans):** Default for all UI text. Modern, geometric, technical without being cold. Open-source under SIL.
- **Geist Mono:** All numeric values that benefit from tabular alignment — SOL amounts, USD subtotals, scores, timestamps, wallet addresses, transaction hashes. Critical for the leaderboard, payout history, and admin tables.

Hierarchy is tight. Most surfaces use only 2-3 levels.

- **Display (48px):** Reserved for landing page hero and the live "Daily Fee Pool" amount on the project page.
- **Headline LG (32px):** Page titles inside the dashboard.
- **Headline MD (24px):** Section titles ("Leaderboard", "Pool Overview", "Recent Payouts").
- **Headline SM (18px):** Card titles, modal titles.
- **Body LG (16px):** Description copy, longer paragraphs.
- **Body MD (14px):** Default body text and most table cells.
- **Body SM (12px):** Secondary descriptions, table sub-rows (USD prices).
- **Label MD (14px):** Buttons, sidebar items, field labels.
- **Label SM (12px):** Pills, badges, status chips.
- **Caption (11px):** Timestamps, footer notes, meta lines.
- **Mono MD (14px):** Numeric values in tables, code, transaction signatures.
- **Mono SM (12px):** Tight numerics, meta, escrow IDs.

Body text is **400 weight**. Labels, headings, and UI emphasis are **500 or 600**. Bold (700+) is reserved for the brand mark and the page hero only.

Letter spacing is tight and negative on display/headline (-0.02 to -0.01em), neutral on body, and positive on small caps labels (0.01-0.02em).

## Layout

A **sidebar-plus-content** layout for all authenticated views. Public marketing routes use a top-nav layout instead.

- **Sidebar:** Fixed 240px width, full viewport height, `bg` background, 1px right border. Brand mark at top, primary nav in the middle, user-context card pinned at the bottom.
- **Content area:** Max 1440px width, centered, with 32px horizontal padding inside.
- **Top of content:** Header card (96px tall typically) showing the current scope (project, admin section, etc).
- **Body:** Two-thirds primary content (left) + one-third sidebar of supporting cards (right) on the leaderboard view. Single column on lists, settings, and forms.
- **Mobile:** Sidebar collapses behind a hamburger. Header and content stack vertically. Tables become card-list views below 768px.

Spacing rhythm follows a **4px base** with an **8px primary scale**. Component internal padding is 24px (cards), 16px (table rows), 12px (sidebar items), 10px (buttons). Inter-card gutters are 16px tight, 24px default, 32px loose.

## Elevation & Depth

GitBags is **flat by default**. Visual hierarchy comes from:

1. **Surface tonality** — three discrete background levels (`bg`, `surface`, `surface-elevated`).
2. **Borders** — 1px hairline borders define every card and table row.
3. **Color** — primary purple draws the eye; muted gray fades to background.

Box-shadow is used **only** in two places: dropdowns/popovers and modals. Shadows are theme-aware:

- **Dark theme** — popovers: `0 8px 24px rgba(0,0,0,0.4)`; modals: `0 20px 60px rgba(0,0,0,0.6)` plus `bg/60` backdrop with `backdrop-blur-md`.
- **Light theme** — popovers: `0 4px 16px rgba(15,15,20,0.08)`; modals: `0 20px 60px rgba(15,15,20,0.15)` plus `bg/60` backdrop. Lighter, tighter shadows because high-luminance backgrounds make heavy shadows look smudgy.

No glow effects in either theme. No drop-shadow on cards. No neumorphism. The "neon" in cypherpunk-neon comes from the **purple accent itself** in dark, and from **crisp 1px borders + clean tonal steps** in light, not from blur halos.

## Shapes

Corner radius is **moderate and consistent**. Never sharp (4px or less) and never overly soft (16px+).

- Buttons, inputs, pills: 8px (`md`)
- Cards: 12px (`lg`)
- Modals, hero panels: 16px (`xl`)
- Avatars, status dots, medal icons: full circle (`full`)

Mixing radii across sibling elements is forbidden — see Do's and Don'ts below.

## Components

### Buttons
Three variants: `primary` (purple, the only purple button on a screen), `secondary` (elevated surface with strong border), `ghost` (transparent until hover). `danger` exists for destructive admin actions. All sizes use 10×16 padding by default. Loading states show a 12px purple spinner left-aligned to the label.

### Pills and badges
- **Pill:** Rounded-full, primary-soft background, primary text. Used for "How Scoring Works", "View on Bags.fm", filter tags.
- **Badge live:** Rounded-full, success-soft background, success text, with a 6px pulsing green dot prefix. Used for cron status, live indicators.
- **Badge warning/danger:** Same shape, semantic color.

### Cards
The atomic content container. Always: `surface` background, 1px `border` border, 12px corner radius, 24px internal padding. A `card-interactive` variant brightens to `surface-elevated` on hover and is used for project tiles in `/explore`.

### Tables
Header row: 12px vertical padding, `fg-muted` text, label-sm typography, no top border, 1px bottom border. Data rows: 16px vertical padding, 1px bottom border (none on the last row). Numeric cells use mono. Hover brightens the row to `surface-elevated`. Top-3 ranks use a colored circular medal icon (gold/silver/bronze) in the rank column.

### Sidebar
Items are 10×12 padded, label-md typography, `fg-secondary` color by default. Active item: `surface-elevated` background, `fg` text, no left border accent (the elevation alone signals state). Hover: `surface` background, `fg` text. Icons are 16px Lucide, left-aligned with 12px gap to label.

### Inputs
8px corner radius, `surface` background, `border-strong` border, `body-md` typography, 10×14 padding. Focus state: border becomes `primary`. Error state: border becomes `danger`, helper text in `danger` below.

### Stat cards
Large numeric value in `display` or `headline-lg`, label below in `label-sm` `fg-secondary`. Sparkline (when present) sits to the right or below the number, using `chart-1` (primary purple) as stroke. Used in Pool Overview, admin Money Console, project Overview.

### Avatars
Always circular. Default 32px in tables, 48px in hero positions. GitHub `avatar_url` is the source of truth. Top-3 ranks get a small colored medal icon overlay in the bottom-right corner.

### Modals
24px-32px internal padding, 16px corner radius, `surface-overlay` background, 1px `border-strong` border, with a backdrop of `bg/60` plus `backdrop-blur-md`. Close button top-right. Confirmation modals (kill switch, force payout, etc.) require typing the project name to confirm.

### Tooltips
12-line max wrap, 8×12 padding, `surface-overlay` background, 1px `border-strong` border, 8px corner radius, `body-sm` typography. 200ms delay on hover.

### Empty states
Centered card-content, 64×64 Lucide icon in `fg-muted`, `headline-sm` title, `body-md fg-secondary` description, primary CTA button below. Never use illustrated graphics.

### Charts (sparklines, bars)
Recharts. Stroke 2px, no axis labels for sparklines, axis labels only when the data is the whole point of the card. Tooltip on hover uses the standard tooltip component. Color palette: `chart-1` through `chart-5`. Always purple-first (`chart-1` is `primary`).

## Do's and Don'ts

- **Do** use the primary purple for one element per visible viewport — the most important interactive element on screen. Everything else is white, gray, or semantic.
- **Don't** stack purple elements (pill + button + chart line all primary purple in the same fold). Pick one.
- **Do** use mono for every number that has economic meaning: SOL amounts, USD prices, scores, basis points, token counts.
- **Don't** use mono for body copy, headings, or descriptive text.
- **Do** maintain WCAG AA contrast everywhere except disabled controls, **in both themes**.
- **Don't** use pure black (#000) or pure white (#FFF). They feel sterile against the purple-biased surfaces. Use `bg` and `fg` tokens.
- **Do** show live data with a small pulsing green dot prefix (countdown timers, cron status, real-time pools).
- **Don't** use animated illustrations, lottie files, or bouncy springs. Motion is functional only.
- **Do** keep cards on a single tonal step (`surface` or `surface-elevated`, never half-tinted).
- **Don't** mix corner radii across sibling elements — if a card is `lg` (12px), the buttons inside it should be `md` (8px), not `xl`.
- **Do** show USD prices as small `fg-muted` subtext beneath the SOL value in mono.
- **Don't** abbreviate SOL amounts below 4 decimals. Mono alignment depends on consistent precision.
- **Do** treat numbers as the visual center of every screen. Tables, stat cards, and charts are the product.
- **Don't** decorate empty states with illustrations. Use a single Lucide icon and clear copy.
- **Do** prefix every administrative table row with a status indicator (live, paused, killed, pending).
- **Don't** use red as decoration. Red is reserved for destructive intent or live errors.

### Theming rules

- **Do** reference design tokens via utility classes (`bg-surface`, `text-fg`, `border-border`). Both themes resolve correctly without component changes.
- **Don't** hard-code hex values in components. Ever. The whole point of two-theme parity is automatic correctness.
- **Do** test every screen in both themes before merging. The QA bar is identical: same density, same contrast, same legibility.
- **Don't** use opacity tricks (`primary/20`, `fg/50`) for theme-aware effects. The light palette has explicit `*-soft` tokens; use those.
- **Do** use `next-themes` `useTheme()` only inside the toggle component itself. Components never read the theme; they just use tokens.
- **Don't** assume dark for chart colors. The `chart-1` through `chart-5` tokens shift between palettes; charts that hardcode hex will have broken contrast in light mode.
- **Do** persist the user's choice (`next-themes` does this automatically via `localStorage`), but default to `system` so first-load matches the OS preference.
- **Don't** ship a flash-of-wrong-theme. Use the inline-script pattern from `next-themes` and `suppressHydrationWarning` on `<html>` in the App Router root layout.
