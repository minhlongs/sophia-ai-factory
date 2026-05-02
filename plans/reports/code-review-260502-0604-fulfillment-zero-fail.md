# Code Review Report — RaaS Fulfillment Zero-Fail (260502-0604)

## Overall Score: 6.0/10
## Critical Issues: 4
## Verdict: **REJECT — must fix C1, C2, C3 before deploy**

---

## Critical Issues

### C1 — Schema constraints violate new state machine (BLOCKER)
- `migrations/0024-videos.sql:9` declares `heygen_job_id TEXT NOT NULL` and `CHECK (status IN ('processing','completed','failed'))`.
- `migrations/0040` adds new columns but DOES NOT drop NOT NULL on `heygen_job_id` nor relax the CHECK.
- `videos-repo.ts:52 enqueueVideo()` inserts WITHOUT `heygen_job_id` AND with `status='queued'` → both constraints fire on first paid customer; INSERT throws; queue-first claim is a lie at runtime.
- **Fix:** add migration 0043 to (a) drop CHECK and recreate with new statuses including `queued`/`failed_permanent`, (b) make `heygen_job_id` nullable. SQLite requires table rebuild via temp-table swap.

### C2 — Sentry forwarder is dead code (F7 contract broken)
- `lib/observability/sentry-forwarder.ts` exports `forwardToSentry` but **no callsite** outside its own test (`grep -r forwardToSentry src/` returns only the file itself + tests).
- `logger.error()` does not call it (logger-utility/logger-internals do not import the forwarder).
- Net effect: F7 ("All errors → Sentry") shipped a no-op. In prod when `$49` flow breaks silently, ops will not be paged.
- Bonus: the forwarder POSTs to `/api/{id}/store/` which Sentry **deprecated in 2020** in favor of `/envelope/`. Even if wired, modern projects will reject.
- **Fix:** wire `dispatch()` in `logger-internals.ts` to call `forwardToSentry()` for `error` level (fire-and-forget); migrate to `/envelope/` endpoint.

### C3 — Existing `video-status-sync` cron leaves rows in dead state
- `app/api/cron/video-status-sync/route.ts:80–87` writes `status='failed'` (NOT `failed_permanent`) on timeout.
- New retry cron only picks up `status='queued'`. Reconcile cron only counts `failed_permanent`.
- Result: timed-out one-time bundles become invisible orphans — no retry, no permanent-failure email, no compensation, NOT counted in reconcile alert. Customer paid $49, status page shows "rendering" forever.
- **Fix:** in video-status-sync, on timeout, route `purchase_id IS NOT NULL` rows through the new state machine (`failed_permanent` + compensation + email) instead of legacy `failed`.

### C4 — R2 presigned URL API call is hallucinated
- `video-access-control.ts:108` calls `(r2.bucket as R2Bucket & { createSignedUrl?: ... }).createSignedUrl?.()`.
- **Cloudflare Workers R2 binding has no `createSignedUrl` method.** Presigned URLs require S3-compat API + access keys, not the binding. The cast hides it.
- For private buckets the route returns 503 "r2_unavailable" forever.
- The "public bucket" branch above (line 100–104) works only if `R2_PUBLIC_BASE_URL` is set — but then videos are world-readable; the access-revoke check is moot since the URL is just a path concat.
- **Fix:** either (a) require `R2_PUBLIC_BASE_URL` + accept that revocation requires R2 object delete, or (b) implement actual S3 SigV4 with R2 access keys via Web Crypto.

---

## Major Concerns

### M1 — TOCTOU race: webhook + cron both grant compensation
- `failVideoFromWebhook` (line 174) and `fulfillment-retry/route.ts:117` both: read row → check `nextAttemptCount >= MAX_ATTEMPTS` → `markPermanentFailure` → `grantCompensationCredit`.
- `compensation.ts:wasAlreadyGranted` does its own SELECT-then-INSERT, no atomic guard. Two callers in flight at the same second can both see "not granted" and both insert. **Customer gets +2 credits.**
- Probability low but not zero given F4 webhook + every-2-min cron.
- **Fix:** wrap compensation in D1 transaction OR use `INSERT … ON CONFLICT DO NOTHING` with a unique constraint on `(license_nonce, event_type)`.

### M2 — `markPermanentFailure` not atomic with attempt count check
- Both webhook and cron compute `nextAttemptCount = row.attempt_count + 1` from a stale read. If both bump independently:
  - Webhook reads attempt=4 → bumps to 5 → permanent.
  - Cron reads attempt=4 (same snapshot) → bumps to 5 → permanent again → 2 emails, 2 audit rows (idempotency saves credits but email may double).
- **Fix:** compare-and-swap in SQL: `UPDATE … WHERE id=? AND attempt_count=?` + check rowcount.

### M3 — `updated_at` type mismatch
- `videos.updated_at TEXT DEFAULT (datetime('now'))` (migration 0024).
- `videos-repo.revokeAccessByPurchaseId:145` writes `updated_at = ?2` with integer epoch-seconds.
- `complete-video-from-webhook.ts:112` same issue (writes integer).
- SQLite is dynamically typed so writes succeed, but downstream consumers reading TEXT may break (e.g. `new Date(row.updated_at)` in `video-status-sync` line 79 reads it as ms-since-epoch string).

### M4 — Refund-during-render leaves window of free access
- If refund IPN arrives BEFORE webhook completes the video, `revokeAccessByPurchaseId` runs while no `r2_key` exists. Later webhook completes, sets `r2_key`, but never re-reads `access_revoked`. The `complete-video-from-webhook` UPDATE at line 104–116 does NOT touch `access_revoked` — good, it's preserved. But it ALSO does not set/check it. Customer hits the URL, `getSignedVideoUrl` correctly denies. ✅ Actually safe.
- However: `sendOneTimeBundleReadyEmail` will still fire after refund. Customer gets "Your video is ready" email even though their refund was processed. UX bad.
- **Fix:** add `access_revoked` check in `completeVideoFromWebhook` before sending ready email.

