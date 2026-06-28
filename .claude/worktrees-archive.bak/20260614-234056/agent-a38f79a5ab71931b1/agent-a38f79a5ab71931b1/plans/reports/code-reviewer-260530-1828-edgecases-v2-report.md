# Edge Case Verification Report — EC-18..EC-25 (DB Client, Video Access, Infrastructure)

## EC-18: debitMcuBalance — transaction INSERT separated from atomic UPDATE
**Status: ❌ UNHANDLED**

**Evidence:**
- `d1-client-rpc.ts` lines 71-88: UPDATE is atomic (good), but INSERT INTO transactions at line 85-88 is a separate statement outside `this.db.batch()`.
- Compare: `creditMcuBalance` (lines 94-99) correctly wraps both balance change + transaction INSERT inside `this.db.batch([...])`.
- If UPDATE succeeds but INSERT fails (constraint violation, schema mismatch), balance is debited with no audit trail — silent financial inconsistency.

**Impact:** Medium-High. Monetary balance out of sync with audit log; hard to reconcile.

**Recommended fix:** Move INSERT into a `this.db.batch([update, insert])` mirroring `creditMcuBalance`.

---

## EC-19: better-auth-server — `addCredits` dynamic import from `@/lib/mcu/`
**Status: ⚠️ PARTIAL**

**Evidence:**
- Line 183: `const { addCredits } = await import('@/lib/mcu/credits-repo')` — path resolves (file exists at `src/lib/mcu/credits-repo.ts`).
- Per `apps/sophia-ai-factory/CLAUDE.md` canonical imports, auth should use `@/seed/*`. The `lib/mcu/` directory sits outside the 4-layer seed→tree→forest→land hierarchy.
- Layer-architecture rule forbids seed→tree/forest/land, but allows tree→lib; reverse direction (lib consumer from seed/auth) works but is architecturally inconsistent.

**Impact:** Low. Works at runtime. Risk is future refactor moving credits-repo without updating the dynamic import path — signup bonus silently breaks.

**Recommended fix:** Move credits-repo to `@/seed/credits/credits-repo.ts` (primitive utility) or `@/tree/credits/credits-repo.ts` (domain reusable) to align with canonical layer structure.

---

## EC-20: video-access-control — DB_ERROR_SENTINEL caller handling
**Status: ✅ Handled in production caller / ⚠️ Untested**

**Evidence:**
- Route handler `src/app/api/videos/[id]/url/route.ts` lines 45-51 maps `db_error` → HTTP 503. Correct.
- However, `src/lib/video/__tests__/video-access-control.test.ts` has NO test case for the DB_ERROR_SENTINEL path (no mock that throws from getD1Raw).
- All 6 test cases cover not_found/unauthorized/revoked/not_ready/r2_unavailable/granted — `db_error` branch is untested.

**Impact:** Low. Production handler is correct. Risk: a future refactor removes the db_error mapping and the untested branch breaks silently.

**Recommended fix:** Add one test case: mock `getD1Raw` to throw, assert `reason === 'db_error'`.

---

## EC-21: video-access-control — `access_revoked !== 0` vs `=== 1`
**Status: ✅ Handled**

**Evidence:**
- Migration 0041 + 0089: `access_revoked INTEGER NOT NULL DEFAULT 0`.
- D1 uses SQLite. SQLite INTEGER columns return JavaScript numbers via `.first()`, not strings.
- `0 !== 0` → `false` (correct: access not revoked). `1 !== 0` → `true` (correct: access revoked).
- `"0" !== 0` would be `true`, but SQLite never returns the string `"0"` for an INTEGER column.
- Partial index in migration 0089: `ON videos(access_revoked) WHERE access_revoked = 1` — confirms intended usage.

**Impact:** None. `!== 0` is semantically equivalent to `=== 1` for D1 INTEGER columns, and more defensive against unexpected non-1 truthy values.

---

## EC-22: Worker queue — incrementUsage idempotency under retry
**Status: ⚠️ PARTIAL**

