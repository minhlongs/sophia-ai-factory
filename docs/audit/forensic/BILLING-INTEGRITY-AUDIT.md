# FORENSIC AUDIT: BILLING & PAYMENT INTEGRITY

**Target Platform:** Sophia AI Factory (apps/sophia-ai-factory)  
**Date:** 2026-09-10  
**Status:** COMPLETED  
**Auditor:** Senior SRE / Infrastructure Security Forensic Specialist (Lane D)  
**Evidence Level:** Forensic Source Code Analysis & Trace Proof (Zero Assumptions)

---

## 1. Executive Summary

A comprehensive forensic audit of the billing engine (`src/land/billing/`, `src/land/billing/actions/`, `src/tree/clients/nowpayments-client.ts`, `src/app/api/webhooks/nowpayments/route.ts`, and `src/app/api/webhooks/payos/route.ts`) reveals critical architectural and security vulnerabilities:

1. **CRITICAL VULNERABILITY (P0 — Free Tier Upgrade Loophole):**  
   The self-service server action `changeTierAction` (`src/land/billing/actions/change-tier-action.ts:280-305`) and `tier-change-provisioner.ts:168-185` provision immediate tier upgrades (e.g., upgrading to ENTERPRISE) directly in Cloudflare D1 without redirecting to a payment gateway, without collecting payment, and without awaiting a webhook confirmation. Any authenticated user can execute `changeTierAction({ targetTier: 'ENTERPRISE', timing: 'immediate' })` and obtain a 30-day active enterprise subscription for $0.
2. **HIGH DEFECT (P1 — Dynamic Checkout Invoice Lookup Failure):**  
   The checkout flow transitioned to `createCheckout()` (generating dynamic invoices via NOWPayments SDK), but the IPN webhook fulfillment handler `nowpayments-ipn-finished.ts:77-84` strictly relies on `getTierByInvoiceId(invoiceId)`, which only indexes the 4 legacy hardcoded static invoice IDs in `NOWPAYMENTS_TIERS`. Dynamic payments will succeed on NOWPayments, but the webhook cannot resolve the tier and will silently log `unknown invoice_id`, failing to activate legitimate customer purchases.
3. **HIGH DEFECT (P1 — Cloudflare Worker Env Desynchronization in SDK):**  
   `createNowPaymentsSDK()` in `src/tree/clients/nowpayments-client.ts:35-44` resolves `apiKey` using `resolveApiKey()` (checking `globalThis.__env`), but passes `process.env.NOWPAYMENTS_IPN_SECRET || undefined`. In Cloudflare Workers edge runtime where bindings are stored on `globalThis.__env`, `process.env.NOWPAYMENTS_IPN_SECRET` is undefined, causing webhook HMAC verification in the SDK to fail or operate unkeyed.
4. **MODERATE DEFECT (P2 — Synthetic/Fictitious MRR Reporting):**  
   `src/app/api/admin/billing/summary/billing-summary-query.ts:73-90` computes platform Monthly Recurring Revenue (MRR) by taking the count of dunning customers and distributing them evenly in a modulo loop across `[BASIC, PREMIUM, ENTERPRISE, MASTER]`. This reports fabricated financial figures on executive dashboards.
5. **POSITIVE SECURITY CONTROLS (Verified Green):**  
   - Webhook HMAC signatures are cryptographically enforced (HMAC-SHA512 for NOWPayments, HMAC-SHA256 for PayOS).
   - Replay attacks are strictly prevented via atomic `INSERT INTO payment_events (event_id, ...) VALUES (...) ON CONFLICT(event_id) DO NOTHING` with stale-lock recovery (`processed = 2`).
   - Underpayment tampering is rejected via strict percentage tolerance checks (within 1% in NOWPayments, >= 99% in PayOS).

---

## 2. Forensic Pricing Truth Analysis

### 2.1 Canonical Pricing Truth vs Fragmented Duplication

| Location | Currency | BASIC | PREMIUM | ENTERPRISE | MASTER | Purpose / Status |
|---|---|---|---|---|---|---|
| `seed/config/tiers/unified-limits.ts:14-48` | USD | $199 | $399 | $799 | $4,999 | **CANONICAL TRUTH** (`UNIFIED_TIERS`) |
| `tree/clients/nowpayments-client.ts:55-60` | USD | $199 | $399 | $799 | $4,999 | Sourced from `UNIFIED_TIERS` (Clean) |
| `tree/clients/nowpayments-client.ts:252-288` | USD | $199 | $399 | $799 | $4,999 | **DUPLICATE STATIC CONFIG** (`NOWPAYMENTS_TIERS`) with static invoice IDs |
| `admin/billing/summary/billing-summary-query.ts:62-67` | Cents | 19,900 | 39,900 | 79,900 | 499,900 | Sourced from `UNIFIED_TIERS.*.priceInCents` (Clean) |
| `admin/billing/summary/billing-summary-query.ts:96-101` | USD | $0.10 | $0.05 | $0.03 | $0.02 | **HARDCODED OVERAGE PRICING** |
| `seed/config/tiers/overage-pricing.ts:15` | USD | $0.10 | $0.05 | $0.03 | $0.02 | Canonical overage pricing source (Duplication in billing query) |

