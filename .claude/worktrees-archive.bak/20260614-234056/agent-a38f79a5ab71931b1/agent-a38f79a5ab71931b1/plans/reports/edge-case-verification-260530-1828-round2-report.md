# Edge Case Verification Report — Round 2 (Post-commit 5a842541)

> Generated: 2026-05-30 18:28 PST
> Scope: 4 commits prior to 5a842541 (HEAD~4..HEAD~1), 55 files changed, 1366 insertions
> Method: Ultrathink + 4 parallel code-reviewer subagents

## Summary

| Metric | Count |
|--------|------:|
| Total edge cases analyzed | 25 |
| ✅ Handled | 11 |
| ❌ Unhandled (need fix) | 5 |
| ⚠️ Partial (need review) | 9 |

## ❌ Unhandled Edge Cases (Need Fix)

| # | Severity | Edge Case | File | Line |
|---|----------|-----------|------|------|
| 1 | **CRITICAL** | `generateIdempotencyKey` random suffix defeats deduplication — retries without requestId double-bill | `idempotency.ts` | 33-35 |
| 2 | **CRITICAL** | Mission dispatcher: `credits_used` NOT set on failure → reaper refund path is dead code → user credits permanently lost | `dispatcher.ts` + `mission-reaper/route.ts` | 185-195 + 116 |
| 3 | **HIGH** | Mission handler timeout: no AbortController — timed-out handlers continue side effects (publish, email) for missions already marked failed | `dispatcher.ts` | 153-163 |
| 4 | **HIGH** | Email outbox locking: same-second cron runs read each other's locked rows → duplicate emails | `email-outbox.ts` | 57-79 |
| 5 | **MEDIUM** | `debitMcuBalance`: INSERT INTO transactions not wrapped with atomic UPDATE → audit trail gap on partial failure | `d1-client-rpc.ts` | 71-88 |

## ⚠️ Partial Handling (Need Review)

| # | Severity | Edge Case | File | Issue |
|---|----------|-----------|------|-------|
| 1 | **MEDIUM** | Token key rotation: `reEncryptToken` exists but zero callers invoke it — manual migration script required | `token-crypto.ts` | 142 |
| 2 | **MEDIUM** | Dunning KV cache: `kv.set(key, null)` for invalidation — works because `null` fails the `'allowed' in cached` check, but relies on type coercion quirk | `dunning-kv-cache.ts` + `dunning-admin-operations.ts` | 31 |
| 3 | **MEDIUM** | IPN dispatch dedup: `.single()` may throw on empty result depending on D1 adapter — catch block disables dedup silently | `nowpayments-ipn-dispatch.ts` | 55-73 |
| 4 | **MEDIUM** | Quota checker KV reservation: fire-and-forget write with full-object overwrite → concurrent over-quota bounded by D1 truth | `quota-checker.ts` | 115-125 |
| 5 | **LOW** | better-auth-server: `addCredits` dynamic import from `@/lib/mcu/` — layer violation (seed→lib); no error handling on import failure | `better-auth-server.ts` | 181-183 |
| 6 | **LOW** | video-access-control test: `DB_ERROR_SENTINEL` path not tested | `video-access-control.test.ts` | — |
| 7 | **LOW** | Worker queue: `incrementUsage` not idempotent; retry double-counts KV value (bounded: 1 extra token/failure) | `worker/index.ts` | 70-84 |
| 8 | **LOW** | Email outbox stale lock: 5-min threshold safe for BATCH_SIZE=20 but invariant undocumented | `email-outbox.ts` | 57 |
| 9 | **LOW** | one-time-fulfillment: comment references migration 0093 but actual UNIQUE index is in migration 0148 (stale comment only, runtime correct) | `one-time-fulfillment.ts` | 47-51 |

## ✅ Handled (No Action Needed)

