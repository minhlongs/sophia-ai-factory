# Sophia AI Factory — Go-Live Gap Analysis (100/100 Readiness)

**Report Date:** 2026-04-30  
**Reviewer:** Research Agent  
**Production URL:** `https://sophia.agencyos.network`  
**Commit Range:** dfff8ea (CERTIFICATION.md) → current HEAD  

---

## Executive Summary

Sophia AI Factory has undergone massive transformation (modularization, TS cleanup, security hardening) since the `CERTIFICATION.md` was stamped "APPROVED FOR RELEASE" on **2026-02-05**. The codebase is technically strong: **0 TypeScript errors, 1798 tests pass, build exits 0, lint passes**. However, multiple **documentation, operational, and deployment gaps** prevent a true 100/100 go-live.

**Net score: ~88/100** (target 100). Key blockers: 2 deployment actions required, 1 mission-critical doc is dangerously wrong, and 2 planned phases remain unimplemented.

---

## Gap Inventory

### 🔴 BLOCKERS (Must fix before go-live)

#### 1. Sprint M — Production Deploy Blocked
- **Severity:** BLOCKER
- **Description:** All Sprint M code is shipped but deploy is blocked. GitHub Actions disabled for user account. 4 D1 migrations (`0018`–`0023`) need remote apply. 9 CF Secrets need setting (`CLOUDLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`, plus M1-M5 secrets).
- **File/Location:** `plans/260427-0306-sprint-m-revenue-path/plan.md` (status: "in-progress (code complete, deploy blocked)")
- **Action:** User must re-enable GitHub Actions, apply D1 migrations remotely (`wrangler d1 migrations apply sophia-raas-db`), set CF secrets via `wrangler secret put`.

#### 2. GO-LIVE-DEPLOYMENT-GUIDE.md — Dangerously Wrong Platform
- **Severity:** BLOCKER
- **Description:** The go-live deployment guide (`docs/GO-LIVE-DEPLOYMENT-GUIDE.md`) is entirely wrong — it describes Vercel deployment (`vercel login`, `vercel env add`, `vercel --prod`). The actual platform is **Cloudflare Workers** via `wrangler deploy`. Anyone following this doc will waste hours and potentially expose secrets to the wrong platform.
- **File/Location:** `docs/GO-LIVE-DEPLOYMENT-GUIDE.md` (entire document, 300 lines)
- **Action:** Rewrite to reflect Cloudflare Workers deployment. Reference `wrangler.toml`, `.github/workflows/test.yml`, and `scripts/ci/wrangler-set-build-vars.sh`.

#### 3. Go-Live 100 Fixes Plan — Phase 03 & 04 Pending
- **Severity:** BLOCKER
- **Description:** The go-live plan (`plans/260428-0253-go-live-100-fixes/plan.md`) lists Phase 03 (TIER-3: performance + CDN + DR verification) and Phase 04 (Verification + deploy + handoff) as `pending` with **no files created**. Phase 02 (all TIER-2 sub-phases) is complete. Without Phase 03/04, the 92/100 score target is unreachable.
- **File/Location:** `plans/260428-0253-go-live-100-fixes/plan.md` lines 36-37, 64-66
- **Sub-items for Phase 03:**
  - CDN caching rules optimization
  - Database query performance analysis
  - RTO/RPO definition formalization
  - Load testing against production
- **Sub-items for Phase 04:**
  - SHA verification protocol execution
  - Protected flow regression test (Setup Wizard, Telegram Bot, NOWPayments IPN)
  - Final certification report generation
  - Client handoff documentation

---

### 🟡 CONSIDERATIONS (Important but not immediately blocking)

#### 4. FULL_MIGRATION.sql — Outdated Supabase Schema
- **Severity:** CONSIDERATION
- **Description:** `FULL_MIGRATION.sql` is a Supabase-specific schema from **2026-02-05** (573 lines). The actual production database is **Cloudflare D1** with **37 up-to-date migration files** in `migrations/`. The SQL file references `auth.users`, RLS policies, and Supabase-specific functions (`gen_random_uuid()`, `auth.uid()`) that don't apply to D1.
- **File/Location:** `FULL_MIGRATION.sql` (573 lines) vs `migrations/0001-init.sql` through `0034-video-onboarding-events.sql` (37 files)
- **Action:** Either regenerate FULL_MIGRATION.sql from D1 migrations, or add a deprecation header explaining it's historical.

