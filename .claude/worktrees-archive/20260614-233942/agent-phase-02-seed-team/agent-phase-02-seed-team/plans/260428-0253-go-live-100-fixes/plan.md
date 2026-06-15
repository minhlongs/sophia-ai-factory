# Plan — Go-Live 100/100 Fixes

**Date:** 2026-04-28 02:53
**Source audit:** `plans/reports/audit-260428-0253-go-live-100.md` (composite **67/100**)
**Goal:** Lift Sophia AI Factory from 67/100 → 100/100

## Phase Map

| Phase | Title | Status | Score Lift |
|-------|-------|--------|-----------|
| 01 | Tier-1 Quick Wins | ✅ Completed (2026-04-28) | +13 → ~80/100 |
| 02 | Tier-2 Backlog (multi-sprint) | 🟡 Partial — TIER-2B done (2026-04-28), others deferred | +3 (TIER-2B) → ~83/100 |

## Phase 01 Result (2026-04-28)

- Files changed: 21 (+526/-167)
- Tests: 1584 pass / 31 skipped / 0 failed
- Build: exit 0
- Code review: 28/30 (9.33/10), 0 BLOCKING, APPROVE
- 2 minor inline fixes applied post-review (locale-aware not-found link, console.error in coupons catch)
- Implementer reports: `tier1-backend-260428-0253.md`, `tier1-frontend-260428-0253.md`
- QA reports: `tester-tier1-260428-0253.md`, `code-review-tier1-260428-0253.md`

## Phase 01 — Tier-1 Quick Wins (this session)

**Estimate:** 1 session, parallel 2 agents.

**Scope:**
- B1 — CI gate (remove `continue-on-error: true`, SHA-pin actions)
- B4 — i18n migration of `dashboard/videos/**` (35+ keys, 9 files) + `dashboard/error.tsx`
- B3 partial — auth-gate 4 public endpoints (`coupons/apply`, `errors/report`, `setup/save`, `realtime/alerts`)
- L9 — CDN immutable cache for `/_next/static/*`
- L10 — D1 backup off-site copy to R2
- L6 — drop `https://*.supabase.co` from CSP
- UX — route boundaries (videos error/loading/[id]/not-found)
- UX — asset-picker `aria-pressed` + focus
- UX — touch targets `min-h-[44px]`
- UX — `<img>` → `next/image`
- UX — fix 4 hardcoded `/login` redirects to use locale prefix

**Owner files:** see `phase-01-tier1-quick-wins.md`.

## Phase 02 — Tier-2 Backlog (deferred, multi-sprint) — TIER-2B Completed 2026-04-28

**Estimate:** 6-8 weeks (3-4 sprints) for remaining items.

**Completed (2026-04-28):**
- ✅ **TIER-2B** — Admin auth unification: 33 routes → single `requireAdmin()` helper
  - Related: `plans/260428-2107-tier2b-admin-auth-unify/` | Reports: `tier2b-implement-260428-2107.md`, `tester-tier2b-260428-2107.md`, `code-review-tier2b-260428-2107.md`

**Remaining Scope (deferred):**
- B2 — fix 462 TS errors masked by `ignoreBuildErrors: true` (biggest single ticket; 2 sprints)
- MFA — Better Auth two-factor plugin spike + admin enforcement
- Observability — Sentry SDK + source maps + APM dashboards
- CSP — nonce-based migration, drop `'unsafe-inline'`
- Cron — migrate `/api/cron/*` HTTP routes → `wrangler.toml [triggers] scheduled()`
- CSRF — token enforcement on non-Better-Auth mutating endpoints
- Data quality — FK cascade on 32 refs, money cols → INTEGER cents, timestamp standardization
- DR runbook — D1 Time Travel restore, RPO/RTO docs, quarterly drill automation
- DNS — CAA + SPF + DMARC `p=quarantine` (user-action: CF dashboard)
- GH Actions block — escalate billing issue (user-action: github.com settings)

**Sub-phases:** see `phase-02-tier2-backlog.md`.

## Key Dependencies

- `next-intl` v4.8.2 already wired (28 dashboard files use it)
- Better Auth v1.6.2 — has `twoFactor` plugin available for MFA
- Cloudflare R2 bucket `sophia-backups` must be created via `wrangler r2 bucket create` (one-time)
- GH Actions block at user level (`longtho638-jpg`) needs escalation
- Sentry account + DSN provisioning required before Phase 02 observability

## Success Criteria

- Composite score ≥95/100
- 100% test pass on `npm test`
- `npm run build` exit 0 with `ignoreBuildErrors: false`
- Production HTTP 200, all security headers green
- Vietnamese users see Vietnamese throughout video flow
- Zero unauthenticated state-changing endpoints
- Sentry capturing exceptions with readable stack traces
