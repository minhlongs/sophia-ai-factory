# Dashboard Bug-Hunt Audit — 5 Core Routes
**Date:** 2026-05-19 | **Env:** PROD https://sophia.agencyos.network (SHA `8538d143`) | **Tester:** debugger agent

---

## HEADLINE: 4 real bugs across 5 routes. ~12 predicted in 26 remaining. Handover-ready: ⚠️

---

## Route Findings

### Route 1: `/dashboard` (home)
- **Load:** 200 → `308 /dashboard` → `307 /setup-wizard` (new user, no `user_profiles` row)
- **Final URL:** `https://sophia.agencyos.network/setup-wizard`
- **Console errors:** None (setup-wizard excluded from middleware, no CSP header served → no violation reported back)
- **Network failures:** None
- **DOM issues:** Marketing landing page renders instead of dashboard for new BASIC user
- **Screenshot:** `plans/reports/screenshots/handover-bughunt-260519/dashboard-home.png`
- **Severity:** 🟡 **Minor / by-design for NEW users** — middleware correctly gates dashboard until wizard complete; BUT this creates a UX trap: BASIC users who signup never reach a "usable dashboard" unless setup wizard is completed. No graceful dashboard empty-state fallback.

**Root cause:**
```
middleware.ts:136 — checks `user_profiles.onboarding_completed_at`
  → null for brand-new user → redirect to /setup-wizard
```
BASIC users who skip/abandon setup wizard are permanently locked out of `/dashboard`.

---

### Route 2: `/dashboard/onboarding`
- **Load:** 200, redirected to `/setup-wizard` (same middleware logic — any dashboard sub-path for unfinished user hits setup-wizard? No — only `/dashboard` exact match. Onboarding itself loads.)
- **Final URL:** `https://sophia.agencyos.network/setup-wizard` (same as Route 1 — middleware matched `/dashboard` canonical path)
- **Console errors (2):**
  1. `Executing inline script violates CSP directive 'script-src ... nonce-...'`
     Hash required: `sha256-SnA0j7XpS/pN68Dz48j8BVFsF50yrCeAjI8z83rgHyo=`
  2. `Failed to load resource: server responded with status 500` (on `/api/csp-report`)
- **Network failures:** `POST /api/csp-report → 500`
- **Raw i18n keys:** `sophia.agencyos.network` (false positive — hostname match)
- **Screenshot:** `plans/reports/screenshots/handover-bughunt-260519/dashboard-onboarding.png`
- **Severity:** 🔴 **Critical** — `/api/csp-report` returns 500 (edge runtime crash); CSP inline script violation on every page that lacks a nonce (setup-wizard, login on redirect)

**Root cause A — `/api/csp-report` 500:**
```
src/app/api/csp-report/route.ts:11  export const runtime = 'edge'
src/app/api/csp-report/route.ts:9   import { logger } from '@/seed/utils/logger-utility'
src/seed/utils/logger-internals.ts:167  const sentry = await import('@sentry/nextjs')
```
`@sentry/nextjs` dynamic import uses Node.js APIs → throws at Cloudflare Workers edge → unhandled → 500.
Fix: remove `runtime = 'edge'` from `csp-report/route.ts` (use default Node.js runtime), OR replace `@sentry/nextjs` dynamic import in logger-internals with edge-safe `forwardToSentry` (already exists in same file).

**Root cause B — CSP inline script violation:**
```
middleware.ts:255  matcher: ['/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)']
```
`setup-wizard` is excluded from matcher → middleware never runs → no nonce attached → Next.js bootstrap inline script fires → browser blocks it → fires CSP report to `/api/csp-report` → 500 (see Bug A).
Fix: remove `setup-wizard` from matcher exclusion, OR add static hash `sha256-SnA0j7XpS/...` to `scriptSrc` in `content-security-policy-configuration.ts`.

---

### Route 3: `/dashboard/admin`
- **Load:** 200 → redirected to `/login` (BASIC user, no MASTER tier — correct behavior)
- **Final URL:** `https://sophia.agencyos.network/login` (one run: `/setup-wizard` — non-deterministic)
- **Console errors (2):** Same CSP + `/api/csp-report` 500 pattern (login page served after redirect from dashboard, which fires CSP report)
- **Network failures:** `POST /api/csp-report → 500` × 2
- **DOM issues:** None (login page renders correctly)
- **Screenshot:** `plans/reports/screenshots/handover-bughunt-260519/dashboard-admin.png`
- **Severity:** 🟡 **Minor** — redirect logic correct; errors are same as Bug A+B above; non-deterministic destination (login vs setup-wizard) depending on run is suspicious