#### 5. CERTIFICATION.md — 85 Days Stale
- **Severity:** CONSIDERATION
- **Description:** Certification stamped "APPROVED FOR RELEASE" on **2026-02-05** (`dfff8ea`). Since then: modularization (Phases 40-49, 4,556 lines refactored), TS cleanup (462→0 errors), Sentry observability (TIER-2D), MFA (TIER-2C), CSP nonce (TIER-2E), CSRF (TIER-2G), data quality audit (TIER-2H), DR runbook (TIER-2I), infra hardening (TIER-2J). Test count grew from ~154 to **1,798**. Coverage numbers in report are stale (26% → likely much higher now).
- **File/Location:** `CERTIFICATION.md` (33 lines, 2026-02-05)
- **Action:** Regenerate with `npm run setup:production -- --certify` or via `scripts/generate-certification.js`. Update test count, coverage, and security posture.

#### 6. verify-env.js — References POLAR (Banned Provider)
- **Severity:** CONSIDERATION
- **Description:** `verify-env.js` lists `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` as **required** env vars, plus `POLAR_PRODUCT_BASIC_ID`, `POLAR_PRODUCT_PREMIUM_ID`, `POLAR_PRODUCT_ENTERPRISE_ID` as optional. Per `CLAUDE.md`, Polar.sh is **BANNED**: "BANNED: Polar.sh (rejected this product), PayPal". The actual payment provider is **NOWPayments** (USDT crypto). The `.env.production.example` correctly has NOWPAYMENTS vars but also has legacy POLAR vars.
- **File/Location:** `verify-env.js` lines 9-10, 19-21; `.env.production.example` lines 24-25
- **Action:** Remove POLAR from verify-env.js required list. Add NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, NOWPAYMENTS_WALLET as required. Remove Polar from `.env.production.example` or mark as "legacy — unused."

#### 7. .env.production.example — Missing PAYOS Backup Vars
- **Severity:** CONSIDERATION
- **Description:** `GO-LIVE-DEPLOYMENT-GUIDE.md` references `PAYOS_MERCHANT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` for Vietnam domestic backup. These are absent from `.env.production.example` but the webhook setup docs expect them. Per CLAUDE.md: "Backup: PayOS (Vietnam domestic)".
- **File/Location:** `.env.production.example` (missing PAYOS vars)
- **Action:** Add PAYOS_MERCHANT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY as optional vars.

#### 8. API Version Endpoint — Dependency for SHA Verification
- **Severity:** CONSIDERATION
- **Description:** The deploy verification protocol (`sophia-deploy-verify.md`) relies on `GET /api/version` returning `{shortSha, deployedAt, opennextVersion}`. This needs to be confirmed working post-deploy. The commit SHA is injected via CF Secrets by `scripts/ci/wrangler-set-build-vars.sh` in CI.
- **File/Location:** `.claude/rules/sophia-deploy-verify.md`, `scripts/ci/wrangler-set-build-vars.sh`
- **Action:** After first successful CI deploy, verify `curl -s https://sophia.agencyos.network/api/version` returns valid JSON with matching SHA.

#### 9. R2/KV Sentinel Health Probes — Need One-Time Seed
- **Severity:** CONSIDERATION
- **Description:** TIER-2D Sentry observability added health probes that ping D1, R2, and KV. The R2 and KV probes require one-time sentinel objects to exist, otherwise health checks report false negatives.
- **File/Location:** `plans/260428-2141-tier2d-sentry-observability/plan.md` user action items
- **Action:** Pre-seed R2 sentinel: `echo "ok" | npx wrangler r2 object put sophia-ai-factory-opennext-cache/health-check.txt --pipe`  
  Pre-seed KV sentinel: `npx wrangler kv:key put --binding=EXPERIMENT_KV health:ping ok`