| # | Edge Case | How Handled |
|---|-----------|-------------|
| 1 | require-admin base64 padding correctness | New formula `'='.repeat((4 - (str.length % 4)) % 4)` mathematically correct for all lengths |
| 2 | require-admin sig spread safety | `sigBytes.length !== 32` guard + fixed HMAC-SHA256 = safe |
| 3 | video-access-control `db_error` mapping | Route handler maps `db_error` → 503; only one production caller |
| 4 | video-access-control `access_revoked !== 0` | D1 INTEGER → JS number; `!== 0` ≡ `=== 1` |
| 5 | Inngest 8 new functions | All exported from barrel; build catches missing exports |
| 6 | one-time-fulfillment TOCTOU guard | UNIQUE partial index in migration 0148 enforces correctness |
| 7 | video-status-sync `db!` assertion | Early-return guard on null db; closure only invoked after non-null assignment |
| 8 | Quota enforcer cache invalidation removal | tracker.ts correctly invalidates after D1 write (fix #R2-16) |
| 9 | IPN incrementUsedCount TOCTOU | Usage incremented in IPN handler after payment confirmed, not at checkout |
| 10 | Dunning cache invalidation on state transition | invalidateDunningCache called on all transition paths (suspend, restore, payment fail/success) |
| 11 | Worker queue error handling | try/catch around incrementUsage + msg.retry() on failure |

## Detailed Analysis of Critical Issues

### Issue 1: Idempotency Key Defeats Deduplication (EC-15)

```typescript
// idempotency.ts:33-35
const suffix = crypto.randomUUID().slice(0, 8);
const hash = sha256(`${userId}:${licenseNonce}:${service}:${action}:${ts}:${suffix}`);
return `gen_${hash}`;
```

Every call without `requestId` generates a unique key. If a usage event is retried (network timeout, worker restart), the retry generates a DIFFERENT key. The dedup lookup in `tracker.ts` finds no match → event recorded twice → user double-billed.

**Fix:** Remove the random suffix. Without `requestId`, key should be deterministic on `(userId, licenseNonce, service, action, timestamp_second)`. Two identical requests in the same second SHOULD be deduplicated.

### Issue 2 + 3: Mission Credits + Timeout (EC-10 + EC-11)

```typescript
// dispatcher.ts:131 — credits deducted BEFORE handler
const deducted = await deductCredits(mission.user_id, creditsUsed, missionId, ...);

// dispatcher.ts:153-163 — no AbortController
handlerResult = await Promise.race([
  handler({ missionId, userId, ... }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 25_000))
]);

// dispatcher.ts:185-195 — failure path
await db.from('engine_missions').update({
  status: 'failed',
  error: handlerResult.error,
  // NOTE: credits_used NOT set here!
}).eq('id', missionId);

// mission-reaper/route.ts:116
const creditsToRefund = mission.credits_used ?? 0;  // null → 0 → no refund
```

Two interlinked problems:
1. Credits deducted before handler, not refunded on failure (reaper can't find `credits_used` since it's only set on success)
2. No AbortController — handler continues executing side effects after timeout

**Fix:** Set `credits_used = creditsUsed` on failure path too. Pass AbortSignal to handlers.

### Issue 4: Email Outbox Same-Second Double-Claim (EC-13)

```sql
-- email-outbox.ts:57-58
UPDATE welcome_email_outbox
SET status = 'processing', locked_at = ?
WHERE status = 'pending'
  AND (locked_at IS NULL OR locked_at < ?)
LIMIT 20
-- Then SELECT WHERE locked_at = ? — both instances get same rows
```

Two cron instances in the same second both set `locked_at = <same_timestamp>` and both read the same rows.

**Fix:** Use `UPDATE ... RETURNING` to atomically claim and read rows, or include a unique worker token.

### Issue 5: debitMcuBalance Partial Failure (EC-18)

```typescript
// d1-client-rpc.ts:71-88
const updateResult = await this.db.prepare(
  `UPDATE org_balances SET balance = balance - ?, updated_at = datetime('now')
   WHERE org_id = ? AND balance >= ?`
).bind(amount, orgId, amount).run();

// UPDATE succeeds, then INSERT fails → balance debited, no audit trail
await this.db.prepare(
  'INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)'
).bind(orgId, -amount, 'debit', feature).run();
```

Note: `creditMcuBalance` correctly uses `db.batch([...])` for the same pattern.

**Fix:** Wrap both statements in `db.batch([updateStmt, insertStmt])`.

## Unresolved Questions

1. Does Cloudflare guarantee no concurrent cron trigger runs? If yes, EC-13 (email locking) severity drops to informational.
2. Is "attempted work = cost incurred" a deliberate product decision for mission credits? If yes, should be communicated to users in UI.
3. Does `scripts/reencrypt-publishing-tokens.ts` exist for the key rotation migration referenced in token-crypto.ts?
