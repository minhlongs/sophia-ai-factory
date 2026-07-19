---
phase: 3
title: "Hero section modernization"
status: done
priority: P2
effort: 1h
blocked_by: [phase-01]
---

# Phase 03: Hero Section Modernization

## Context

- [Hero section](../../src/app/components/sections/hero.tsx) — 188 lines, already i18n'd
- Already uses `useTranslations("landing.hero")`
- 17 inline `style={{}}` calls — high density for a single component
- Current design: typing rotator + gradient orbs + terminal preview + CTAs
- Layout is functional but has visual noise from too many competing elements

## Requirements

### Functional
- Better visual hierarchy: headline > subtitle > CTAs > terminal preview
- Reduce number of competing visual elements
- Keep existing i18n keys (no translation changes needed)

### Non-Functional
- Stay under 200 lines (currently 188 — tight budget)
- Replace inline styles with Tailwind classes or CSS custom properties
- No new dependencies
- No visual regression in trust indicators or CTAs

## Implementation Steps

### 1. Replace inline styles with Tailwind utilities

Current inline style patterns and their replacements:

| Line(s) | Current inline | Replace with |
|---------|---------------|-------------|
| 47 | `style={{ color: "var(--neon-cyan)" }}` | `className="text-neon-cyan"` (already mapped: `--color-neon-cyan`) |
| 49 | `style={{ color: "var(--neon-cyan)", opacity: 0.7 }}` | `className="text-neon-cyan/70"` |
| 63 | `style={{ background: "var(--neon-cyan)", opacity: 0.07 }}` | `className="bg-neon-cyan/7"` |
| 66 | `style={{ background: "var(--neon-purple)", opacity: 0.08 }}` | `className="bg-neon-purple/8"` |
| 71 | `style={{ background: "var(--neon-cyan)", opacity: 0.04 }}` | `className="bg-neon-cyan/4"` |
| 78-83 | Dot grid background image | Move to CSS class `.dot-grid-overlay` in globals.css |
| 89-93 | Badge styles | Use Tailwind: `bg-white/4 border-neon-cyan/15 text-neon-cyan` |
| 158-159 | Trust indicator wrapper color | Use `text-slate-400/50` |
| 165 | Trust dot neon-cyan | `className="bg-neon-cyan/70"` |
| 171 | Trust dot neon-purple | `className="bg-neon-purple/80"` |
| 182 | Scroll indicator border | `border-neon-cyan/20` |
| 184 | Scroll indicator dot | `bg-neon-cyan/40` |

**Note:** Verify `text-neon-cyan` and `bg-neon-cyan` work with Tailwind CSS 4 color mapping. The globals.css has `--color-neon-cyan: var(--neon-cyan)` at line 137 which should enable `text-neon-cyan` and `bg-neon-cyan` utilities. Test in build.

**Fallback:** If Tailwind 4 arbitrary color syntax doesn't support opacity modifiers on custom properties, use `className="text-[var(--neon-cyan)]"` with separate opacity utility. Or keep `style={{}}` for the 3-4 cases that truly need it (gradient backgrounds with specific opacity).

### 2. Add dot grid CSS class

**File:** `src/app/globals.css`

```css
.dot-grid-overlay {
  background-image: radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

Replace the inline style block at lines 78-83 in hero.tsx with `className="absolute inset-0 opacity-[0.04] dot-grid-overlay"`.

### 3. Improve visual hierarchy

Small adjustments to spacing and emphasis:

- **Badge:** Slightly larger padding, add subtle `backdrop-blur-md` (currently `backdrop-blur-sm`)
- **Headline:** Add `drop-shadow-[0_0_30px_rgba(0,240,255,0.15)]` on the gradient text span for glow effect
- **Subtitle:** Tighten `mb-12` to `mb-10` — currently too much gap before CTAs
- **CTAs:** Primary button: add `shadow-lg shadow-neon-cyan/20` for depth. Remove third "demo" button scroll-to — it competes with the primary CTA
- **Terminal preview:** Add `mt-16` (currently no explicit top margin — relies on container spacing)
- **Trust indicators:** Change from `mt-14` to `mt-10` — tighten bottom section

### 4. Simplify gradient orbs

Reduce from 3 orbs to 2. Remove the center orb (line 70-72) — it overlaps with the other two and creates muddy blending. The two remaining orbs (top-left cyan, bottom-right purple) provide sufficient ambient lighting.

## Todo List

- [ ] Add `.dot-grid-overlay` class to `globals.css`
- [ ] Replace 12+ inline `style={{}}` with Tailwind classes in `hero.tsx`
- [ ] Verify `text-neon-cyan` / `bg-neon-cyan` work with Tailwind 4 color vars
- [ ] Remove third gradient orb (center)
- [ ] Tighten spacing: subtitle mb, trust indicators mt
- [ ] Add glow shadow to primary CTA button
- [ ] Add drop-shadow to gradient headline text
- [ ] Run `npm run build` — 0 errors
- [ ] Test at 375px mobile — verify no overflow or text wrapping issues

## Success Criteria

- Inline `style={{}}` count in hero.tsx reduced from 17 to <5
- Build passes
- Visual hierarchy improved: clear scan path from headline → CTA
- No layout shift on mobile

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tailwind 4 color vars don't support opacity modifier | Medium | Medium | Test `bg-neon-cyan/10` in build; fallback to `bg-[color-mix(in_srgb,var(--neon-cyan)_10%,transparent)]` or keep inline |
| Removing third orb makes background too sparse | Low | Low | A/B compare visually; can revert single line |
| drop-shadow on text looks heavy in light mode | Medium | Low | Scope to dark mode with `dark:drop-shadow-[...]` |

## Failure Modes

1. **Tailwind class not generated** → orb backgrounds invisible. Mitigation: check Tailwind output CSS includes the custom color utilities. If not, add to `safelist` or use explicit CSS class.
2. **`animationDelay` inline styles still needed** → these are functional (stagger timing), acceptable to keep as inline. Only cosmetic styles need migration.