### 2.2 Forensic Finding: Hardcoded Legacy Static Invoices

In `src/tree/clients/nowpayments-client.ts`:
```typescript
export const NOWPAYMENTS_TIERS: Record<string, NowPaymentsTierConfig> = {
  BASIC: {
    tier: 'BASIC',
    invoiceId: '5710519960',
    yearlyInvoiceId: '5710519960',
    price: 199,
    yearlyPrice: 1990,
    currency: 'USD',
    name: 'Starter',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    invoiceId: '4559269964',
    yearlyInvoiceId: '4559269964',
    price: 399,
    yearlyPrice: 3990,
    currency: 'USD',
    name: 'Growth',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    invoiceId: '6336799275',
    yearlyInvoiceId: '6336799275',
    price: 799,
    yearlyPrice: 7990,
    currency: 'USD',
    name: 'Premium',
  },
  MASTER: {
    tier: 'MASTER',
    invoiceId: '5589879034',
    yearlyInvoiceId: '5589879034',
    price: 4999,
    yearlyPrice: 0,
    currency: 'USD',
    name: 'Master',
  },
}
```
**Impact:** While prices match `UNIFIED_TIERS`, having hardcoded invoice IDs permanently ties production to specific static NOWPayments invoices. More critically, dynamic checkouts cannot be resolved against this map.

---

## 3. Webhook Cryptographic Verification & Replay Protection

### 3.1 NOWPayments IPN Webhook (`/api/webhooks/nowpayments`)

#### Signature Verification:
In `src/app/api/webhooks/nowpayments/route.ts:137-147`:
```typescript
const signature = req.headers.get('x-nowpayments-sig')
if (!signature) {
  logger.warn('[NOWPayments Webhook] Missing x-nowpayments-sig header')
  return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
}

let sdkResult: ReturnType<typeof parseIpnWebhook>
try {
  sdkResult = parseIpnWebhook(rawPayload, signature)
} catch (err) {
  logger.warn('[NOWPayments Webhook] SDK verification failed', { error: String(err) })
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
}
```

In `src/tree/clients/nowpayments-client.ts:220-230`:
```typescript
export function parseIpnWebhook(
  payload: Record<string, unknown>,
  signature: string,
): IpnPayloadResult {
  const sdk = createNowPaymentsSDK()
  const event = sdk.parseWebhook(payload, signature, { verify: true })
  if (event.type !== 'payment.status_changed') {
    throw new Error(`Unexpected webhook event type: ${event.type}`)
  }
  return sdkEventToInternalPayload(event, payload)
}
```

**SDK Factory Defect in Workers Environment:**
In `src/tree/clients/nowpayments-client.ts:35-44`:
```typescript
export function createNowPaymentsSDK(): NowPaymentsSDK {
  if (sdkInstance) return sdkInstance
  const apiKey = resolveApiKey()
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY is required for SDK operations')
  sdkInstance = new NowPaymentsSDK({
    apiKey,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || undefined, // <-- DEFECT: does not check globalThis.__env
  })
  return sdkInstance
}
```
`resolveApiKey()` properly inspects `(globalThis.__env ?? process.env)`, but `ipnSecret` only reads `process.env.NOWPAYMENTS_IPN_SECRET`. In Cloudflare Workers where env vars are injected on `globalThis.__env`, `process.env.NOWPAYMENTS_IPN_SECRET` will be empty, causing `sdk.parseWebhook` to fail or skip verification.

#### Replay Protection & Distributed Locking:
In `src/land/billing/nowpayments-ipn-lock.ts:51-87`:
```typescript
export async function acquireIpnLock(
  db: D1Database,
  eventId: string,
  paymentId: string,
  status: string,
): Promise<IpnLockResult> {
  const now = new Date().toISOString()

  // 1. Atomic INSERT — D1 has no transactions, so ON CONFLICT DO NOTHING is our atomic gate
  const insertResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, provider, payment_id, status, processed, created_at, updated_at)
       VALUES (?1, 'nowpayments', ?2, ?3, 0, ?4, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, paymentId, status, now)
    .run()

  const inserted = (insertResult.meta?.changes ?? 0) > 0

  if (inserted) {
    return { status: 'acquired' }
  }

  // 2. Conflict occurred — check existing row state
  const row = await db
    .prepare(
      `SELECT processed, updated_at FROM payment_events WHERE event_id = ?1 LIMIT 1`,
    )
    .bind(eventId)
    .first<{ processed: number; updated_at: string }>()

  if (!row || row.processed === 1) {
    return { status: 'duplicate' }
  }

  // 3. Stale lock recovery (5 minutes)
  const updatedAt = new Date(row.updated_at).getTime()
  const staleThreshold = Date.now() - 5 * 60 * 1000
  if (updatedAt < staleThreshold && row.processed === 0) {
    await db
      .prepare(
        `UPDATE payment_events SET processed = 2, updated_at = ?2 WHERE event_id = ?1`,
      )
      .bind(eventId, now)
      .run()
    return { status: 'stale_recovered' }
  }

  return { status: 'duplicate' }
}
```
**Verdict:** **STRONG PASS.** Replay attacks are impossible. Re-sent webhooks for identical `eventId` (`nowpayments_{paymentId}_{status}`) result in `changes === 0`, detect `processed === 1`, and return 200 OK immediately without re-executing business logic.

