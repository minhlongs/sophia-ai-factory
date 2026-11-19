# Sophia 10.0 Release Candidate (`release/sophia-10-0-rc`)

**Status:** Draft Release Candidate — Ready for Hosted CI Validation (`G7`), **NOT deployed to production**, **NOT merged to `main`**.
**Branch:** `release/sophia-10-0-rc`
**Base Commit (`main`):** `bbf37047800f06fa9b1e95e0eaf142b2d3525cb7`
**Date:** 2026-11-19

---

## 1. Release Scope Summary

### 1.1 Revenue, Payments & Refund Hardening
- **PayOS Webhook & IPN Identity Correlation (`/api/webhooks/payos`, `/api/payos/ipn`):** Enforced strict order/payment identity matching (`provider_payment_id`, `provider_order_code`, `amount_vnd`, currency, and tier/period invariants) via `payos-payment-identity.ts`, atomic cancellation claims with runtime event-table allowlisting (`payos_events` | `payment_events`), stale subscription-state guards, and guarded lock release on rejected activations.
- **NOWPayments Refund Dispatch (`src/land/refunds/processor/gateway-refund-dispatcher.ts`):** Enforced fail-closed behavior when credentials or upstream gateway conditions prevent safe refund execution.
- **PayOS Activation Stale-State Guard:** Prevented out-of-order or stale webhook replays from regressing active subscription states.

### 1.2 Customer BYOK & Platform-Spend Isolation
- **OpenRouter BYOK Fail-Closed Enforcement:** Audited and hardened customer-facing script, proposal, landing, sales, dubbing, and video creation surfaces (`src/land/scripts/seo/script-generator.ts`, `src/seed/ai/proposal-generator.ts`, `src/app/actions/video-creation-actions.ts`, `src/land/services/real/script-service.ts`, and related callers) so customer inference requires an explicit customer BYOK key and never silently falls back to platform `OPENROUTER_API_KEY`.
- **Unit Test Alignment:** Updated `src/land/scripts/__tests__/generate-seo-script.test.ts` to assert fail-closed `BYOK_REQUIRED` behavior even when `OPENROUTER_API_KEY` is present in the environment.

### 1.3 Multi-Tenant Organization Isolation
- **Mission Dispatch Engine (`src/forest/missions/dispatcher-ops/mission-dispatch-engine.ts`):** Resolved `orgId` server-side from verified user membership via `resolveOrgId`, rejected both single-key (`orgId`) and dual-key (`orgId` + `org_id`) spoofing attempts before credit deduction or handler invocation, and normalized/stripped `orgId` and `org_id` on `parsedParams` prior to handler execution.

### 1.4 Cron Alignment & Observability
- **Cron Schedule Parity (`wrangler.toml` ↔ `scripts/inject-scheduled-handler.mjs`):** Aligned all 23 `wrangler.toml` cron triggers with the 23 patterns / 40 routes in `scripts/inject-scheduled-handler.mjs` (`ci-check-cron-alignment.sh` passes). Removed two redundant/unmapped schedules (`30 2 * * *` duplicate of `0 5 * * *` D1 backup, and unmapped `0 9 * * *`).
- **Onboarding Check Cron (`src/app/api/cron/onboarding-check/route.ts`):** Recorded `'failure'` via `recordCronRun` in the outer `catch` handler, logged full errors server-side via `logger.error`, and removed raw internal error details from HTTP 500 responses.

### 1.5 Runtime & Toolchain Upgrades
- Upgraded core dependencies in `apps/sophia-ai-factory/package.json` and regenerated `apps/sophia-ai-factory/package-lock.json` (Next.js `16.4.6`, Vitest `4.1.12`, `better-sqlite3` `12.11.1`, and OpenNext Cloudflare adapter).
- Verified isolated clean install (`npm ci --legacy-peer-deps`) and native `better-sqlite3` binding execution on Node `v22.23.2` (`npm 11.21.1`, `Darwin arm64`).

---

## 2. Verification Matrix

