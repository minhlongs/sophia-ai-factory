# Payment & Billing Edge Case Verification Report — Sophia AI Factory

Ngay: 2026-05-31 | Scope: NOWPayments IPN webhook + billing pipeline (8 files)

---

## Kết Quả Tổng Quan

| # | Edge Case | Kết Quả | Mức Độ |
|---|-----------|---------|--------|
| 1 | IPN idempotency race | ⚠️ Partial | Medium |
| 2 | Underpayment guard | ✅ Handled | — |
| 3 | order_id undefined → early return | ✅ Handled | — |
| 4 | D1 batch() fallback re-check | ✅ Handled | — |
| 5 | Tier case sensitivity | ❌ Unhandled | High |
| 6 | No-org user + rapid double-pay | ⚠️ Partial | High |
| 7 | price_amount JS precision | ❌ Unhandled | Medium |
| 8 | Replay attack prevention | ❌ Unhandled | High |

---

## 1. IPN Idempotency Race — ⚠️ Partial

**Vị trí:** `nowpayments-ipn-handlers.ts:36-63`

**Logic:** `eventId = nowpayments_{paymentId}_{paymentStatus}` → INSERT with UNIQUE constraint → on violation, SELECT to check `processed` flag.

**Race condition:**
- Request A inserts event (processed=0), starts processing
- Request B arrives simultaneously → UNIQUE violation → SELECT finds `processed=0` → returns `{ success: false, message: 'Already processing' }`
- Route handler (`route.ts:69`) treats this as 500 error → NOWPayments will retry

**Bug:** Second request gets rejected with 500 while first is still processing. NOWPayments retries could cause:
- Route returns 500 → NOWPayments retries → legitimate event eventually succeeds on retry 3 (after A finishes). So functionally OK but wastes retries.
- Worst case: if A crashes before marking processed, B returns "Already processing" and NOWPayments gives up.

**Đề xuất:** Return 200 + `{ success: true, message: 'Already processing' }` instead of 500 for in-flight events. Add a max-wait + retry mechanism, or use DB-level advisory lock.

---

## 2. Underpayment Guard — ✅ Handled

**Vị trí:** `nowpayments-ipn-subscription.ts:27-38`, `nowpayments-ipn-one-time.ts:51-65`, `nowpayments-ipn-underpaid.ts`

**Coverage:**
- `actually_paid < price_amount * 0.99` → reject (subscription: silent return; one-time: mark as 'underpaid' via `markUnderpaid`)
- `actually_paid === 0` → `0 < required` → reject ✅
- `actually_paid === null/undefined` → skip guard (payments with no `actually_paid` yet are not rejected) — intentional for `finished` events where paid amount confirmed later
- Negative values: `< required` → reject ✅

**Ghi chú:** One-time path correctly records underpaid purchase (status='underpaid', 0 credits) for manual review. Subscription path silently returns without marking — no audit trail for subscription underpayments.

---

## 3. order_id undefined → Empty userId → Early Return — ✅ Handled

**Vị trí:** `nowpayments-ipn-db.ts:14-18`, `nowpayments-ipn-subscription.ts:47-48`

```ts
export function parseUserIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split('_')
  if (parts.length >= 3 && parts[0] === 'sophia') return parts[1]
  return null  // <-- null, not empty string
}
```

- Empty `order_id` → `''.split('_')` = `['']` → length 1 < 3 → returns `null`
- Handler: `if (!userId) { logger.warn(...); return }` — early return, no side effects ✅

**Edge case safe:** No org is created, no subscription modified, no credits issued.

---

## 4. D1 batch() Fallback Re-check — ✅ Handled

**Vị trí:** `nowpayments-ipn-subscription.ts:76-116`

**Flow:**
1. Before batch: `SELECT id FROM subscriptions WHERE org_id=?` → determines INSERT vs UPDATE
2. If `batch()` fails → catch block re-queries `existingSub2` → decides INSERT vs UPDATE again

**No race condition here** because:
- Both `existingSub` and `existingSub2` are read from the same D1 instance (serial reads)
- The fallback runs in the same request handler — no parallel requests involved
- Even if a second request created a subscription between batch-fail and fallback-select, the `org_id` INSERT would fail with UNIQUE constraint → caught by `catch` at line 103 outer level

**Caveat:** No explicit UNIQUE constraint on `org_id` in `subscriptions` table was verified. If absent, double-subscription per org is possible on concurrent fallback paths.

