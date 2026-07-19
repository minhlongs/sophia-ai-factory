# Phase 02 — Tier-2 Backlog (deferred, multi-sprint)

**Status:** ⬜ Planned — Tier-1 dependencies cleared 2026-04-28. Ready to schedule sprints.
**Estimate:** 6-8 weeks / 3-4 sprints
**Score Lift:** ~80/100 → ~100/100

## Overview

Tier-2 covers architectural changes too large for a single session:
- 462 TS errors (2 sprints alone)
- Admin auth unification + MFA spike
- Observability platform (Sentry + source maps + APM)
- CSP nonce migration
- Cron scheduler migration
- CSRF token enforcement
- Data quality (FK cascade + money cents + timestamps)
- DR runbook + drills
- DNS posture (user-action)
- GH Actions block resolution (user-action)

Each item below is a candidate for its own phase file when picked up.

---

## TIER-2A — TypeScript Cleanup (Sprint 1-2)

**Goal:** Flip `next.config.ts` `typescript.ignoreBuildErrors: true` → `false`.
**Scope:** 462 TS errors across `apps/sophia-ai-factory/src/`.
**Approach:**
1. Run `cd apps/sophia-ai-factory && npx tsc --noEmit 2>&1 | tee /tmp/ts-errors.log`
2. Group errors by file, by error code (TS2322, TS7053, etc.)
3. Fix in batches (~50 errors / PR), grouped by domain (admin, payments, video, dashboard)
4. Re-run between batches to confirm count drops
5. After zero errors, flip flag

**Acceptance:** `npm run build` exits 0 with `ignoreBuildErrors: false`.

---

## TIER-2B — Admin Auth Unification (Sprint 1) ✅ COMPLETED 2026-04-28

**Goal:** Single `requireAdmin(request)` helper backed by Better Auth + `users.role='admin'`.
**Replaces:**
- `checkAdminAuth()` Basic Auth via `ADMIN_USER/PASS`
- `x-admin-key` against `ADMIN_API_KEY`
- JWT Bearer with Basic fallback

**Completed:**
1. ✅ Better Auth role integration verified
2. ✅ Migrated 33 admin + payouts routes to `requireAdmin(request)`
3. ✅ Created centralized helper: `src/lib/auth/require-admin.ts`
4. ✅ Deleted duplicate middleware files
5. ✅ Tests: 1589 pass / 31 skipped / 0 failed
6. ✅ Code review: 8.7/10 → APPROVE after 3 feedback fixes

**Related Plan:** `plans/260428-2107-tier2b-admin-auth-unify/`
**Reports:** `tier2b-implement-260428-2107.md`, `tester-tier2b-260428-2107.md`, `code-review-tier2b-260428-2107.md`

**Acceptance:** ✅ Single import path; basic-auth headers no longer accepted; audit_logs cover all admin mutations.

---

## TIER-2C — MFA / Two-Factor (Sprint 2)

