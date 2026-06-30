# Phase 06 — Track A1: Overage Billing Implementation

**Priority:** P1 | **Status:** pending | **Effort:** 8h | **Depends On:** Phase 05

## Overview

Implement the overage billing top-up flow. This converts every hard block from `quota-enforcer.ts` into a revenue opportunity. When a user hits their quota limit, instead of just seeing "402 Quota Exceeded", they see a prompt to buy more MCU credits via NOWPayments.

## Key Insights

- `quota-enforcer.ts` already returns structured 429 response with `quota_exceeded` code
- `overage-logger-ops.ts` already logs overage events with `billable` flag
- `markEventsAsBillable()` already exists — just needs to be called from the top-up IPN handler
- `video-production-cost-engine.ts` has per-operation cost modeling — use for credit pricing
- **Pattern:** Same atomic lock as IPN handler: INSERT ON CONFLICT DO NOTHING on topup_events

## Implementation Steps

### Step 1: Create `src/land/billing/overage-topup.ts` (new file)

```typescript
// createTopupInvoice(userId, mcuAmount): Promise<Result<TopupInvoice, TopupError>>
// 1. Calculate price: mcuAmount × pricePerCredit (from TIER_CONFIG)
// 2. Create NOWPayments invoice via SDK
// 3. Store pending_topups row (invoice_id, userId, mcuAmount, status='pending')
// 4. Return invoice URL for redirect

// processTopupIpn(ipn: TopupIpnPayload): Promise<Result<void, TopupError>>
// 1. Atomic lock: INSERT INTO topup_events ON CONFLICT DO NOTHING
// 2. Verify payment amount matches invoice
// 3. Add MCU credits to user balance
// 4. Mark corresponding overage_events as billable
// 5. Invalidate quota cache
// 6. Release lock
```

### Step 2: Create credit bar UI component

```typescript
// src/app/[locale]/dashboard/billing/credit-bar.tsx
// Shows: "You've used X/Y MCU this month"
// When near limit: yellow warning + "Buy more credits" button
// When at limit: red alert + "Top up now to continue" CTA
```

### Step 3: Extend quota enforcer response

- Modify `createQuotaExceededResponse()` to include top-up URL
- Response body: `{ code: 'quota_exceeded', retryAfter, topUpUrl, remainingCredits, pricePerCredit }`

### Step 4: Create top-up webhook handler

```typescript
// Extend NOWPayments IPN route to handle top-up payment status
// Track: order_id prefix "topup_" → route to processTopupIpn()
```

### Step 5: Create `migrations/0205_overage_topup.sql`

```sql
CREATE TABLE IF NOT EXISTS pending_topups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL UNIQUE,
  mcu_amount INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS topup_events (
  event_id TEXT PRIMARY KEY,
  topup_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/billing/overage-topup.ts` | CREATE | Top-up flow logic |
| `src/land/billing/overage-topup-types.ts` | CREATE | Types for top-up flow |
| `src/app/[locale]/dashboard/billing/credit-bar.tsx` | CREATE | Credit bar UI component |
| `src/forest/quota/quota-enforcer-response.ts` | MODIFY | Add topUpUrl to 429 response |
| `src/app/api/webhooks/nowpayments/route.ts` | MODIFY | Route top-up IPNs |
| `migrations/0205_overage_topup.sql` | CREATE | Schema migration |

## Todo List

- [ ] Create `overage-topup.ts` with createTopupInvoice + processTopupIpn
- [ ] Create credit bar UI component (bilingual VI+EN)
- [ ] Extend quota enforcer 429 response with topUpUrl
- [ ] Route top-up IPNs in NOWPayments webhook handler
- [ ] Create migration for pending_topups + topup_events tables
- [ ] Implement credit expiry per billing period (configurable)
- [ ] Verify contract tests from Phase 05 now PASS
- [ ] Run full test suite (6200+ tests, 0 regressions)

## Success Criteria

- [] All 12+ contract tests from Phase 05 now PASS
- [] `npm run build` → 0 TypeScript errors
- [] `npm test` → all tests pass
- [] Top-up flow: quota exceeded → credit bar shows → buy credits → NOWPayments → IPN → credits added → quota passes
- [] Top-up idempotency: duplicate IPN → "already processed"
- [] Credit bar bilingual VI+EN
- [] Protected flows unchanged (payment IPN, Setup Wizard, Telegram Bot)

## Risk Assessment

- **Risk:** Credit expiry could surprise users ("my credits disappeared")
- **Mitigation:** Show expiration date clearly in credit bar; send email 3 days before expiry
- **Risk:** NOWPayments micro-transaction minimums (network fees on small amounts)
- **Mitigation:** Set minimum top-up at 100 MCU (~$10); display fee breakdown
- **Risk:** Quota cache staleness after top-up (user pays but still blocked)
- **Mitigation:** Invalidate quota cache immediately in processTopupIpn()

## Next Steps

- Phase 09: Integration tests + cross-track validation
