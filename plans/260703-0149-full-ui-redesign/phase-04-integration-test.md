---
phase: 4
title: "Integration Test & Deploy Readiness"
status: pending
effort: "1-2h"
dependsOn: ["Phase 2: Parallel P0 Screens", "Phase 3: Setup Wizard + Dashboard Shell"]
---

# Phase 4: Integration Test & Deploy Readiness

## Overview

Final verification across all 5 P0 screens. Confirm i18n complete (VN+EN), build passes, protected flows intact, no regressions. Prepares the amber-themed P0 screens for production deployment.

This phase does NOT generate or convert any screens — it validates Phase 2 and Phase 3 outputs.

## Prerequisites

- Phase 2 complete: Landing Hero, Pricing, Login/Register screens amber-themed and integrated
- Phase 3 complete: Setup Wizard, Dashboard Shell amber-themed and integrated
- All `npm run type-check` and `npm run build` passes from individual phases

---

## Step 1: Full Build Verification

```bash
cd apps/sophia-ai-factory
npm run build
```

**Required:** Exit code 0, zero TypeScript errors, zero ESLint errors.

**What to check:**
- No amber-related Tailwind class warnings (dark mode class conflicts, unknown classes)
- Worker bundle size delta — note if Stitch HTML ballooned the bundle (>50KB increase is a warning)
- All 139+ source maps uploaded (check build output for "✓ Compiled successfully")

### Build Failure Triage

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `text-amber-*` class not found | Missing Tailwind config for amber | Verify `tailwind.config.ts` includes amber in theme colors |
| `Module not found: '@/components/stitch/screens/...'` | Import path typo | Check import path matches actual file |
| Type error in page.tsx | New component prop mismatch | Align Stitch component props with existing page expectations |
| i18n key missing warning | New text without translation key | Add key to en.json + vi.json |

---

## Step 2: i18n Audit (All 5 Screens)

Run i18n validation:

```bash
cd apps/sophia-ai-factory
npm test -- --run  # includes i18n:validate pretest
```

### Manual i18n Checklist

For each screen, verify bilingual completeness:

**Landing Hero (`/[locale]/`)**
- [ ] Hero headline + subheading: VN + EN
- [ ] CTA buttons: "Start Free" / "Bắt đầu miễn phí"
- [ ] Feature cards: 3 cards with VN+EN
- [ ] Trust bar: "10,000+ creators" text VN+EN
- [ ] FAQ accordion: all items VN+EN
- [ ] Locale toggle visible and functional

**Pricing (`/[locale]/pricing`)**
- [ ] Page heading + subheading: VN + EN
- [ ] Monthly/Yearly toggle labels: VN + EN
- [ ] 4 tier cards: plan name, price, features list, CTA button VN+EN
- [ ] "Most Popular" badge: VN + EN
- [ ] FAQ accordion: all items VN+EN
- [ ] HeyGen configure prompt: VN + EN

**Login (`/[locale]/login`)**
- [ ] "Welcome back" heading + subtitle: VN + EN
- [ ] Email/Password labels + placeholders: VN + EN
- [ ] "Forgot password?" link: VN + EN
- [ ] Sign In button: VN + EN
- [ ] "or continue with" divider: VN + EN
- [ ] "Don't have an account?" / Sign up link: VN + EN
- [ ] Magic Link button label: VN + EN
- [ ] Error messages: VN + EN

**Register (`/[locale]/login?tab=signup`)**
- [ ] Company Name label + placeholder: VN + EN
- [ ] Email/Password/Confirm Password labels: VN + EN
- [ ] Terms checkbox text: VN + EN
- [ ] Create Account button: VN + EN
- [ ] "Already have an account?" link: VN + EN
- [ ] Success message: VN + EN
- [ ] Password validation errors: VN + EN

**Setup Wizard (`/[locale]/dashboard/onboarding`)**
- [ ] Wizard title + subtitle: VN + EN
- [ ] 5 stepper labels: VN + EN
- [ ] Welcome step content: VN + EN
- [ ] System Check status labels: VN + EN
- [ ] AI Keys labels + placeholders: VN + EN
- [ ] Provider Credentials labels: VN + EN
- [ ] Review step summary: VN + EN
- [ ] Back/Next/Save buttons: VN + EN
- [ ] All error messages: VN + EN
- [ ] Footer text: VN + EN

**Dashboard Shell (`/[locale]/dashboard`)**
- [ ] Sidebar nav items: VN + EN
- [ ] Tier badge: VN + EN
- [ ] Quota widget: VN + EN
- [ ] Sign out button: VN + EN
- [ ] KPI card labels: VN + EN
- [ ] Quick Action titles: VN + EN
- [ ] Breadcrumb: VN + EN
- [ ] Search placeholder: VN + EN

---

## Step 3: Protected Flow Walkthrough

### Flow 1: Setup Wizard (BYOK)

**Pre-condition:** Fresh account, no onboarding completed.

```
1. Create new account (or use test account with onboarding_completed_at = null)
2. Navigate to /dashboard → auto-redirect to /dashboard/onboarding
3. Step 1 (Welcome): verify VN/EN text, click Next
4. Step 2 (System Check): verify health indicators load
5. Step 3 (AI Keys): enter valid OpenRouter key → click Verify → green checkmark appears
6. Step 3 (AI Keys): enter invalid key → click Verify → red X + error message
7. Step 4 (Provider Credentials): enter HeyGen key → test → green checkmark
8. Step 5 (Review): verify all keys shown (masked)
9. Click Save → wait for "Saving..." → redirect to /dashboard
10. Navigate to /dashboard/onboarding → auto-redirect back to /dashboard (onboarding_completed_at set)
```

