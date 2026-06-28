# Phase 13 Code Review — Revenue Split + Payouts

**Date:** 2026-04-30
**Branch:** feat/sophia-integration-260429
**Reviewer:** code-reviewer
**Score:** **7.5 / 10** — **NEEDS-FIX** (need ≥9.5 to merge)

---

## Verdict: NEEDS-FIX

Tester report green, but financial-correctness review surfaces 3 Critical and 4 High findings. **DO NOT MERGE** until C1–C3 + H1 fixed. VN PIT 5% withholding (plan deliverable) is **entirely missing**.

---

## Critical (must-fix before merge)

### C1 — Float arithmetic on USD money (REAL columns)
**Files:** migration `0038-revenue-split.sql:10-12,27`, `commission-calculator.ts:27-28,68`, all aggregations.
**Problem:** All amounts stored as SQLite `REAL` (IEEE-754 double). `SUM(commission_usd)` over thousands of rows accumulates rounding error → reconciliation alerts will fire spuriously and real $ drift goes undetected. `Math.round(x*10000)/10000` is float→float, NOT integer cents.
**Fix:** Store as `INTEGER` cents (or 1e6 micro-USD for crypto fee precision). Calculator returns `bigint`/`number` integer cents. Aggregations remain exact. Add migration `0039-money-as-cents.sql` to convert.

### C2 — Clawback CANNOT reverse paid commissions, contradicting 14d window spec
**File:** `clawback-handler.ts:44-46`
**Problem:** Plan says "reverse commission within 14d on refund." But `payable_at = attributed_at + 14d` and payout cron flips `pending→payable` at day 14, then the **next** Sunday batches it. So a refund on day 13 (within window) lands on a row that's *still pending* — fine. A refund on day 15–20 hits rows that may already be `paid` (Sunday after day 14). Code rejects with `Cannot clawback already-paid commission` — meaning the spec'd 14d window only works coincidentally. Worse: there is no negative-adjustment flow / debt ledger, so clawbacks of paid commissions are silently dropped.
**Fix:** (a) Either move payout cron to T+15d (1d safety after maturity), OR (b) implement negative-balance ledger row (`status='clawback'`, `commission_usd = -X`) that offsets next batch. Add admin override path.

### C3 — Race: two concurrent batchers can double-pay the same payable rows
**File:** `payout-batcher.ts:68-112`
**Problem:** Sequence is: read `getPayableLedgerIds` → `INSERT OR IGNORE batch` → `queueBatch` (NOWPayments POST) → `markLedgerPaid`. There is no row-level claim on commission_ledger. If Inngest retries the step after `queueBatch` succeeds but before `markLedgerPaid`, OR if a manual run overlaps the cron, the same `payable` rows get queued twice — NOWPayments sees a different `batchId`, sends a second withdrawal. D1 has no `SELECT FOR UPDATE`. The `INSERT OR IGNORE payout_batches` does NOT protect because `batchId` includes `Date.now()` (different on retry).
**Fix:** Atomically claim rows first: `UPDATE commission_ledger SET status='paying', payout_batch_id=? WHERE id IN (...) AND status='payable'`. Only proceed to NOWPayments if `meta.changes == ledgerIds.length`. On NOWPayments error, revert to `payable`. Also use deterministic `batchId = sha256(tenantId|affiliateId|weekIso)` so Inngest replay hits the IGNORE.

---

## High

### H1 — VN PIT 5% withholding NOT IMPLEMENTED (plan deliverable)
**File:** none. Plan line 12: "Tax: VN PIT 5% withholding option per tenant flag." Schema has no `pit_withhold` column on `payout_methods`/users, calculator has no withholding step, no withholding ledger. **This is a documented deliverable that's missing.**
**Fix:** Add `users.vn_pit_enabled INTEGER DEFAULT 0`. In `payout-batcher.ts` after aggregate: `netUsd = totalUsd * (vn_pit_enabled ? 0.95 : 1.0)`. Persist `withheld_usd` on `payout_batches`. Send `netUsd` to NOWPayments.

### H2 — Banned import via transitive `@/lib/clients/nowpayments-client`
**File:** `nowpayments-payout/route.ts:12`
**Problem:** Sophia CLAUDE.md states `lib/clients/` was DELETED post-consolidation. If `@/lib/clients/nowpayments-client` is a dangling shim it's a banned-import violation. Verify path resolves.
**Fix:** Move `verifyIpnSignature` into `@/lib/payments/nowpayments` (canonical) and import from there.

### H3 — Encrypted recipient address logged on NOWPayments error
**File:** `nowpayments-mass-payout.ts:62-63`
**Problem:** `errText = await resp.text()` — NOWPayments error responses can echo the request body, including `address` (decrypted plaintext). Throwing `new Error(errText)` then `logger.error(err)` upstream → plaintext USDT addr in logs.
**Fix:** Truncate/sanitize: `const safe = errText.slice(0, 200).replace(/T[A-Za-z0-9]{33}|0x[a-fA-F0-9]{40}/g, '[ADDR]')`.

### H4 — `AND status != 'confirmed'` IPN update is not idempotent under retries
**File:** `nowpayments-payout/route.ts:70-77`
**Problem:** If IPN arrives twice (NOWPayments retries), second call updates `external_payment_id` again with the same value → benign. BUT `finalized_at` gets overwritten with later timestamp, breaking audit trail. Also no check that the second IPN's `withdrawal_id` matches the first (could be a spoofed retry from a different batch — though signature verified, mistakes happen).
**Fix:** `WHERE id = ? AND (status != 'confirmed' OR external_payment_id != ?)`; preserve original `finalized_at`.

