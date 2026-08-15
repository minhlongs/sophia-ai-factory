# Design Guidelines — Sophia AI Factory

> Authoritative color and spacing values: `src/app/globals.css`.
> This document is derivative. When in doubt, trust `globals.css`.

## Design Philosophy

Sophia AI Factory uses a warm amber-on-cream palette (light default) with
deep indigo accents for dark mode. The system is professional, trustworthy,
and optimized for AI creators running faceless video and affiliate businesses.

Interface prioritizes clarity and action over decoration. Consistent spacing,
semantic colors, and accessible contrast are non-negotiable.

---

## 1. Typography

- **Body**: Inter (variable)
  - UI elements, headings, body text.
  - Weights: Regular (400), Medium (500), Semibold (600).
  - Used as display type in headers is permitted only when the visual hierarchy
    demands high weight and the rest of the system already renders Inter at body scale.

- **Monospace**: system fallback
  - API keys, data tables, metrics.

```css
font-family: var(--font-geist-sans); /* body */
font-family: var(--font-geist-mono); /* data/mono fallback */
```

## 2. Color Palette

Color semantics live in `globals.css` and Tailwind 4 utilities.

### Light mode (default)
- **Background**: warm cream paper (light)
- **Foreground**: deep indigo ink
- **Primary**: amber gold
- **Primary foreground**: white
- **Primary container**: warm amber tint
- **Secondary**: subtle lavender indigo
- **Muted**: light stone
- **Accent**: indigo

### Dark mode (`.dark` class)
- **Background**: `#0e0e12`
- **Foreground**: `#e7e4f0`
- **Primary**: `#c3c3ee` (indigo)
- **Primary container**: `#4e4f74`
- **Secondary**: `#c6c4dd`
- **Muted**: `#131318`

## 3. UI Components

Components follow shadcn/ui patterns with Tailwind 4 utilities and `tailwindcss-animate`.

### Buttons
- Default: solid primary background, contrast text.
- Outline: bordered, transparent background.
- Ghost: transparent, hover only.

### Cards
- Group related content (stats, affiliates, campaigns).
- Thin border, optional subtle background, rounded corners (`rounded-lg`).

### Inputs
- Minimal borders.
- Distinct focus state (`ring`).
- Error state: red border + descriptive text.

### Charts / Data Viz
- Use `recharts` with MD3 semantic color tokens (`bg-[hsl(var(--primary))]`).
- Keep data-ink ratio high: grid lines optional, labels clear.

## 4. Layout & Spacing

- Layout: CSS Grid + Flexbox.
- Dashboard: sidebar navigation + main content.
- Wizard: centered, single-column focus.
- Spacing: 4pt midpoint scale.
  - Common: `p-4` (16px), `p-6` (24px), `p-8` (32px).
  - Group gap: `gap-4` tight, `gap-8` section separation.

## 5. Feedback & Interaction

- Loading: skeletons or subtle spinners. Never leave user uncertain.
- Validation: inline, immediately adjacent to input. Green = valid, red = error.
- Transitions: `transition-all duration-200` on interactive elements unless motion is
  explicitly reduced by user preference.

## 6. Iconography

- Use **Lucide React** icons only.
- Attributes: `stroke-width={1.5}`, `w-4 h-4` for buttons, `w-6 h-6` for headings.

## 7. Accessibility (a11y)

- Ensure sufficient contrast for all text on every background.
- Never suppress browser focus outlines without a visible replacement.
- Semantic HTML: `<button>`, `<input>`, `<main>`, `<nav>`.

---
Last updated: 2026-08-15 — reconciled against `globals.css` shipped tokens.