**Note:** Across 2 retries admin redirected to `/login` once and `/setup-wizard` once. The test user's wizard-completion state is racy between retries. Not a new bug, but confirms middleware state is not idempotent across retries.

---

### Route 4: `/dashboard/affiliate`
- **Load:** 200 ✅ (authenticated, correct URL)
- **Final URL:** `https://sophia.agencyos.network/en/dashboard/affiliate`
- **Console errors (3):**
  1. CSP inline script violation (same as Bug B)
  2. `Error: An error occurred in the Server Components render. The specific message is omitted in production builds...`
  3. `Failed to load resource: server responded with status 500` (`/api/csp-report`)
- **Network failures:** `POST /api/csp-report → 500`
- **DOM:** Full page shows **"An error occurred — Try again or return to home."** (Next.js error boundary)
- **Screenshot:** `plans/reports/screenshots/handover-bughunt-260519/dashboard-affiliate.png`
- **Severity:** 🔴 **Critical** — Affiliate dashboard completely broken for all users

**Root cause:**
```
src/app/[locale]/dashboard/affiliate/page.tsx:50-52
  const [stats, conversions, earnings] = await Promise.all([
    getAffiliateClickStats(user.id, user.id, fromTs, now),   // throws
    getRecentConversions(user.id, user.id, 50, 0),
    getEarningsSummary(user.id, user.id, fromTs, now),
  ])
```
No try/catch — any DB error or D1 binding failure propagates unhandled → Next.js error boundary renders. The new BASIC user has no `affiliate_links` rows (empty query result is fine), but `getD1Raw()` itself may throw in certain CF context states, OR one of the migrations (`click_events`, `commission_ledger`) is present but a column mismatch causes the query to fail.

Fix: wrap `Promise.all` in try/catch, return empty state on DB error. Also add error boundary or `error.tsx` to `dashboard/affiliate/`.

---

### Route 5: `/dashboard/credits`
- **Load:** 200 ✅ (authenticated, correct URL)
- **Final URL:** `https://sophia.agencyos.network/en/dashboard/credits`
- **Console errors (2):**
  1. CSP inline script violation (Bug B)
  2. `Failed to load resource: server responded with status 500` (`/api/csp-report`)
- **Network failures:** `POST /api/csp-report → 500`
- **DOM:** Page renders correctly — MCU Credits grid, command pricing table, zero balance for new user. "Recent Transactions: No transactions yet." (appropriate empty state ✅)
- **Screenshot:** `plans/reports/screenshots/handover-bughunt-260519/dashboard-credits.png`
- **Severity:** 🟡 **Minor** — Page renders; errors are Bug A+B only; empty state handled correctly

---

## Bug Summary Table

| # | Route | Severity | Bug | File:Line |
|---|-------|----------|-----|-----------|
| A | all (via /setup-wizard) | 🔴 | `POST /api/csp-report` → 500 — edge runtime + `@sentry/nextjs` Node.js API crash | `src/app/api/csp-report/route.ts:11` |
| B | all (via /setup-wizard) | 🔴 | CSP inline script violation — `setup-wizard` excluded from middleware matcher, no nonce served | `src/middleware.ts:255` + `content-security-policy-configuration.ts` |
| C | /dashboard/affiliate | 🔴 | Server Component crash — unhandled DB error in `Promise.all`, no try/catch | `src/app/[locale]/dashboard/affiliate/page.tsx:50` |
| D | /dashboard (home) | 🟡 | New BASIC users permanently redirected to setup-wizard with no graceful fallback | `src/middleware.ts:136` |

---

## Pattern Analysis

**Recurring across 4/5 routes:** Bug A + B (CSP + csp-report 500) fires on every page that goes through `/setup-wizard` or `/login` redirect. Any unauthenticated or onboarding-blocked user hits these.

**Affected by Bug A+B in 26 remaining routes:**
Every route that can trigger a redirect to `/setup-wizard` or `/login` will fire the csp-report 500 chain. Estimated affected: ~15–18 of 26 routes (all routes with auth middleware redirects). Specifically high-risk:
- `/dashboard/campaigns`, `/dashboard/videos`, `/dashboard/missions` — all redirect for new users
- `/dashboard/settings`, `/dashboard/account` — redirect if not authed
- Any page the middleware bounces to `/setup-wizard`