---

## 5. Tier Case Sensitivity — ❌ Unhandled (HIGH)

**Vị trí:** `nowpayments-ipn-subscription.ts:83,90,110,119` writes `tier.toLowerCase()` to DB. Multiple readers check exact case.

**Writers (all lowercase):**
- `plan: tier.toLowerCase()` — organizations.plan
- `plan: tier.toLowerCase()` — subscriptions.plan

**Readers — INCONSISTENT:**

| File | Line | Check | Issue |
|------|------|-------|-------|
| `checkout-validators.ts` | 14,22 | `tier === 'MASTER'` | ✅ expects uppercase — but DB has lowercase |
| `forest/raas-service-key-operations.ts` | 63 | `tier === 'master'` | ✅ matches stored lowercase |
| `auto-handover.ts` | 155 | `tier === 'MASTER'` | ❌ never matches — DB stores 'master' |
| `require-master-tier.ts` | 7 | `tier === 'MASTER'` | ❌ same mismatch |
| `app/api/v1/advisor/revenue/route.ts` | 63 | `tier === 'MASTER'` | ❌ same mismatch |
| `app/api/admin/licenses/[id]/extend/route.ts` | 67 | `existingLicense.tier === 'MASTER'` | ❌ same mismatch |
| `enriched-jwt-entitlements.ts` | 49 | `tier.toUpperCase() === 'MASTER'` | ✅ defensive |
| `middleware.ts` | 179 | `raw === 'MASTER' \|\| raw === 'master'` | ✅ handles both |
| `lib/analytics/rbac.ts` | 46,106,190,199 | `tier === 'MASTER'`, `tier === 'PREMIUM'` | ❌ multiple mismatches |

**Impact:** MASTER tier admin gating silently fails for subscriptions activated via IPN. Users pay for MASTER but cannot access `/dashboard/admin`. Also affects `ENTERPRISE` and `PREMIUM` checks in rbac.ts.

**Đề xuất:** Standardize on uppercase in DB (remove `.toLowerCase()` in writers) — all `UNIFIED_TIERS` keys are uppercase. Or normalize all readers with `.toUpperCase()`.

---

## 6. No-Org User Creates New Org + Rapid Double-Payment — ⚠️ Partial

**Vị trí:** `nowpayments-ipn-subscription.ts:117-127`

```ts
} else {
  // No org membership found
  const { data: newOrg } = await db.from('organizations')
    .insert({ name: `User ${userId}`, plan: tier.toLowerCase() })
    .select('id').single()
  await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' })
  await db.from('subscriptions').insert({ org_id: newOrg.id, ... })
}
```

**Double-payment race:**
- IPN A and IPN B for different payments → both check `org_members` → both find none → both create org
- Result: 2 orgs, 2 `org_members` rows for same user, 2 subscriptions

**dispatchFinished has a dedup guard** (lines 52-87) that checks `pending_orders` for same `(userId, tier)` within 24h. This catches duplicate *subscription* payments but NOT:
- One-time purchases (different tier lookup kind)
- Cross-tier rapid payments (BASIC then MASTER within seconds)

**Đề xuất:** Add UNIQUE constraint on `org_members.user_id` or use `INSERT OR IGNORE`. The `organizations` table has no UNIQUE on the slug/name (name is `User {userId}` — could collide if same user hits path twice).

---

## 7. price_amount JS Number Precision — ❌ Unhandled (Medium)

**Vị trí:** `nowpayments-ipn-subscription.ts:29,83`, `nowpayments-ipn-one-time.ts:68`

```ts
const actuallyPaid = ipn.actually_paid  // JS number from JSON parse
const required = ipn.price_amount * UNDERPAYMENT_THRESHOLD  // price_amount * 0.99
const amountCents = Math.round(ipn.price_amount * 100)  // one-time: USD to cents
```

**Problem:**
- `4999.99 * 0.99` = `4949.9901` in JS (float rounding)
- `4999.99 * 100` = `499999` — but `4999.00 * 100` = `499900` vs expected `499900` ✅
- IEEE 754: crypto payments with many decimal places (e.g., USDT with 6 decimals) truncated to JS number precision (~15-17 digits)

**Risk:** For NOWPayments current tier prices (199-4999), precision loss is negligible. But for future high-value or crypto-denominated tiers, floating-point comparison could:
- Accept an underpayment that should be rejected (floating point makes `actually_paid` appear >= `required`)
- Store wrong cent amounts for large values