---

### 3.2 Dynamic Invoice Lookup Breakdown

In `src/land/billing/nowpayments-ipn-finished.ts:73-84`:
```typescript
const invoiceId = ipn.invoice_id
if (!invoiceId) {
  logger.warn('[NOWPayments] finished: missing invoice_id', { paymentId: ipn.payment_id })
  return null
}
const tierConfig = getTierByInvoiceId(invoiceId)
if (!tierConfig) {
  logger.warn('[NOWPayments] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
  return null
}
return parseUserIdFromOrderId(ipn.order_id || '') || null
```
And in `src/tree/clients/nowpayments-client.ts:376-380`:
```typescript
export function getTierByInvoiceId(invoiceId: string): NowPaymentsTierConfig | null {
  return (
    Object.values(NOWPAYMENTS_TIERS).find(t => t.invoiceId === invoiceId || t.yearlyInvoiceId === invoiceId) ?? null
  )
}
```
**Evidence of Failure:**
1. Checkout generation calls `sdk.createCheckout()` (`nowpayments-client.ts:97`), creating an API-generated dynamic invoice with an ID assigned by NOWPayments (e.g., `10839218`).
2. NOWPayments sends an IPN with `invoice_id: "10839218"`.
3. `nowpayments-ipn-finished.ts` calls `getTierByInvoiceId("10839218")`.
4. `NOWPAYMENTS_TIERS` only contains `5710519960`, `4559269964`, `6336799275`, `5589879034`.
5. `tierConfig` evaluates to `null`.
6. Function returns `null` and logs `unknown invoice_id`.
7. `nowpayments-ipn-dispatch.ts` logs failure and marks event processed without upgrading user.
**Impact:** Customers who pay via dynamic checkout do not receive their subscription.

---

## 4. User Identity & Spoofing Protection

### 4.1 Order ID Parsing & User Verification
In `nowpayments-ipn-finished.ts:24-34`:
```typescript
export function parseUserIdFromOrderId(orderId: string): string | null {
  if (!orderId || !orderId.startsWith('sophia_')) return null
  const parts = orderId.split('_')
  if (parts.length < 3) return null
  return parts.slice(1, -1).join('_') || null
}
```
- In NOWPayments, checkout encodes `sophia_${userId}_${timestamp}` into `order_id`.
- The webhook retrieves `userId` from `order_id`.
- **Can an attacker spoof this?** No, because to receive a valid IPN for an arbitrary `order_id`, the attacker would have to:
  1. Pay real crypto on NOWPayments for an invoice generated with another user's ID, OR
  2. Forge the HMAC-SHA512 webhook signature (which requires `NOWPAYMENTS_IPN_SECRET`).
- If an attacker pays real money specifying another user's ID, the victim gets upgraded on the attacker's dime (no privilege gain for attacker).

### 4.2 PayOS User & Order Verification
In `src/app/api/webhooks/payos/route.ts:133-149`:
```typescript
const { data: orderRow, error: orderError } = await db
  .from('pending_orders')
  .select('*')
  .eq('provider_payment_id', paymentLinkId)
  .eq('status', 'pending')
  .single()

if (orderError || !orderRow) {
  logger.warn(`[PayOS Webhook] Order not found for paymentLinkId: ${paymentLinkId}`)
  return NextResponse.json({ error: 'Order not found' }, { status: 400 })
}
```
**Verdict:** **EXCELLENT.** PayOS strictly looks up the pre-registered `pending_orders` table row in D1, completely eliminating user spoofing.

---

## 5. Free Tier Upgrade Vulnerability (P0)

### 5.1 The Defect in `change-tier-action.ts` & `tier-change-provisioner.ts`