### M5 — `videos.user_id REFERENCES users` but synthetic monitor lives in `"user"` (Better Auth)
- Migration 0042 inserts to `"user"` table; `videos` FKs `users` (legacy lowercase). D1 likely has FKs disabled by default, so synthetic flow works in practice — but it's a latent bug if PRAGMA changes.

---

## Minor Suggestions

- `videos-repo.ts` 231 LOC, `complete-video-from-webhook.ts` 204 LOC — both over the 200-line guideline. Split read vs write ops, or factor email-side-effect into separate module.
- `retry-backoff.ts:29` — when `lastAttemptAt === 0` returns 0 (immediate retry), but enqueue path uses `attempt=0, last=null`; first `recordAttempt` sets `last=now`. Edge case ok.
- `slack-alert.ts` lacks signature/auth on outgoing webhook — Slack URL is the secret; treat env var as a secret (already in use that way).
- `bundle-render-failed.ts:8` and `bundle-generating.ts:10` capture `process.env` at module init. Edge runtime usually bundles correctly; verify after first deploy.
- `fulfillment-retry/route.ts:38` `BATCH_LIMIT=20` with cron every 2min. If backlog spikes >20 the queue drains slowly. Worth alerting when `summary.skipped` is large.
- `order-card.tsx:78` `dedupingInterval: 20*60*1000` for video URL but TTL is 30min — first fetch + 20min reuse + idle = potential TTL miss for customers leaving the tab open.
- `smoke-one-time/route.ts:122–132` synthetic insert hardcodes `priceUsd: 0`, `amountCents: 0`. Confirms no revenue pollution. ✅
- `reconcile-query.ts:61` correctly excludes `payment_id LIKE 'SYNTHETIC_%'` from paid count. ✅

---

## Strengths

- HMAC verification correct (constant-time Web Crypto, hex compare).
- Multi-header signature acceptance is safe — HMAC body+secret still required.
- Cron auth supports query param + Bearer + CF internal — reasonable fallback ladder.
- Queue-first design is the right architecture; idempotency via `findByPurchaseId` is sensible.
- `verifyHeyGenSignature` test coverage strong (mismatch, length, error path).
- Bilingual UI + emails consistent with handover rules.
- No `:any`, no `console.*` in scope. ✅
- Subscription IPN path untouched. ✅

---

## Phase-Specific Notes

- **Phase 01:** Architecture sound but C1 (schema) and C3 (legacy cron) make it non-functional in prod. Retry math correct, idempotency OK.
- **Phase 02:** Webhook receiver well-structured; HMAC solid. F6 generating email idempotent. Synthetic monitor design is clever (two-phase) but creates timer drift if any single run is delayed.
- **Phase 03:** Sentry forwarder C2 is the headline failure. Reconcile cron + alert email is solid. R2 access-control C4 cannot work as written.

---

## Anti-Pattern Audit

- `:any` types: **0**. ✅
- `console.*` calls: **0** in new code. ✅
- Files >200 LOC: `videos-repo.ts` (231), `complete-video-from-webhook.ts` (204).

---

## Race Condition Analysis

- **Retry + webhook race:** RISKY (M1, M2). No CAS on attempt_count. Compensation TOCTOU possible. Low frequency, real risk.
- **Refund-during-render race:** SAFE for URL access (`access_revoked` honored), UNSAFE for ready email (M4 fires "video ready" after refund).
- **Synthetic monitor revenue pollution:** SAFE. `payment_id LIKE 'SYNTHETIC_%'` excluded; `amount_cents=0`; cleanup deletes rows after each run.

---

## Recommended Actions Before Deploy

1. **STOP.** Add migration 0043 to drop NOT NULL on `heygen_job_id` and relax CHECK on `status` to include `queued`/`failed_permanent`. Verify `enqueueVideo` succeeds in test env (C1).
2. Wire `forwardToSentry` from `logger.error()` and switch to `/envelope/` endpoint (C2). Test in staging with real DSN.
3. Patch `video-status-sync` to route timeouts of `purchase_id IS NOT NULL` rows through `markPermanentFailure` + compensation + email (C3).
4. Decide R2 strategy: public bucket + revoke-by-delete, OR S3 SigV4 module (C4). Document choice.
5. Wrap compensation grant in `INSERT … ON CONFLICT` (M1).
6. Add CAS to `markPermanentFailure` (M2).
7. Normalize `updated_at` to TEXT-ISO across all writes (M3).
8. Skip ready email when `access_revoked=1` in `completeVideoFromWebhook` (M4).
9. Re-run full vitest suite (incl. new tests). Manual smoke: pay → enqueue → kill HeyGen → confirm row stays queued, retry cron requeues, eventual permanent_fail + email + +1 credit.
10. After deploy, watch first 24h reconcile output; expect orphanCount=0.

---

## Unresolved Questions

- Does HeyGen actually send `signature` (not `x-heygen-signature`)? Phase 02 report listed 4 candidates — need vendor doc confirmation post-deploy.
- D1 PRAGMA foreign_keys — ON or OFF in prod? Affects synthetic FK risk.
- What is the agreed compensation policy for `failed_permanent` triggered by user-side bad inputs (e.g. malformed script)? Current code grants +1 credit unconditionally — could be abused via crafted scripts that fail HeyGen 5x.