| Gate | Check | Command | Environment | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| G1 | Independent Security Review | `code-reviewer` subagent audit + targeted tests | Local worktree | **PASS** | 4 hardening fixes applied + `generate-seo-script.test.ts` updated; targeted suite 18 files / 137 tests passed |
| G2 | TypeScript Type-Check | `npm run type-check` | Local worktree | **PASS** | Exit `0` (re-verified post-G1 edits) |
| G2 | ESLint | `npm run lint` | Local worktree | **PASS** | Exit `0` |
| G2 | Layer Boundaries | `npm run check:boundaries` | Local worktree | **PASS** | Exit `0` |
| G2 | i18n Validation | `npm run i18n:validate` | Local worktree | **PASS** | Exit `0` |
| G2 | Open-Core Verification | `npm run verify:open-core` | Local worktree | **PASS** | Exit `0` |
| G2 | D1 Migration Checks | `npm run check:migrations` | Local worktree | **PASS** | Exit `0` |
| G2 | Mock Migration Suite | `bash scripts/test-apply-migrations-mock.sh` | Local worktree | **PASS** | Exit `0` (43/43 tests passed) |
| G2 | Production Source Guards | `bash scripts/check-production-source-guards.sh` | Local worktree | **PASS** | Exit `0` |
| G2 | Secret Scanning | `npm run ci:secrets` | Local worktree | **PASS** | Exit `0` |
| G2 | Revenue Journey Suite | `npm run test:journey` | Local worktree | **PASS** | Exit `0` (1 file / 6 tests passed) |
| G2 | Production + OpenNext Build | `SKIP_SYMBOL_UPLOAD=1 npm run deploy:build` | Local worktree | **PASS** | Exit `0`; `.open-next/worker.js` built; `scheduled()` injected (23 patterns, 40 routes) |
| G2 | Full Test Suite + Coverage | `CI=true npm test -- --coverage --maxWorkers=2` | Local macOS (Node `v26.7.0`) | **HOSTED_CI_PENDING** | 2,133/2,140 files passed (20,293 tests); 1 real regression (`generate-seo-script.test.ts`) fixed; 5 SQLite tests require Node 22 native `better-sqlite3` binding (validated in G3; full Linux/Node 22 run + `check-diff-coverage.mjs` to be verified in G7 Hosted CI) |
| G3 | Isolated Clean Install (macOS) | `npm ci --legacy-peer-deps` + `better-sqlite3` smoke | Node `v22.23.2` / npm `11.21.1` / `Darwin arm64` | **PASS** | `NPM_CI_EXIT=0`, `SQLITE_EXIT=0` (`{"id":1,"name":"sophia-10-2"}`) |
| G3 | Isolated Clean Install (Linux) | Hosted GitHub Actions `ubuntu-latest` / Node 22 | GitHub Actions | **HOSTED_CI_PENDING** | Verified on Draft PR push in G7 |
| G4 | Cron Alignment Check | `bash scripts/ci-check-cron-alignment.sh` | Local worktree | **PASS** | Exit `0` (23 `wrangler.toml` schedules match 23 patterns / 40 routes) |
| G4 | GitHub Workflow Trigger Audit | `.github/workflows/*.yml` inspection | Local worktree | **PASS** | `deploy.yml` only fires on `push` to `main` or `workflow_dispatch`; PR workflows are read-only |

---

## 3. Production Rollout Plan (Post-G7 Approval Only)

> **Guardrail:** Do **not** execute any step below until G7 Hosted CI is green on the Draft PR and a human release approver explicitly authorizes merge and deployment.

1. **Pre-Merge Gate (G7):** Confirm all required GitHub Actions workflows on the Draft PR (`ci.yml`, security/secret checks, Node 22 Linux `npm ci`, full Vitest + `check-diff-coverage.mjs`, OpenNext build) pass with zero failures.
2. **D1 Database Backup:** Capture a timestamped Cloudflare D1 production export/backup prior to applying any pending migrations.
3. **PayOS Webhook Endpoint Verification:** Confirm in the PayOS dashboard whether only `/api/webhooks/payos` or `/api/payos/ipn` is registered as the active webhook target (do not register both simultaneously for the same payment event).
4. **Merge & Deploy:** Convert Draft PR to Ready for Review, obtain approval, merge to `main`, and monitor the `deploy.yml` Cloudflare Workers deployment and `/api/health` readiness probes.
5. **Post-Deploy Smoke Checks:**
   - Verify `/api/health` returns `200 OK`.
   - Verify PayOS test ping handling returns `{ received: true, ignored: 'test_ping' }`.
   - Verify cron check-in telemetry for the first scheduled window (`onboarding-check` and `d1-backup`).
   - Monitor Sentry / Cloudflare Worker logs for 30 minutes for any `BYOK_REQUIRED`, `unauthorized_org`, or 5xx spikes.

---

## 4. Rollback Plan

1. **Immediate Worker Rollback (No Git Revert Needed):**
   - Run `wrangler rollback` (or promote the previous Cloudflare Workers deployment version in the Cloudflare Dashboard) to restore the prior Worker bundle immediately.
2. **Git / Main Branch Rollback:**
   - If the issue requires reverting `main`, open a revert PR (`git revert -m 1 <merge-sha>`) and allow `deploy.yml` to redeploy the reverted commit cleanly.
3. **Database State:**
   - All schema changes in this RC are additive/idempotent and guarded by `test-apply-migrations-mock.sh` (43 tests). If a D1 restore is ever required, restore from the pre-deploy D1 backup snapshot taken in Step 2 of the Rollout Plan.

---

## 5. Non-Actions Explicitly Confirmed for This RC Phase

- No merge to `main` was performed.
- No production Cloudflare Workers deployment was executed.
- No production D1 migrations or database writes were executed.
- No PR was marked Ready for Review; PR is opened strictly as a **Draft PR** targeting `main`.