---

## Medium

### M1 — `MIN_PAYOUT_USD = 10` duplicated in two places
`commission-ledger.ts:107` (`HAVING SUM >= 10` hardcoded) + `payout-batcher.ts:16`. Fix: import the const into the SQL builder or pass as bind param.

### M2 — `payable_at` based on `attributed_at`, not `created_at`
`conversion-to-ledger.ts:82` — if Inngest delivers event 5 days late, payout window shrinks. Acceptable but document; or use `max(attributed_at, ledger_created_at)`.

### M3 — `tier_multiplier` drift: aliases `free|pro|enterprise` (lowercase) coexist with uppercase tier enum
`commission-calculator.ts:34-43` — Sophia rule says tiers are uppercase only. Lowercase aliases are dead code — remove or document. Otherwise a future bug where `tenantTier='free'` slips past `BASIC` mapping.

### M4 — Clawback updates without `tenant_id` filter
`clawback-handler.ts:51-54` — relies on global UNIQUE(conversion_event_id). Defensible but cross-tenant collision (or future reuse of conversion ids) → mass update. Add `AND tenant_id = ?`.

### M5 — `getPayableAggregates` SUM for HAVING, then re-fetch IDs (TOCTOU)
`commission-ledger.ts:95` + `payout-batcher.ts:68` — between the two queries, new rows may flip to payable, OR clawback may reduce. Aggregate sum used for batch.total_usd will then drift from sum(ledger.commission_usd). C3 fix solves this.

---

## Low

### L1 — Magic `0.3` default commission_pct fallback
`conversion-to-ledger.ts:77`. Move to `@/config/revenue-share`.

### L2 — `sleep(200)` between API calls inside Inngest step
`nowpayments-mass-payout.ts:115,127` — Inngest steps are serialized and retried; the sleep runs inside the step function. Acceptable for now; ideally use Inngest `step.sleep`.

### L3 — `commission-ledger.ts` 211 lines
Just over the project's 200-line guidance. Split queries vs mutations.

### L4 — `validateErc20Address` skips EIP-55 checksum
`usdt-addr-validator.ts:73` — comment acknowledges, but a typo'd 0x... will silently pass to NOWPayments. Either implement EIP-55 (small) or add a UI confirmation step. Plan mitigation (0.01 pilot) is fine if actually wired — verify pilot flow exists.

### L5 — `NEXT_PUBLIC_APP_URL ?? ''` produces invalid callback URL silently
`nowpayments-mass-payout.ts:118` — empty base + `/api/webhooks/...` = relative URL → NOWPayments rejects. Fail loudly: `if (!base) throw new Error('NEXT_PUBLIC_APP_URL not set')`.

---

## Positive Observations

- Idempotency on `INSERT OR IGNORE` + `UNIQUE(conversion_event_id)` — correct.
- HMAC-SHA512 IPN signature verified before parsing — ✅ no parse-then-verify.
- Reconciliation cron with diff threshold + Inngest event for alerting — solid pattern.
- Clawback explicitly refuses paid rows (defensive default, even though spec asks for more).
- TRC20 Base58Check + double-SHA256 checksum implementation is correct.
- No banned imports in `lib/payouts/*` (verified via grep). Tier enum uppercase respected in main path.
- Mock mode for missing `NOWPAYMENTS_API_KEY` — good for dev/test.

---

## Required Fixes for Round 2 (must hit ≥9.5)

1. **C1** — Migrate `commission_usd / gross_amount_usd / total_usd` to INTEGER cents; rewrite calculator + aggregations.
2. **C2** — Implement clawback for paid rows: negative-adjustment ledger row OR shift cron to T+15d.
3. **C3** — Atomic `UPDATE … SET status='paying' WHERE status='payable'` claim before NOWPayments call; deterministic `batchId`.
4. **H1** — Add `users.vn_pit_enabled` flag + 5% withholding in batcher + persist `withheld_usd`.
5. **H2** — Verify/move `nowpayments-client` import path.
6. **H3** — Sanitize NOWPayments error text before logging.
7. **H4** — IPN update preserves first `finalized_at`.

Medium and Low can ship in a follow-up but **C1–C3 + H1** block merge.

---

## Metrics

- Files reviewed: 8 (708 lines)
- Tests: 24/24 pass (per tester report) — **but no test exercises the C3 race or C2 clawback-paid path**
- Build: ✅ green
- Type safety: ✅ 0 `any`
- Banned imports: ✅ clean (pending H2 verify)
- Tier enum: ✅ uppercase honored

---

## Unresolved Questions

1. Is `@/lib/clients/nowpayments-client` a live module or a dangling shim? Verify before merge.
2. The plan says "tenant_cut, platform_cut" columns but schema only has `commission_usd`. Is the 70/30 split tracked elsewhere or was it consolidated? Confirm with planner.
3. Does the 0.01 USDT pilot transfer flow (mentioned in `usdt-addr-validator.ts:71`) actually exist? Not in the 8 files reviewed.
4. Is `payout_methods.verified` enforced anywhere? Batcher doesn't check it.
