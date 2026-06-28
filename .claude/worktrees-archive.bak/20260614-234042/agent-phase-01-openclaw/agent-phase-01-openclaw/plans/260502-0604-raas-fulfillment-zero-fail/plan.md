---
title: "RaaS One-Time Fulfillment Hardening — Zero-Fail Delivery"
description: "Eliminate 11 failure modes in the post-payment video fulfillment chain so paid customers always receive their video."
status: completed
completed: 2026-05-02
priority: P1
effort: 20h
branch: main
tags: [raas, one-time, fulfillment, heygen, reliability, zero-fail]
created: 2026-05-02
---

# RaaS One-Time Fulfillment — Zero-Fail Delivery

**Date:** 2026-05-02 | **Mode:** Quality | **Status:** completed
**Goal:** Customer pays $49 → receives a working welcome video within 10 minutes, with full recovery if any step fails. No silent drops, no manual rescues.

## Context

Plan `260502-0508-raas-one-time-zero-bug/` shipped the happy path (checkout endpoint, IPN branch, fulfillment trigger, 5-min cron poll). Audit reveals the chain has **11 silent-failure points** that can leave a paid customer with no video and no recovery path.

Current chain (single-pass, no retry):
```
NOWPayments IPN finished → markPaid → triggerOneTimeFulfillment → HeyGen.createVideo →
  insert videos(processing) → cron poll every 5min → email when done
```

Failure modes exposed: HeyGen 5xx swallowed, missing email blocks fulfillment, no intent row before HeyGen call (so retry is impossible), no webhook callback (latency 5–10min not "instant"), no synthetic monitor, no fallback provider, no R2 access revocation on refund.

**Approach:** 3-phase hardening — P0 critical (paid customer never loses video), P1 UX (faster + cleaner status surface), P2 ops + anti-abuse (observability, fallback, revenue protection).

## Phases

| Phase | Description | Features | Effort | Status |
|-------|-------------|----------|--------|--------|
| 01 | P0 critical — queue-first, retry, status page | F1, F2, F3 | 6h | done |
| 02 | P1 UX hardening — webhook, synthetic monitor, queue email | F4, F5, F6 | 6h | done |
| 03 | P2 ops + anti-abuse — Sentry, reconcile, circuit breaker, signed URLs | F7, F8, F9, F10 | 8h | done (F9 deferred) |

## Phase Files

- [phase-01-p0-critical.md](./phase-01-p0-critical.md) — F1 queue intent before HeyGen, F2 retry cron, F3 status page
- [phase-02-p1-ux-hardening.md](./phase-02-p1-ux-hardening.md) — F4 HeyGen webhook, F5 synthetic monitor, F6 generating email
- [phase-03-p2-ops-anti-abuse.md](./phase-03-p2-ops-anti-abuse.md) — F7 logger, F8 reconcile, F9 circuit breaker + D-ID, F10 signed URLs

## Key Dependencies

- **F2 depends on F1** — retry cron needs queued rows to retry
- **F3 depends on F1** — status page reads `videos.status` extended states
- **F4 depends on F1** — webhook updates the queued row, not creates new
- **F6 depends on F1** — email fires on insert intent, not after HeyGen success
- **F8 depends on F1, F2** — reconcile diffs paid purchases vs delivered videos using new states
- **F9 depends on F1, F2** — breaker switches provider during F2's retry attempts
- **F10 depends on existing R2 service** — independent of P0/P1

## Top 3 Risks

1. **Status enum migration breaks existing 5-min cron** — `video-status-sync` currently scans `status='processing'`. Adding `queued`/`failed_permanent` requires the cron to keep ignoring those (they're handled by F2). Mitigation: explicit WHERE clause unchanged, F2 cron uses its own predicate.
2. **HeyGen webhook signature spoofing** — `/api/webhooks/heygen` is a public endpoint. Mitigation: HeyGen sends `signature` header; verify HMAC + require `heygen_job_id` to match an existing `videos` row before mutating.
3. **Retry storm during HeyGen outage** — F2 cron + F9 circuit breaker must not hammer a degraded provider. Mitigation: exponential backoff inside F2 (30s → 1m → 5m → 15m → 1h) + breaker opens after 50% failure rate.

## Success Criteria

- [x] Build: 0 TS errors, 0 `:any`, 0 `console.log`
- [x] Tests: existing pass + ~69 new unit cases (baseline 2136 → 2205)
- [x] Migrations 0040, 0041, 0042, 0043 applied locally
- [x] All critical fixes (C1-C4, M1-M2, M4) verified locally
- [x] Manual chaos test: HeyGen failure → retry cron recovers within 1h → email sent
- [x] Manual chaos test: trigger refund post-render → presigned URL returns 403
- [x] Code review cleared: all changes audited for security, performance, no PII leaks

## Cross-Cutting Constraints

- **Tier enum unchanged**: `BASIC | PREMIUM | ENTERPRISE | MASTER` — never extend
- **Auth**: `getCurrentUser()` for user routes, `verifyCronAuth()` for cron routes
- **DB**: `createServerClient()` sync (no await), `getD1Raw()` for raw prepared SQL
- **File size ≤200 LOC** — each new module modular
- **Bilingual emails** Vi+En via existing `lib/billing/email/templates/` pattern
- **No Polar.sh** — provider stays NOWPayments + HeyGen (+ D-ID fallback in F9)

## Deployment Status

**Local:** ✅ All migrations applied (0040, 0041, 0042, 0043), code complete, 2205/2205 tests pass

**Remote (Sophia D1):** ⏳ Pending — migrations not yet applied to prod database
- Migration 0040: videos fulfillment state machine
- Migration 0041: videos access control (refund-aware)
- Migration 0042: synthetic monitor user
- Migration 0043: videos table constraint relaxation

**GitHub Actions CI:** ⚠️ Manually disabled at user level — requires manual `wrangler deploy` to ship

**Features to Deploy:**
- P0: queue-first (F1), retry cron (F2), status page (F3) ✅
- P1: webhook (F4), synthetic monitor (F5), generating email (F6) ✅
- P2: Sentry logging (F7), reconciliation (F8), refund-aware URLs (F10) ✅
- P2: D-ID fallback (F9) — DEFERRED pending D-ID account provisioning

## Open Items

1. **F9 Follow-up:** D-ID API account + budget provisioning. Circuit breaker pattern ready locally, awaiting account details to wire adapter.
2. **is_onboarding Column Phantom:** Latent issue detected during code review — not critical to current fulfillment chain. Documented in code-review-260502-0604.md for future sprint.
3. **M3+M5 Deferred:** Identified during testing but deferred due to D1 dialect constraints. Documented in test report.

## Open Questions — to resolve before next phase

1. **D-ID API quota** — does account have free tier or do we need to provision $X budget for F9 fallback?
2. **Remote migration timing** — coordinate with DB ops for safe apply window during low traffic
3. **GitHub Actions re-enable** — CI/CD pipeline disabled; need approval to restore automated deploys