**Pass criteria:** All 10 steps complete without errors. API keys persisted. No redirect loop.

### Flow 2: Login + Register

**Pre-condition:** No active session.

```
1. Navigate to /login → see login form (amber themed)
2. Test password visibility toggle (eye icon)
3. Test locale toggle (VI ↔ EN) → all text switches
4. Submit empty form → HTML5 validation triggers
5. Submit invalid credentials → error banner appears
6. Click "Forgot password?" → navigates to /reset-password
7. Click "Create account" → switches to register tab
8. Fill register form → submit with mismatched passwords → error
9. Submit valid registration → success page → "Go to Login" link
10. Login with new credentials → redirect to /dashboard/onboarding (first-time)
```

**Pass criteria:** All 10 steps. Login flow works end-to-end. Register creates valid account.

### Flow 3: Payment Flow (NOWPayments)

**NOT in scope for this phase** — payment pages and billing flows are part of later phases. Verify only that `/pricing` page renders tier cards correctly and that the "Start Free Trial" / "Get Started" buttons link to login (for unauthenticated) or dashboard (for authenticated).

### Flow 4: Telegram Bot

**NOT in scope for this phase** — Telegram integration is server-side and unaffected by UI changes. Verify `npm test` passes (Telegram bot tests included in 6694+ test suite).

---

## Step 4: Route Testing

Manual verification of all 5 route pages:

### Cold Start (no cache)
```bash
# Test each route returns HTTP 200
curl -sI http://localhost:3000/en          # Landing
curl -sI http://localhost:3000/vi          # Landing VN
curl -sI http://localhost:3000/en/pricing  # Pricing
curl -sI http://localhost:3000/vi/pricing  # Pricing VN
curl -sI http://localhost:3000/en/login    # Login
curl -sI http://localhost:3000/vi/login    # Login VN
```

### SSR Rendering
- Visit each route in browser incognito
- Verify: no flash of unstyled content, no hydration errors in console
- Verify: dark background #0F0F11 is visible immediately (not white flash)
- Verify: amber-colored elements visible (buttons, links, accents)

### Mobile Responsive
- Test each route at 375px, 768px, 1024px, 1440px widths
- Verify: no horizontal scroll, text not cut off, buttons tappable (min 44px touch target)
- Verify: mobile nav appears on <768px
- Verify: StickyMobileCta visible on mobile landing page

---

## Step 5: Full Test Suite

```bash
cd apps/sophia-ai-factory
npm test
```

**Required:** All 6694+ tests pass. Zero regressions.

**Expected failures (acceptable):**
- Snapshot tests may fail due to class name changes (amber vs indigo) — update snapshots with `npx vitest run --update`
- i18n key tests may flag new keys as "unused" — these are intentionally new. Verify each flagged key.

**Blocking failures:**
- Any auth test fails
- Any setup wizard test fails
- Any dashboard test fails
- Any TypeScript compilation error

---

## Step 6: Deployment Readiness Checklist

Before marking Phase 4 complete, verify:

- [ ] `npm run build` exits 0, zero TypeScript errors
- [ ] `npm test` passes all tests (6694+)
- [ ] `npm run lint` passes (0 errors, warnings OK for new i18n keys)
- [ ] All 5 P0 screens render with amber theme
- [ ] All 5 P0 screens bilingual VN+EN complete
- [ ] Protected Flow #1 (Setup Wizard) end-to-end functional
- [ ] Login/Register flow end-to-end functional
- [ ] Dashboard auth gate works (unauthenticated → redirect to /login)
- [ ] Locale toggle works on all screens
- [ ] Zero hardcoded Vietnamese/English strings in components (all via useTranslations)
- [ ] Zero `:any` types in new/modified files
- [ ] Zero `console.log` in new/modified files
- [ ] No seed/ui components bypassed (all primitives via `@/seed/components/ui/*`)
- [ ] Worker bundle size within acceptable range (<50KB increase from indigo → amber conversion)

---

## Success Criteria

- [ ] i18n audit: all 5 screens have complete VN+EN coverage
- [ ] Protected Flow #1: Setup Wizard walkthrough passes all 10 steps
- [ ] Login + Register: end-to-end flow passes all 10 steps
- [ ] `npm run build` passes with 0 errors
- [ ] `npm test` passes (6694+ tests, zero regressions)
- [ ] `npm run lint` passes (0 errors)
- [ ] All 5 routes return HTTP 200 (EN + VI variants)
- [ ] No hydration errors in browser console
- [ ] Mobile responsive at 375px/768px/1024px/1440px
- [ ] Deployment readiness checklist: all 13 items checked

## Rollback Plan

If integration tests reveal systemic issues:
1. Identify which phase introduced the breakage (Phase 2 or Phase 3)
2. Revert that phase's changes: `git checkout -- <phase-files>`
3. Fix the root cause in the Stitch prompt or conversion code
4. Re-run the phase
5. Re-run integration test

If build is broken and cause unclear:
```
git stash
npm run build  # confirm clean build on base
git stash pop  # re-apply changes
# Binary search: revert half the changes, build, repeat
```

## Next Steps After Phase 4

Phase 4 validates P0 screens only (5 of 45+ pages). Remaining screens follow the same pipeline pattern:

- **P1 Screens** (Phase 5+): Campaign Management, Video Creation, Affiliate Portal, Settings, Admin Dashboard
- **P2 Screens** (Phase 8+): Agent Chat, SOP Marketplace, Creative Studio, Analytics, Billing

Each subsequent phase follows: Stitch prompt → HTML → Next.js conversion → seed/ui replacement → i18n → route integration → verify.
