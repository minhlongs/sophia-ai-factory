# UI/UX Refactor Plan — Sophia AI Factory

**Date**: 2026-06-16  
**Scope**: `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/*`  
**Audit Reference**: `FE-ARCHITECTURE-AUDIT.md` (sections 5, 8, 10)

---

## Overview

Standardize UI/UX across Sophia AI Factory dashboard by:
- Adding missing loading/error boundaries
- Enforcing design system adoption
- Improving accessibility
- Ensuring responsive design
- Adding empty states
- Fixing internationalization

---

## Phase 1: Critical Missing Boundaries (P0)

### 1.1 Create Missing loading.tsx Files

**Targets**:
- `/dashboard/challenges/loading.tsx` — Grid of challenge cards with progress bars
- `/dashboard/finance/loading.tsx` — Stats cards + table/placeholder (redirect check needed)
- `/dashboard/handover/loading.tsx` — HandoverClient placeholder skeleton
- `/dashboard/leaderboard/loading.tsx` — Tabs + table skeleton
- `/dashboard/sop-creator/loading.tsx` — Stats cards + template grid

**Design**: Use `<Skeleton>` from `@/seed/components/ui/skeleton` with shimmer effect.

### 1.2 Create Missing error.tsx Files

**Targets**:
- `/dashboard/advisor/error.tsx`
- `/dashboard/agi/error.tsx`
- `/dashboard/challenges/error.tsx`
- `/dashboard/finance/error.tsx`
- `/dashboard/handover/error.tsx`
- `/dashboard/leaderboard/error.tsx`
- `/dashboard/schedule/error.tsx`
- `/dashboard/sop-creator/error.tsx`

**Design**: Follow existing `DashboardError` pattern with bilingual error messages, Sentry logging, retry/login actions.

---

## Phase 2: Design System Adoption (P1)

### 2.1 Replace Custom Buttons
- Search for `<button` without `<Button` wrapper
- Replace with `<Button variant="...">` from `@/seed/components/ui/button`

### 2.2 Replace Custom Alerts
- Search for inline error divs like `role="alert"` with custom styles
- Replace with `<Alert>` from `@/seed/components/ui/alert` where appropriate

### 2.3 Use Card Components
- Replace custom card divs with `<Card>`, `<CardHeader>`, `<CardContent>` where content-focused

---

## Phase 3: Accessibility Audit (P1)

### 3.1 Check for:
- `alt` text on all `<img>` tags
- `aria-label` on icon-only buttons
- Proper heading hierarchy (h1→h2→h3, no skipped levels)
- `aria-invalid` and `aria-describedby` on form inputs with errors
- `aria-hidden="true"` on decorative icons (already used in skeletons)

### 3.2 Form Validation
- Ensure Server Action errors are displayed inline
- Add `aria-invalid={true}` when field has error
- Link error message with `aria-describedby`

---

## Phase 4: Empty States (P1)

### 4.1 Verify Existing Empty States
- `/dashboard/campaigns` — already uses `EmptyState` ✅
- `/dashboard/wallet` — check if empty transaction table shows `EmptyState`
- `/dashboard/videos` — check empty video list

### 4.2 Add Missing Empty States
- `/dashboard/wallet` — if no transactions, show appropriate `EmptyState`
- `/dashboard/videos` — already has? verify
- Reuse `@/seed/components/ui/empty-state`

---

## Phase 5: Internationalization (P1)

### 5.1 Find Hardcoded Strings
- Search for: `"` or `'` not preceded by `t(` or `getTranslations`
- Wrap in translation function
- Ensure both en/vi translations exist

### 5.2 Common Culprits
- Static labels in tables
- Placeholder text
- Button text not using translations
- Error messages

---

## Phase 6: Responsive Design (P2)

### 6.1 Check Horizontal Overflow
- Test mobile viewport (375px)
- Find elements with `min-width` causing overflow
- Check tables with fixed widths
- Ensure `overflow-x-auto` on table containers

### 6.2 Consistent Breakpoints
- Use `sm:`, `md:`, `lg:` consistently
- Avoid arbitrary values like `w-[800px]`

---

## Phase 7: Mobile Navigation (P2)

### 7.1 Verify `/dashboard` Mobile Menu
- Hamburger icon works
- Drawer closes on navigation
- Touch targets ≥44px
- Proper focus management

---

## Phase 8: Skeleton Consistency (P2)

### 8.1 Match Structure
- Ensure skeleton layout matches actual content structure
- Number of skeleton items matches typical data volume
- Use shimmer variant for visual polish

---

## Implementation Order

1. **Create all missing loading.tsx** (5 files) — 2 hours
2. **Create all missing error.tsx** (8 files) — 2 hours
3. **Run initial build & test** — verify no regressions
4. **Audit accessibility** — fix issues (aria, alt, headings) — 2 hours
5. **Audit design system adoption** — replace custom buttons/alerts — 2 hours
6. **Audit internationalization** — wrap hardcoded strings — 1 hour
7. **Verify empty states** — add missing ones — 1 hour
8. **Responsive design check** — fix overflow issues — 1 hour
9. **Final build & test** — ensure all green
10. **Write final report** — `UI-UX-REPORT.md`

**Total Estimated**: ~14 hours

---

## Success Criteria

- ✅ All dashboard routes have loading.tsx and error.tsx
- ✅ No custom button classes; all use `<Button>`
- ✅ All images have alt text
- ✅ All icon buttons have aria-label
- ✅ Form errors have aria-invalid and aria-describedby
- ✅ Empty states use reusable `EmptyState` component
- ✅ No hardcoded strings (all wrapped in t())
- ✅ No horizontal overflow on mobile (375px)
- ✅ `npm run build` passes with 0 errors
- ✅ `npm test` passes with 0 failures

---

## Risks

- **Breaking existing routes**: Test each change with `npm run build` immediately
- **Translation coverage**: Adding new t() keys requires updating translation files
- **Design system gaps**: May need new components if existing ones are insufficient

---

## Notes

- Bilingual support (en/vi) required for all user-facing text
- Use existing design system at `@/seed/components/ui/`
- Maintain Next.js 16 App Router conventions
- Do not break protected route middleware
