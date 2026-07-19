# User Flow Bootstrap — Final Report

**Date:** 2026-03-26 | **Branch:** master | **Production:** sophia.agencyos.network

---

## Summary

3 parallel agents completed: docs creation, route verification, onboarding flow analysis.

### Deliverables
- `docs/user-flow.md` — Complete 8-phase user journey (REWRITTEN — old version had wrong stack)
- `docs/system-architecture.md` — Updated to CF Workers + D1 (was Vercel + Supabase)
- `plans/reports/route-verification-260326-1027-user-flow.md` — Route verification results

---

## Route Verification: 30/31 PASS

| Phase | Routes | Result |
|-------|--------|--------|
| Public pages | 10 | All 200 |
| Auth API | 3 | 405 GET (correct, POST-only) |
| Protected pages | 11 | All 307 → /login |
| API without auth | 4 | All 401 |
| Public API | 2 | 1 minor (/api/v1/ returns HTML) |
| Onboarding | 1 | 307 → /login |

**Health:** DB latency 6ms, system healthy.

---

## Critical Gaps Found

### HIGH Severity

1. **Two conflicting signup paths**
   - `/signup` → `SelfServeSignupForm` → `POST /api/v1/onboard`
   - `/onboarding` → `OrgSetupForm` → `POST /api/onboarding` (MISSING endpoint!)
   - **Fix:** Consolidate to single flow using `/api/v1/onboard`

2. **No org guard on dashboard**
   - `/(dashboard)/layout.tsx` checks `auth-token` cookie only
   - Does NOT verify user has organization
   - Authenticated user with no org → empty dashboard
   - **Fix:** Add org check in dashboard layout, redirect to /onboarding if missing

### MEDIUM Severity

3. **Missing /api/onboarding endpoint**
   - `OrgSetupForm` calls `POST /api/onboarding` (line 72)
   - Endpoint not found in codebase
   - **Fix:** Either implement or remove OrgSetupForm, use SelfServeSignupForm only

4. **Auth token vs API key confusion**
   - `auth-token` (JWT for UI), `sk_live_XXX` (RaaS API), `org_id` (localStorage)
   - No documentation on relationship
   - **Fix:** Document in user-flow.md (done)

5. **/api/v1/ returns HTML**
   - No handler for base /api/v1/ path
   - Returns Next.js page instead of JSON
   - **Fix:** Add route handler returning `{"version":"v1","status":"ok"}`

### LOW Severity

6. **Unused checklist components**
   - `checklist.tsx`, `pilot-checklist.tsx` exist but not rendered
   - Could improve onboarding UX

7. **No email verification on password signup**
   - Magic link auto-verifies, password signup does not
   - Low risk for now

---

## Docs Corrections Made

| File | Issue | Fix |
|------|-------|-----|
| `docs/user-flow.md` | Referenced Supabase Auth, Inngest, Vercel | Rewrote with CF Workers, D1, Polar.sh |
| `docs/user-flow.md` | Wrong routes (/guide/*, /auth/callback) | Fixed to actual routes (/docs/api, /api/auth/callback) |
| `docs/user-flow.md` | Wrong pricing ($199-$4999) | Fixed to actual ($49-$999) |
| `docs/user-flow.md` | Wrong MCU costs (425/campaign) | Fixed with actual per-feature costs |
| `docs/system-architecture.md` | Entire file described old app | Rewrote with production stack |

---

## Recommended Next Steps (Priority Order)

1. **Consolidate signup flow** — Remove OrgSetupForm, keep SelfServeSignupForm only
2. **Add org guard** — Dashboard layout checks org membership
3. **Add /api/v1/ handler** — Return JSON version info
4. **Activate onboarding checklist** — Use existing checklist components post-signup
5. **Add email verification** — For password-based signups

---

## Unresolved Questions

1. Should `/onboarding` page be removed entirely or repurposed for "add org later" flow?
2. Can one user manage multiple orgs? (DB supports it via org_members)
3. Should email verification be mandatory before dashboard access?
4. What happens to missions if MCU runs out mid-processing?