**Đề xuất:** Use `Decimal` or integer math (store prices as cents, compare as integers) for `actually_paid` vs threshold check. NOWPayments returns crypto amounts with up to 8-10 decimals — JS `number` loses precision beyond that.

---

## 8. No Replay Attack Prevention on IPN Signature — ❌ Unhandled (HIGH)

**Vị trí:** `nowpayments-client.ts:98-107` → `verifyInboundWebhook`

```ts
export async function verifyIpnSignature(rawBody, signature, secret) {
  return verifyInboundWebhook(rawBody, signature, secret, {
    algo: 'SHA-512',
    canonicalize: nowPaymentsCanonicalize,
  })
}
```

**Reading `verifyInboundWebhook`** (`lib/webhooks/signature.ts:165-176`):
```ts
export async function verifyInboundWebhook(rawBody, signature, secret, opts) {
  const message = opts.canonicalize ? opts.canonicalize(rawBody) : rawBody
  const computed = await computeHmacHex(message, secret, opts.algo)
  return timingSafeEqual(computed, signature.toLowerCase())
}
```

**Finding:** Only HMAC-SHA512 verification. No:
- Timestamp check (no `t=` header parsing)
- Nonce check
- Event age validation
- Replay window

**Contrast:** The project's own webhook system (`verifyWebhook`, same file) HAS timestamp replay protection (300s tolerance, `t=<unix>,v1=<hex>` format). But NOWPayments IPN uses a different signature format (raw hex, NOT `t=,v1=`), so `verifyInboundWebhook` is called instead — which skips the timestamp check entirely.

**Attack scenario:**
1. Attacker captures a valid IPN POST (HMAC signature + body)
2. Replays it 1 hour later — HMAC still valid, body unchanged
3. Server processes duplicate as new payment → double activation

**Mitigation exists partially:** The `payment_events` UNIQUE constraint on `event_id` (which includes `payment_status`) means replaying the *same* event_id is caught. But if attacker replays with a *different* `payment_status` (e.g., changes `waiting` → `finished` in replayed body), the HMAC breaks. So practical risk is LOW for full-body replays.

**Gap:** No check that the IPN timestamp (`created_at` in NOWPayments payload) is recent. If NOWPayments sends `created_at` in the payload, it should be validated.

**Đề xuất:** Add a `created_at` timestamp check on the IPN payload — reject events older than 15 minutes. Or implement nonce tracking.

---

## Tổng Kết

### Critical/High Issues

1. **#5 Tier case sensitivity** — MASTER tier users silently locked out of admin. Multiple production routes affected. **Fix:** Remove `.toLowerCase()` in IPN writers, use uppercase consistently.
2. **#6 Duplicate org on rapid double-pay** — No UNIQUE constraint on `org_members.user_id`. Two simultaneous IPNs = 2 orgs for 1 user. **Fix:** Add UNIQUE constraint or `INSERT OR IGNORE`.
3. **#8 No replay timestamp check** — `verifyInboundWebhook` skips timestamp validation. HMAC-only protection. **Fix:** Add `created_at` age check in IPN handler (reject > 15 min old).

### Medium Issues

4. **#1 Idempotency race returns 500** — In-flight events cause 500 → unnecessary NOWPayments retries. **Fix:** Return 200 for in-flight events.
5. **#7 JS number precision** — `price_amount * 0.99` float rounding. Negligible for current prices but fragile. **Fix:** Use integer cents for threshold comparison.

### Design Observations (Positive)
- D1 batch with fallback is well-structured (re-checks existingSub)
- Underpayment guard covers 0, null, negative values correctly
- `order_id` undefined → clean early return with logging, no side effects
- `payment_events` UNIQUE constraint is the right idempotency primitive
- Middleware admin gate handles both `'MASTER'` and `'master'` (only place that does)

---

## Unresolved Questions
- Does `organizations` table have a UNIQUE constraint on any column? Could `name: 'User {userId}'` collide if userId is the same?
- Does `subscriptions` table have UNIQUE on `org_id`? Without it, the batch-fallback path can double-insert.
- Does NOWPayments IPN payload include a `created_at` field that could be used for replay timestamp checking?
- `forest/raas-service-key-operations.ts:63` uses `tier === 'master'` (lowercase) — is this intentional or a bug relative to the writer's `toLowerCase()` output?