In `src/land/billing/actions/change-tier-action.ts:279-305`:
```typescript
// Upgrade: immediate provisioning with new period start
const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
await d1.batch([
  d1.prepare(
    'UPDATE subscriptions SET plan = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0, updated_at = ? WHERE org_id = ?',
  ).bind(targetTier.toLowerCase(), now, newPeriodEnd, now, orgId),
  d1.prepare(
    `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(user.id, orgId, currentTier, targetTier, eventType),
  d1.prepare('UPDATE user_profiles SET settings = ?, updated_at = ? WHERE user_id = ?')
    .bind(JSON.stringify(settings), now, user.id),
]);

return {
  success: true,
  action: 'upgraded',
  effectiveDate: now,
  proratedAmount,
  nextBillingDate: newPeriodEnd,
};
```
And in `src/land/billing/tier-change-provisioner.ts:168-185`:
```typescript
export async function provisionTierChange(
  db: D1Database,
  input: TierChangeInput,
): Promise<TierChangeResult> {
  // ... calculates proration ...
  // Executes DB batch directly modifying subscriptions and user_profiles:
  await db.batch([
    db.prepare(`UPDATE subscriptions SET plan = ?1, ... WHERE org_id = ?5`).bind(...),
    db.prepare(`UPDATE user_profiles SET settings = ?1 WHERE user_id = ?3`).bind(...)
  ]);
  return { success: true, effectiveDate: now, ... };
}
```

### 5.2 Exploit Scenario
1. Attacker signs up for a free account (`BASIC` tier).
2. Attacker invokes the server action `changeTierAction({ targetTier: 'ENTERPRISE', timing: 'immediate' })`.
3. `changeTierAction` validates that the user is authenticated via `getCurrentUser()`.
4. It checks `targetTier !== currentTier`.
5. It calculates a prorated amount (e.g. `$600`).
6. **INSTEAD OF GENERATING A CHECKOUT URL OR CHARGING A CARD**, it proceeds directly to the D1 batch update:
   - Sets `subscriptions.plan = 'enterprise'`.
   - Extends `current_period_end` by 30 days.
   - Updates `user_profiles.settings` with `tier: 'ENTERPRISE'`.
7. Attacker is now an `ENTERPRISE` tier user with full high-volume quotas and privileges without paying a single dollar.

**Severity:** **P0 / CRITICAL.** Must be gated with payment verification before committing DB changes.

---

## 6. Fictitious MRR Calculation in Admin Summary

In `src/app/api/admin/billing/summary/billing-summary-query.ts:73-90`:
```typescript
/**
 * Calculate MRR from dunning settings.
 * Simplified: distributes customers evenly across tiers.
 */
export function calculateMRR(data: DunningCustomer[]): MRRResult {
  const breakdown: Record<string, number> = { BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 };

  const tiers = Object.keys(TIER_PRICING);
  let index = 0;
  for (let i = 0; i < data.length; i++) {
    const tier = tiers[index % tiers.length];
    breakdown[tier]++;
    index++;
  }

  const totalCents = Object.entries(breakdown).reduce(
    (sum, [tier, count]) => sum + count * TIER_PRICING[tier],
    0
  );

  return { totalCents, breakdown };
}
```
**Forensic Finding:**  
The MRR calculation does not inspect what plan customers are actually on. It iterates through customers and assigns `customer[0]` to BASIC, `customer[1]` to PREMIUM, `customer[2]` to ENTERPRISE, `customer[3]` to MASTER, `customer[4]` to BASIC, and so on.  
If there are 4 active customers, it reports MRR as $199 + $399 + $799 + $4,999 = **$6,396/month**, even if all 4 are on the $199 BASIC plan!

---

## 7. Forensic Action Plan & Remediation

| Issue | Severity | File | Action Required |
|---|---|---|---|
| Free Tier Upgrade via Server Action | P0 | `src/land/billing/actions/change-tier-action.ts` | Disallow immediate DB upgrade. Action must return a payment checkout redirect URL (`createCheckout`). Provisioning must ONLY occur inside verified IPN webhook. |
| Dynamic Invoice Resolution Failure | P1 | `src/land/billing/nowpayments-ipn-finished.ts` | Store dynamic checkout orders in `pending_orders` table (like PayOS) or decode tier directly from `order_description` / `order_id` metadata. |
| Cloudflare Workers Secret Resolution | P1 | `src/tree/clients/nowpayments-client.ts` | Update `createNowPaymentsSDK()` to read `NOWPAYMENTS_IPN_SECRET` from `globalThis.__env ?? process.env`. |
| Synthetic MRR Calculation | P2 | `src/app/api/admin/billing/summary/billing-summary-query.ts` | Query actual `subscriptions.plan` from D1 instead of synthetic modulo round-robin. |
| Overage Pricing Duplication | P3 | `src/app/api/admin/billing/summary/billing-summary-query.ts` | Import canonical `OVERAGE_PRICING` from `@/seed/config/tiers/overage-pricing`. |

---
**Lane D Forensic Audit Report Signed:** Senior SRE / Infrastructure Security Audit Team