#### 10. Sentry Secrets — 4 CF Secrets Required
- **Severity:** CONSIDERATION
- **Description:** TIER-2D implemented Sentry SDK (error monitoring, source map upload in CI, health probes). Requires 4 CF Secrets: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Without these, Sentry is dormant and CI source map upload step fails (currently `continue-on-error: true`).
- **File/Location:** `plans/260428-2141-tier2d-sentry-observability/plan.md`
- **Action:** User must provision Sentry account + project, set 4 CF Secrets via `wrangler secret put`.

#### 11. No `/signup` Route — 404 Expected
- **Severity:** CONSIDERATION
- **Description:** The app has **no dedicated `/signup` page route**. Signup is a **tab within the `/login` page** (`src/app/[locale]/login/page.tsx`) showing `<SignupForm>` component. The API route `/api/auth/signup` returns HTTP 410 (deprecated — Better Auth handles sign-up). If users navigate to `/signup` directly, they get a 404. No redirect exists in middleware or next.config.ts.
- **File/Location:** `src/app/[locale]/login/page.tsx`, `src/app/api/auth/signup/route.ts`, `src/middleware.ts` (no /signup redirect)
- **Action:** Either: (a) add `next.config.ts` redirect `{ source: '/signup', destination: '/login', permanent: true }` or (b) create a `/signup` page that redirects to `/login?tab=signup`. Current behavior (404) is poor UX.

#### 12. Legacy Supabase Migrations — 30 Files in `supabase/migrations/`
- **Severity:** CONSIDERATION
- **Description:** The `supabase/migrations/` directory contains 30 migration files for the deprecated Supabase backend. The active database is D1 with 37 files in `migrations/`. Having both creates confusion about which is authoritative.
- **File/Location:** `supabase/migrations/` (30 files) vs `migrations/` (37 files)
- **Action:** Add README in `supabase/` explaining deprecation. Consider archiving to `docs/legacy/`.

#### 13. deployment-checklist.md — References Old Migrations + Vercel
- **Severity:** CONSIDERATION
- **Description:** References old migration filenames (`001_create_sophia_index.sql`, `002_api_security.sql`, `003_user_integrations.sql`) that don't match current D1 migrations. Also says "Deploy: Push to `main` branch" and "Check Vercel deployment logs" — wrong platform.
- **File/Location:** `docs/deployment-checklist.md` (37 lines)
- **Action:** Update to reference current D1 migrations and Cloudflare Workers deploy flow.

---

### 🟢 NICE-TO-HAVE (Post-launch improvements)

#### 14. Plans Directory — 62 Entries, ~20 Legacy/No-Status
- **Severity:** NICE-TO-HAVE
- **Description:** The `plans/` directory has 62 entries. ~20 plans have no status field (legacy/abandoned). Plans for completed modularization phases (25–49) are all present. Cleanup would reduce noise.
- **File/Location:** `plans/` (62 entries)
- **Action:** Archive completed modularization plans to `plans/archive/`. Keep only active/pending plans.

#### 15. Files > 300 Lines — Test Files Only
- **Severity:** NICE-TO-HAVE
- **Description:** All production source files are ≤300 lines (per modularization campaign). 20 test files exceed 300 lines, which is acceptable but the largest (`src/lib/llm/cache/llm-cache.test.ts` at 522 lines, `src/app/api/cron/workflow-stepper/route.test.ts` at 532 lines) could be split for maintainability.
- **File/Location:** 20 test files > 300 lines
- **Action:** Optional — split largest test files in next sprint.

#### 16. README.md — Mentions D-ID (Discontinued)
- **Severity:** NICE-TO-HAVE
- **Description:** `README.md` says "Video Generation: Integrates ElevenLabs (Voice) and D-ID (Avatar)." HeyGen is the actual video generation provider (D-ID was discontinued). The architecture CLAUDE.md correctly references HeyGen.
- **File/Location:** `README.md` line 12
- **Action:** Update to "HeyGen (AI Video)" instead of "D-ID (Avatar)".

#### 17. No `.dev.vars` — Missing Local Dev Template
- **Severity:** NICE-TO-HAVE
- **Description:** No `.dev.vars` file for Wrangler local development. The `.env.production.example` exists but developers need wrangler-specific secrets format for `npx wrangler dev`.
- **File/Location:** None created
- **Action:** Create `.dev.vars.example` with D1 database_id and R2 bucket bindings for local dev.