**Evidence:**
- Worker `src/forest/worker/index.ts` lines 69-84: `await incrementUsage(...)` then `msg.ack()`.
- `quota-counter.ts` lines 59-80: reads KV, parses, adds tokens, writes back — pure read-modify-write, no idempotency key.
- Cloudflare Queues guarantees at-least-once delivery. If ack fails after the KV write (rare but possible under pressure), redelivery → double increment.
- The worker catches errors and calls `msg.retry()` (line 83), but only when the `await incrementUsage` throws — not when ack fails separately.

**Impact:** Low. Double increment is bounded (one extra token per failure). Not financially material for quota tracking. But the assumption "msg.ack() after incrementUsage" doesn't make incrementUsage itself idempotent.

**Recommended fix:** Wrap ack+increment into a single try, or accept double-increment as an acceptable quota-tracking edge case (industry standard).

---

## EC-23: Inngest route — 8 new functions without existence check
**Status: ✅ Verified**

**Evidence:**
- route.ts imports 20 named exports from `@/forest/inngest/functions/index`.
- barrel index.ts lines 1-68: all 20 function names re-exported from their respective module files.
- Verified: `videoGenerate`, `batchVideoFanout`, `repurposeAnalyze`, `repurposeClipGenerate`, `analyticsSync`, `tokenRefreshCron`, `thumbnailAbSelector`, `sopExecute` are all exported.
- Import failure is fail-fast at module load — entire Inngest endpoint crashes rather than silently missing a function.

**Impact:** None. Build catches any missing export. Production failure mode is total endpoint down, which is observable.

---

## EC-24: one-time-fulfillment TOCTOU — relies on migration 0148 UNIQUE constraint
**Status: ✅ Handled**

**Evidence:**
- `migrations/0148_videos_purchase_id_unique.sql`: `CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_purchase_id_unique ON videos(purchase_id) WHERE purchase_id IS NOT NULL;`
- Partial index correctly handles nullable purchase_id (multiple NULLs allowed).
- File header + one-time-fulfillment.ts comment (lines 47-51) acknowledge the TOCTOU explicitly and document the DB-level guard as authoritative.
- DB-level UNIQUE constraint is the actual protection; app-level SELECT-then-INSERT is a fast-path optimization only.

**Impact:** None. DB constraint is the source of truth for idempotency.

---

## EC-25: video-status-sync — `db!` non-null assertion inside processRow
**Status: ✅ Handled**

**Evidence:**
- Lines 119-126: `let db: D1Database | null = null;` then `db = await getD1Raw();`. If getD1Raw throws, returns early with 500 at line 125.
- If getD1Raw succeeds, `db` is non-null for the rest of the function. `processRow` closure only executes after successful init.
- `db!` used in lines 156, 159, 214, 219 — all inside processRow, all safe given the early return guard.
- `Promise.allSettled` (line 303) catches per-row rejections — even if a processRow fails, the db reference remains valid.

**Impact:** None. Non-null assertion is correct.

---

## Summary

| ID | Status | Severity | Action |
|----|--------|----------|--------|
| EC-18 | ❌ Unhandled | Medium-High | Move INSERT into batch with UPDATE |
| EC-19 | ⚠️ Partial | Low | Move credits-repo to canonical layer |
| EC-20 | ⚠️ Partial | Low | Add db_error test case |
| EC-21 | ✅ Handled | — | None |
| EC-22 | ⚠️ Partial | Low | Accept or add idempotency key |
| EC-23 | ✅ Verified | — | None |
| EC-24 | ✅ Handled | — | None |
| EC-25 | ✅ Handled | — | None |

**Unresolved questions:**
1. EC-18: Is `transactions` table schema guaranteed to not fail on INSERT (FK constraints, triggers) under normal operation? If yes, real-world failure rate is negligible; but the code path isn't defensible.
2. EC-22: Is double-increment of quota counter observable and recoverable (e.g., monthly rollover resets), or does it permanently inflate usage?