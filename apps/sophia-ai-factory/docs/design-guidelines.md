# Design Guidelines — Sophia AI Factory

> **Canonical Authority:** `src/app/globals.css`, `src/seed/design-tokens/zen-design-tokens.dtcg.json`, and root `DESIGN.md` (Zen Design OS v1.0).
> This document is a derivative summary reconciled to Zen Design OS v1.0. When in doubt, `src/app/globals.css` wins.

## Design Philosophy

Sophia AI Factory uses **Zen Design OS v1.0** — a Dark-first (`defaultTheme="dark"` — *Director's Control Deck*) and First-Class Light Mode (*Executive Studio Ivory*) Material 3 Expressive system built for non-technical SME Founders and CEOs.

Interface prioritizes clarity and action over decoration. Consistent spacing, semantic colors, and WCAG 2.2 AA contrast in both Dark and Light modes are non-negotiable.

---

## 1. Typography

- **Product UI, Headings & Body (`--font-sans`)**: `'Inter'`, system-ui, -apple-system, BlinkMacSystemFont, `'Segoe UI'`, Roboto, sans-serif (weights 400–800, Latin + Vietnamese `unicode-range` subsets).
- **Telemetry, Code & Numeric Readouts (`--font-mono`)**: `'JetBrains Mono'`, ui-monospace, SFMono-Regular, Menlo, monospace (`tabular-nums`, weights 400–600).
- **Scoped Landing Display (`.v3-core` only)**: `'Archivo'` declared in `src/styles/v3-core.css`. `Satoshi`, `Instrument Serif`, and `Geist` are not used.

```css
font-family: var(--font-sans); /* Inter — UI & body */
font-family: var(--font-mono); /* JetBrains Mono — code, keys, telemetry */
```

## 2. Color Palette

Color semantics live in `src/app/globals.css` and `src/seed/design-tokens/zen-design-tokens.dtcg.json`.

### Dark mode (`.dark` class — runtime default)
- **Background (`--background` / `--surface`)**: `#090A10`
- **Card (`--card` / `--surface-container`)**: `#11131F`
- **Foreground (`--foreground` / `--on-surface`)**: `#F8FAFC`
- **Muted foreground (`--muted-foreground` / `--on-surface-variant`)**: `#94A3B8`
- **Primary (`--primary`)**: `#6366F1` (`--primary-text: #818CF8`, `--primary-solid: #4F46E5`)
- **Secondary (`--secondary`)**: `#A855F7`
- **Accent / Warning (`--accent` / `--warning`)**: `#F59E0B`
- **Success (`--success`)**: `#10B981`
- **Error / Destructive (`--error` / `--destructive`)**: `#FB7185` / `#F43F5E`

### Light mode (`:root` — Executive Studio Ivory)
- **Background (`--background` / `--surface`)**: `#F8F9FC`
- **Card (`--card` / `--surface-container`)**: `#FFFFFF`
- **Foreground (`--foreground` / `--on-surface`)**: `#0B0F19`
- **Muted foreground (`--muted-foreground` / `--on-surface-variant`)**: `#475569`
- **Primary (`--primary` / `--primary-text`)**: `#4338CA`
- **Secondary (`--secondary`)**: `#7E22CE`
- **Accent / Warning (`--accent` / `--warning`)**: `#B45309`
- **Success (`--success`)**: `#047857`
- **Error / Destructive (`--error` / `--destructive`)**: `#BE123C`

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

## 8. Motion

- Keep it purposeful and brief.
- Use `transition-all duration-200` for interactive states.
- Reduce motion when the user prefers reduced motion.
- Avoid decorative motion that doesn’t communicate state.

## 9. Accessibility

- Maintain contrast ratios for all text on every background.
- Never remove focus outlines without a visible replacement.
- Use semantic elements and labels.
- Ensure keyboard operability for every interaction.

## 10. High-Converting Video Creative Design Tokens & Motion (SaaS & Crypto)

### SaaS Clean Dark UI (Video Canvas)
- **Background**: Minimalist Obsidian `#0B0F19` with subtle card contrast `#111827`.
- **Primary Highlights**: Neon Indigo `#6366F1` and Amber `#CA7F16`.
- **Mockup Zoom**: Dynamic 125%-140% camera pan targeting UI text inputs and outputs.
- **Pacing**: Cut duration 0.8s - 1.8s for short-form (9:16); zero dead air (>150ms silence trimmed).

### Crypto Cyber-Fintech & Compliance Overlays
- **Obsidian Trading Canvas**: Slate `#0A0B0E`, Chart Emerald `#00F59B`, Chart Crimson `#F6465D`.
- **Persistent Bottom-Third Banner**: `rgba(10, 11, 14, 0.85)` with `rgba(255, 255, 255, 0.1)` border, margin-bottom 96px for vertical safe area.
- **15s End-Card Legal Disclosure**: Full-screen static card, WCAG AA contrast ratio ≥ 4.5:1, audio dipped to -18dB.

## 11. Recent Changes (Release Notes)

| Date | Change |
|------|---------|
| 2026-10-07 | Add high-converting video creative design tokens & compliance overlay specifications for SaaS & Crypto Global niches. |
| 2026-08-16 | Normalize registration failure UX; classify rate limit, service unavailable, and password cases in the register form. |
| 2026-08-15 | Reconcile design tokens against `globals.css` as single source of truth. |

---
Last updated: 2026-10-07 — reconciled against `globals.css` shipped tokens.