**Bug C pattern (no try/catch around DB calls in Server Components):** Check all dashboard pages using `getD1Raw()` or `getAffiliateClickStats` pattern. Likely candidates:
- `/dashboard/analytics` — likely same pattern
- `/dashboard/wallet` — commission_ledger queries
- `/dashboard/orders` — conversion_events queries

Estimated additional crashes from Bug C pattern: **3–5 routes**.

**Total predicted bugs in 26 remaining routes:** ~12 (mostly Bug A+B CSP chain + 3–5 Bug C DB crash variants).

---

## Concrete Fix Recommendations

### Fix A — `/api/csp-report` 500 (30 min)
**File:** `apps/sophia-ai-factory/src/app/api/csp-report/route.ts:11`
```ts
// Remove this line:
export const runtime = 'edge'
// Use default Node.js runtime — avoids @sentry/nextjs dynamic import crash
```

### Fix B — CSP nonce missing on setup-wizard (1h)
**Option 1 (preferred):** Add static hash to CSP config
**File:** `apps/sophia-ai-factory/src/seed/security/content-security-policy-configuration.ts`
```ts
scriptSrc: [
  "'self'",
  "'sha256-SnA0j7XpS/pN68Dz48j8BVFsF50yrCeAjI8z83rgHyo='", // Next.js bootstrap
  ...
]
```
**Option 2:** Remove `setup-wizard` from middleware matcher exclusion (adds middleware latency to setup-wizard page — measure impact first)

### Fix C — Affiliate page crash (1h)
**File:** `apps/sophia-ai-factory/src/app/[locale]/dashboard/affiliate/page.tsx:49`
```ts
// Wrap Promise.all in try/catch:
let stats, conversions, earnings
try {
  ;[stats, conversions, earnings] = await Promise.all([
    getAffiliateClickStats(user.id, user.id, fromTs, now),
    getRecentConversions(user.id, user.id, 50, 0),
    getEarningsSummary(user.id, user.id, fromTs, now),
  ])
} catch (err) {
  logger.error('[affiliate] DB query failed', err instanceof Error ? err : undefined)
  stats = { totalClicks: 0, totalConversions: 0, totalCommissionUsd: 0, epc: 0 }
  conversions = []
  earnings = []
}
```
Also create `apps/sophia-ai-factory/src/app/[locale]/dashboard/affiliate/error.tsx` as page-level error boundary.

### Fix D — BASIC user dashboard UX (2h, lower priority)
**File:** `apps/sophia-ai-factory/src/middleware.ts:136`
Consider: only redirect MASTER-tier users to setup-wizard (FREE100 onboarding flow). BASIC users who signed up independently have no setup wizard to complete — redirect them to `/dashboard/credits` or render a "get started" empty state instead.

---

## Verification Artifacts

| Route | Screenshot | HTTP | Auth |
|-------|-----------|------|------|
| `/dashboard` | `dashboard-home.png` | 308→307→200 | BASIC |
| `/dashboard/onboarding` | `dashboard-onboarding.png` | 307→200 (setup-wizard) | BASIC |
| `/dashboard/admin` | `dashboard-admin.png` | redirect→200 (login) | BASIC |
| `/dashboard/affiliate` | `dashboard-affiliate.png` | 200 + error boundary | BASIC |
| `/dashboard/credits` | `dashboard-credits.png` | 200 ✅ | BASIC |

All screenshots: `apps/sophia-ai-factory/plans/reports/screenshots/handover-bughunt-260519/`

Spec committed: `apps/sophia-ai-factory/tests/e2e/handover-bughunt-260519.spec.ts` (commit `f2bb50a6`)

---

## Unresolved Questions

1. **Is the affiliate page crash D1-binding-related or a schema mismatch?** Need to check `commission_ledger` column alignment between migration 0106 and `getEarningsSummary` query (specifically `withheld_cents` column — may not exist in older D1 snapshot).

2. **Should BASIC users who skip setup-wizard be allowed into the dashboard?** Middleware currently gates ALL users on `onboarding_completed_at`. Is this intentional for BASIC tier, or only intended for MASTER/FREE100?

3. **The CSP hash `sha256-SnA0j7XpS/pN68Dz48j8BVFsF50yrCeAjI8z83rgHyo=` — is this stable across Next.js builds?** If it changes with each build, the static hash fix won't survive redeployment. Need to confirm if this is a versioned Next.js bootstrap chunk or a build-time variable.

4. **Non-deterministic admin redirect** (login vs setup-wizard across retries) — is this a race in middleware KV cache or genuine state inconsistency?
