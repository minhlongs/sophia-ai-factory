---
phase: 4
title: "Visual consistency pass"
status: done
priority: P2
effort: 1h
blocked_by: [phase-01]
---

# Phase 04: Visual Consistency Pass

## Context

After Phases 1-3, remaining sections need inline style cleanup. This phase sweeps all landing sections not touched by earlier phases.

Current inline `style={{}}` counts:
- SocialProof: 9 (after Phase 1 split, distributed across sub-components)
- CtaSection: ~3 (unverified — 77 lines)
- AgiCapabilities: ~5 (unverified — 138 lines)
- RaaSShowcase: ~4 (106 lines)
- Workflow: ~3 (99 lines)

## Requirements

### Functional
- Replace cosmetic inline styles with Tailwind utilities across remaining sections
- Verify consistent use of design tokens (neon-cyan, neon-purple, neon-pink)
- Ensure consistent section spacing pattern: `py-28` for major sections, `py-20` for minor

### Non-Functional
- No visual regression
- No new CSS classes unless reusable across 2+ sections
- Build must pass

## Implementation Steps

### 1. Audit inline styles in remaining sections

Read each file, catalog every `style={{}}`, classify as:
- **Cosmetic** (color, background, opacity) → migrate to Tailwind
- **Functional** (animation delay, dynamic values) → keep inline
- **Gradient** (complex linear-gradient) → consider CSS class if reused

### 2. Common inline style patterns to replace

These patterns appear across multiple sections:

```tsx
// Pattern A: neon-cyan text color (appears ~15 times across all sections)
style={{ color: "var(--neon-cyan)" }}
→ className="text-neon-cyan"

// Pattern B: neon-cyan background glow orb
style={{ background: "var(--neon-cyan)", opacity: 0.04 }}
→ className="bg-neon-cyan/[0.04]"

// Pattern C: badge styling (appears in Features, SocialProof, Workflow, etc.)
style={{ color: "var(--neon-cyan)", background: "rgba(0,240,255,0.05)", borderColor: "rgba(0,240,255,0.1)" }}
→ className="text-neon-cyan bg-neon-cyan/5 border-neon-cyan/10"

// Pattern D: subtle white background
style={{ background: "rgba(255,255,255,0.06)" }}
→ className="bg-white/[0.06]"

// Pattern E: section dark background
style={{ background: "linear-gradient(135deg, #060d16 0%, #0f172a 100%)" }}
→ Add CSS class `.bg-section-dark` to globals.css (used in SocialProof stats bar)
```

### 3. Add reusable CSS classes to globals.css

Only add if used in 2+ places:

```css
/* Dark section background — used in stats bar and similar dark containers */
.bg-section-dark {
  background: linear-gradient(135deg, #060d16 0%, #0f172a 100%);
}
```

### 4. Verify section spacing consistency

Check `py-*` values across all sections:

| Section | Current | Target |
|---------|---------|--------|
| Hero | `min-h-screen pt-16` | Keep (full viewport) |
| RaaSShowcase | Verify | `py-28` |
| Workflow | Verify | `py-28` |
| Features | `py-28` | Keep |
| CreativeStudioShowcase (new) | — | `py-28` |
| RaasDemoTerminal | Verify | `py-28` |
| SocialProof | `py-28` | Keep |
| PricingSection | Verify | `py-28` |
| ProductionCostCalculator | Verify | `py-20` (secondary) |
| AgiCapabilities | Verify | `py-28` |
| AffiliateDiscovery | Verify | `py-28` |
| FAQ | Verify | `py-20` (secondary) |
| CtaSection | Verify | `py-28` |

### 5. Check AgiCapabilities and CtaSection for hardcoded strings

Quick scan for any remaining un-i18n'd strings. If found, wire to `useTranslations`. Add missing keys to `messages/*.json`.

**Files to check:**
- `src/app/components/agi-capabilities-section.tsx` (138 lines)
- `src/app/components/sections/cta-section.tsx` (77 lines)

## Todo List

- [ ] Audit inline styles in: social-proof sub-components, cta-section, agi-capabilities, raas-showcase, workflow
- [ ] Replace cosmetic inline styles with Tailwind utilities
- [ ] Add `.bg-section-dark` to globals.css if pattern found in 2+ places
- [ ] Verify section spacing consistency (`py-28` / `py-20`)
- [ ] Check agi-capabilities and cta-section for hardcoded strings
- [ ] Wire any remaining hardcoded strings to i18n
- [ ] Run `npm run build` — 0 errors
- [ ] Visual regression check at 375px and 1280px

## Success Criteria

- Total inline `style={{}}` count across all landing sections reduced by 50%+
- Consistent section padding across landing page
- No hardcoded user-facing strings remain in any landing section
- Build passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tailwind opacity modifiers on CSS vars not working | Medium | Medium | Test early; keep inline for complex cases |
| Color rendering differences between inline and Tailwind | Low | Low | Visual compare before/after |
| Missed section with hardcoded strings | Low | Medium | Grep for Vietnamese chars across all section files |

## Failure Modes

1. **Tailwind purge removes unused custom color classes** → test in production build. Add to safelist if needed.
2. **Section spacing change causes layout shift** → only change spacing if clearly inconsistent; don't "fix" intentional variation.

## Backwards Compatibility

No API or data changes. Pure UI refactor. Fully revertible via single git revert.

## Test Matrix

| Test | Method |
|------|--------|
| Build passes | `npm run build` |
| No hardcoded Vietnamese | `grep -rn "[\x{4e00}-\x{9fff}\x{0100}-\x{024f}]" src/app/components/sections/ --include="*.tsx"` + manual scan for Vietnamese diacritics |
| Visual regression | Browser check at 375px, 768px, 1280px |
| i18n switching | Toggle locale en ↔ vi, verify all sections translate |