#### 18. Coverage Gaps — Below 50% Unlikely to Change Without Effort
- **Severity:** NICE-TO-HAVE
- **Description:** CERTIFICATION.md reported 26% line coverage on 2026-02-05. With 1,798 tests now (up from ~154), coverage has certainly improved. But no updated coverage report exists. Not a launch blocker but useful for auditability.
- **File/Location:** `CERTIFICATION.md` (stale coverage data)
- **Action:** Run `npm test -- --coverage` and regenerate certification.

#### 19. VIDEO_BUCKET R2 — Public URL Configuration
- **Severity:** NICE-TO-HAVE
- **Description:** The `wrangler.toml` provisions `VIDEO_BUCKET` (R2 bucket `sophia-videos`). The `[vars]` section notes `R2_PUBLIC_BASE_URL` must be configured for public video access. Without it, videos fall back to HeyGen CDN URL (volatile). Not set in `.env.production.example`.
- **File/Location:** `wrangler.toml` lines 16-21, `.env.production.example` (missing `R2_PUBLIC_BASE_URL`)
- **Action:** Configure custom domain or R2.dev public access for `sophia-videos` bucket. Set `R2_PUBLIC_BASE_URL` in CF vars/secrets.

---

## Quality Gate Summary (Current)

| Gate | Status | Notes |
|------|--------|-------|
| **Lint** | ✅ PASS | `npx next lint` — 0 errors |
| **TypeScript** | ✅ PASS | `tsc --noEmit` — 0 errors |
| **Unit Tests** | ✅ PASS | 1,798 passed, 31 skipped, 0 failed |
| **Build** | ✅ PASS | `npm run build` — exit 0 |
| **Security Audit** | ✅ PASS | `npm audit --audit-level=high` |
| **i18n Validation** | ✅ PASS | `npm run i18n:validate` |
| **CI/CD (Tests & Deploy)** | ⚠️ BLOCKED | GitHub Actions disabled for user account |
| **Deploy SHA Match** | ❌ UNVERIFIED | Needs CI deploy to test |
| **Production HTTP** | ❌ UNVERIFIED | Needs CI deploy to test |
| **Protected Flows** | ❌ UNVERIFIED | Setup Wizard, Telegram Bot, NOWPayments IPN — needs live test |
| **Sentry Observability** | ⚠️ PENDING | Code shipped; 4 CF Secrets needed |
| **R2/KV Health Probes** | ⚠️ PENDING | Sentinel objects need one-time seed |
| **Video Go-Live** | ✅ CODE DONE | R2-backed storage, status sync cron, D1 persistence all wired |

---

## Immediate Next Steps (Ordered by Priority)

1. **Re-enable GitHub Actions** in repository settings → unblock CI/CD
2. **Apply D1 migrations remotely** (`0018`–`0034`) via `wrangler d1 migrations apply sophia-raas-db --remote`
3. **Set CF Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, Sentry × 4
4. **Verify first CI deploy** → run full SHA verification protocol from `sophia-deploy-verify.md`
5. **Rewrite** `docs/GO-LIVE-DEPLOYMENT-GUIDE.md` for Cloudflare Workers
6. **Fix** `verify-env.js` — remove Polar, add NOWPayments as required
7. **Seed** R2/KV health sentinels
8. **Add** `/signup → /login` redirect in `next.config.ts`
9. **Regenerate** `CERTIFICATION.md` with current metrics
10. **Complete** Phase 03 (TIER-3 performance/CDN/DR) and Phase 04 (verification/handoff)

---

## Unresolved Questions

1. Is `Sprint M` D1 migration (`0018`–`0023`) already applied to production, or does it need a manual apply?
2. Are NOWPayments IPN webhook and Telegram bot webhook configured on the production URL?
3. Does the `GET /api/version` endpoint work correctly — is `COMMIT_SHA` and `DEPLOYED_AT` being injected by CI?
4. Should `FULL_MIGRATION.sql` be regenerated from D1 schema, or archived as historical?
5. Is `supabase/migrations/` still needed for any active services (OAuth callbacks, admin invite, checkpoint persistence per CLAUDE.md)?