**Goal:** TOTP MFA enforced for admin role.
**Steps:**
1. Spike: Better Auth `twoFactor` plugin on Workers runtime
2. Add `two_factor_secrets` table migration (or use plugin's table)
3. UI: setup wizard for admin (QR code, 6-digit verify)
4. Enforce: `requireAdmin()` checks `twoFactorVerifiedAt` within 24h or rejects
5. Backup codes generation + recovery flow

**Acceptance:** Admin login requires TOTP; lost-device recovery via backup codes.

---

## TIER-2D — Observability Platform (Sprint 2)

**Goal:** Production-grade error tracking + source maps + APM.
**Components:**
1. **Sentry SDK** — `npm install @sentry/nextjs`, `sentry.client.config.ts`, `sentry.server.config.ts`, set `SENTRY_DSN` (already documented)
2. **Source maps** — configure `--source-map` in opennext build, `sentry-cli sourcemaps upload` in CI
3. **APM dashboards** — P99 latency + DB query times in Better Stack or Sentry Performance
4. **`/api/health` enhancement** — add D1 ping + R2 ping + KV ping liveness checks
5. **Logger consistency** — replace remaining 5 `console.error` with structured logger

**Acceptance:** Sentry captures unhandled rejections + API errors with readable stack traces; APM dashboard shows P50/P95/P99 latency per route.

---

## TIER-2E — CSP Nonce Migration (Sprint 3)

**Goal:** Drop `script-src 'unsafe-inline'`.
**Steps:**
1. Generate per-request nonce in `middleware.ts`; expose via response header
2. Inject `<script nonce={nonce}>` in root layout
3. Update CSP: `"'self'", "'nonce-${nonce}'", "'strict-dynamic'"`
4. Verify Next.js inline scripts (Server Components hydration) still work
5. Test e2e on production-like env

**Acceptance:** No `'unsafe-inline'` in CSP; Lighthouse CSP score green.

---

## TIER-2F — Cron HTTP → CF Scheduled Migration (Sprint 3)

**Goal:** Remove HTTP exposure of cron handlers.
**Steps:**
1. Add `[triggers]` block to `wrangler.toml` (cron expressions for heartbeat, error-digest, intelligence-score, uptime-check)
2. Implement `scheduled(controller, env, ctx)` handler in `worker.ts` (OpenNext entry)
3. Move logic from `/api/cron/*/route.ts` to direct function imports
4. Delete `/api/cron/*` HTTP routes

**Acceptance:** No `/api/cron/*` HTTP endpoints; CF dashboard shows cron triggers firing on schedule.

---

## TIER-2G — CSRF Token Enforcement (Sprint 3)

**Goal:** Reject CSRF on all non-Better-Auth POST/PUT/PATCH/DELETE.
**Steps:**
1. Add `X-CSRF-Token` cookie + header generation in `middleware.ts`
2. Add CSRF check to `middleware-api-handler.ts`
3. Update client fetches to include header (`fetch(url, { headers: { 'X-CSRF-Token': cookie } })`)
4. Add `getCsrfToken()` server helper

**Acceptance:** Cross-origin POST without CSRF token returns 403.

---

## TIER-2H — Data Quality (Sprint 4)

**Goals:**
1. Add `ON DELETE CASCADE/RESTRICT` to remaining 32 FK refs (migration 0026+)
2. Migrate money cols `transactions.amount`, `org_balances.balance` REAL → INTEGER cents
3. Standardize all `created_at` to `INTEGER unixepoch()`
4. Drop unused `users.password_hash` column

**Acceptance:** No orphan rows on parent delete; money math is integer-safe.

---

## TIER-2I — DR Runbook + Drills (Sprint 4)

**Goals:**
1. Write `docs/disaster-recovery.md`: D1 Time Travel restore command, RPO=24h, RTO=4h
2. Quarterly drill workflow: `.github/workflows/dr-drill.yml` runs `wrangler d1 export` + restore on canary DB
3. Off-site git mirror (GitLab or Bitbucket — user decides)

**Acceptance:** DR doc complete; first drill scheduled; secondary git remote pushed.

---

## TIER-2J — User-Action Items (no-code)

These require user action outside the repo:

1. **GH Actions block** — visit github.com/settings/billing for `longtho638-jpg`, resolve account restriction
2. **CAA records** — CF DNS: add `0 issue "pki.goog"` for `agencyos.network`
3. **SPF record** — CF DNS: add `v=spf1 include:_spf.google.com ~all` TXT
4. **DMARC** — CF DNS: change `v=DMARC1; p=none` → `p=quarantine` (after SPF/DKIM validates 30d)
5. **R2 bucket** — `wrangler r2 bucket create sophia-backups` (one-time)
6. **Sentry account** — sign up, create project, copy DSN to CF secret `SENTRY_DSN`
7. **Better Stack alert rules** — confirm `canary-rollback` webhook trigger configured

---

## Success Criteria (overall)

- Composite ≥95/100
- All sub-phases acceptance criteria met
- Production verified GREEN at each sprint end
- Documented audit re-run shows ≥9/10 per layer

## Risk Assessment

- **R1** — Better Auth `role` + `twoFactor` plugins on Workers runtime untested. Spike first.
- **R2** — TS error fixes may surface latent runtime bugs. Test coverage critical.
- **R3** — CSP nonce may break vendor scripts (PostHog, etc.). Stage carefully.
- **R4** — DNS changes propagation 24-48h. Schedule with maintenance window.

## Next Steps

Pick one sub-phase per sprint. Recommended sequence:
1. Sprint 1: TIER-2A (TS cleanup half) + TIER-2B (admin auth)
2. Sprint 2: TIER-2A (TS cleanup other half) + TIER-2C (MFA) + TIER-2D (Sentry)
3. Sprint 3: TIER-2E (CSP nonce) + TIER-2F (cron) + TIER-2G (CSRF)
4. Sprint 4: TIER-2H (data quality) + TIER-2I (DR) + TIER-2J (user actions)
