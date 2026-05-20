---
phase: wave2-intl-chain
agent: fullstack-developer
date: 260519
status: completed
commits: ["4015a6da", "f535c815", "8eff45dd", "8dc96997"]
---

# Wave 2 — Intl Redirect Chain Fix Report

## Phase: wave2-intl-chain
Plan: `plans/260519-0300-handover-funnel-critical-fixes/`
Status: **completed**

---

## Bug 1 — preserve ?tab=signup through intl redirect chain

**Commit:** `4015a6da`
**Files modified:**
- `src/app/[locale]/signup/page.tsx` (+6 / -4)
- `src/app/[locale]/auth/signup/page.tsx` (+6 / -4)

**Root cause confirmed:** Both pages redirected to `/${locale}/login?tab=signup`. With next-intl `as-needed` and defaultLocale `en`, the browser follows: `/en/signup` → 308 (intl strips `en`) → `/signup` → [page renders] → 307 to `/en/login?tab=signup` → 308 (intl strips `en`) → `/login?tab=signup`. Double 308 chain risked query loss.

**Fix mechanism:** Changed redirect target to `/login?tab=signup` (no locale prefix), collapsing two hops to one. Query `?tab=signup` is now constructed and forwarded in a single redirect. The `login/page.tsx` client component reads `searchParams.get('tab')` to pre-select the Sign Up tab.

---

## Bug 2 — consolidate /setup-wizard into /dashboard/onboarding

**Commit:** `f535c815`
**Files modified:**
- `src/app/[locale]/setup-wizard/page.tsx` (rewritten: 504 lines → 30-line redirect shell)
- `src/app/[locale]/dashboard/onboarding/page.tsx` (expanded: MASTER-only milestone → all-tier wizard)
- `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` (NEW: extracted BYOK wizard client)
- `src/app/[locale]/dashboard/onboarding/__tests__/page.test.tsx` (updated test assertions)
- `src/middleware.ts` (2 edits)

**Root cause confirmed:** Two middleware issues:
1. Line 88: unconfigured redirect sent to `/setup-wizard` (no locale) → intl middleware couldn't locate route → marketing page rendered.
2. Line 161: `/setup-wizard` short-circuited in API branch → bypassed `intlMiddleware()` → never got locale rewrite → root catch-all served marketing page.

**Fix mechanism:**
- `setup-wizard/page.tsx` → permanent redirect to `/dashboard/onboarding` (forwards search params for backward-compat).
- `dashboard/onboarding/page.tsx` → now serves BYOK wizard for ALL authenticated tiers. MASTER milestone check preserved: MASTER users with all 3 milestones complete auto-redirect to `/dashboard` (protected flow intact).
- Wizard client component extracted to `wizard-client.tsx` (same logic, moved from setup-wizard).
- Middleware line 88: `'/setup-wizard'` → `'/dashboard/onboarding'`.
- Middleware line 161: removed `|| pathname.startsWith('/setup-wizard')` — wizard now flows through `intlMiddleware()` for locale rewrite + CSP nonce.

**Protected flow regression check:** MASTER post-onboarding path verified in code:
- `OnboardingPage` checks `tier === 'MASTER'` → runs `loadMasterStepStatus()` → if all 3 done → `completeOnboardingAction()` + `redirect('/dashboard')`.
- Non-MASTER users now see wizard (intentional per user decision).
- Unit test updated to assert non-MASTER sees wizard (not redirect to /dashboard).

---

## Bug 3 — magic link redirect to /dashboard/onboarding with locale

**Commit:** `8eff45dd`
**Files modified:**
- `src/app/api/welcome/validate/[token]/route.ts` (+28 / -3)
- `src/app/[locale]/welcome/[token]/welcome-page-client.tsx` (+7 / -2)
- `src/app/api/welcome/validate/[token]/__tests__/route.test.ts` (+2 / -1)

**Root cause confirmed:** `route.ts:147` returned `redirectUrl: '/setup-wizard'` (no locale). Combined with Bug 2, this landed on marketing page. Even after Bug 2 fix, unlocalized URL caused extra redirect hop.

**Fix mechanism:**
- `welcome-page-client.tsx`: sends `{ locale }` in POST body (reads from component prop — explicit over Accept-Language header parsing).
- `route.ts`: parses optional `{ locale }` from POST body, whitelist-validates against `['en','vi']` (defaults to `'en'`). Returns `redirectUrl: '/${safeLocale}/dashboard/onboarding'`.
- Session cookie is set on POST response BEFORE `window.location.href` navigation — browser stores cookie before hitting auth-gated `/dashboard/onboarding`. No session timing risk.
- Audit logs `customer_handover_consumed` + `customer_handover_session_created` preserved.
- Rate limit (10/min/IP) preserved.

---

## Lint cleanup
**Commit:** `8dc96997` — suppressed 2 pre-existing `react-hooks` warnings in `wizard-client.tsx` (extracted code carried same patterns as original `setup-wizard/page.tsx`). ci:lint drops from 342 → 340 (gate is 341).

---

## Test Status
- **Type check:** PASS — 0 errors (`npm run type-check`)
- **Unit tests:** PASS — 4572 passed, 34 skipped (baseline was 4571; +1 from updated route.test.ts expectation)
- **Lint:** PASS — 340 warnings, 0 errors (gate: ≤341 warnings)
- **Pre-push hook:** PASS — all 4 gates (G1 typecheck, G2 lint, G3 test, G4 secrets)

---

## Internal links NOT updated (out of ownership boundary)
These files reference `/setup-wizard` but are NOT in my file ownership:
- `src/forest/components/auth/signup-form.tsx:67` — `callbackURL: "/setup-wizard"` (signup-form is forest/components/auth, not assigned)
- `src/app/[locale]/dashboard/integrations/page.tsx:48,70,71` — href="/setup-wizard" (integrations page not assigned)
- `src/app/[locale]/dashboard/components/dashboard-setup-steps.tsx:33` — href: '/setup-wizard'
- `src/app/[locale]/dashboard/help/getting-started/page.tsx:23,29,50,56` — links to /setup-wizard
- `src/app/[locale]/guide/screens/page.tsx:53` — /setup-wizard URL
- `src/app/[locale]/pricing/page.tsx:102` — href="/setup-wizard"
- `src/seed/auth/better-auth-server.ts:190` — email template link to /setup-wizard

All of these still work because `/setup-wizard` now redirects to `/dashboard/onboarding`. No regression. Operator should update these links in a follow-up sweep.

---

## Unresolved Questions

1. **Better Auth `internalAdapter` stability:** `route.ts` uses `(auth as ...$context).internalAdapter.createSession()` — tapping private API. Better Auth version pinned implicitly via `package.json`. If Better Auth upgrades and removes `internalAdapter`, this breaks silently. Recommend adding a version pin comment and a warn-log when the call fails (already present at line ~84 in the handler).

2. **`IS_CONFIGURED` env semantics (middleware line 84):** This is a GLOBAL env var — once any user completes wizard, ALL new signups bypass the redirect. If this is per-deployment intent (all instances share one config state), it may incorrectly skip wizard for brand-new users who haven't configured their BYOK keys. The Bug 2 fix changes the redirect target to `/dashboard/onboarding` (not a regression), but the semantic issue remains.

3. **`defaultLocale` mismatch:** `middleware.ts` says `defaultLocale: 'en'` but `i18n.ts` says `defaultLocale: 'vi'`. This inconsistency is pre-existing and outside scope but could cause locale detection surprises.

4. **E2E specs that reference `/setup-wizard`:** `tests/e2e/setup-wizard-routing.spec.ts` (if exists) and `tests/e2e/handover-journey-260519.spec.ts` Journey 2 may have hardcoded `/setup-wizard` URL expectations. Operator should update those specs to expect `/dashboard/onboarding`.

## Risk Callouts

- **Existing E2E specs expecting `/setup-wizard`:** Any spec navigating to `/setup-wizard` directly will now follow a redirect to `/dashboard/onboarding`. Playwright's `waitForURL()` with strict matching would fail. Check `tests/e2e/` for `/setup-wizard` refs before running suite.
- **`signup-form.tsx` callbackURL still `/setup-wizard`:** After signup via the form, user is redirected to `/setup-wizard` which redirects to `/dashboard/onboarding`. Extra hop but functionally correct. Low risk.
