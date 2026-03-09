# Overage Billing Integration - Completion Report

**Date:** 2026-03-09
**Status:** ✅ COMPLETE - Infrastructure Already Existed
**Time:** ~15 minutes (scout + verify only)

---

## Summary

Overage Billing Integration với Stripe/Polar **ĐÃ HOÀN CHỈNH** từ trước với đầy đủ:

1. **Reconciliation Engine** - Scan, calculate, bill, mark events
2. **Stripe Integration** - Invoice items với idempotency
3. **Polar.sh Integration** - Metered usage + one-time orders
4. **Idempotency Layer** - Prevent double-billing
5. **Retry Logic** - Exponential backoff cho transient failures
6. **Audit Logging** - Structured logging cho mọi actions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Overage Events (Database)                                  │
│  - quota exhaustion detected                                │
│  - billable: false                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (Cron Job / Manual Trigger)
┌─────────────────────────────────────────────────────────────┐
│  reconcileOverageEvents()                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1. scanUnbilledOverageEvents()                        │ │
│  │    - Query: WHERE billable = false                    │ │
│  │    - Group by: userId + licenseNonce                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 2. calculateOverageCharges()                          │ │
│  │    - Tier pricing:                                    │ │
│  │      BASIC: $0.10/credit                              │ │
│  │      PREMIUM: $0.05/credit                            │ │
│  │      ENTERPRISE: $0.03/credit                         │ │
│  │      MASTER: $0.02/credit                             │ │
│  │    - Total = exceededBy × pricePerCredit              │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 3. Create Invoice Items                               │ │
│  │    - Stripe: invoiceItems.create()                    │ │
│  │    - Polar: orders.create()                           │ │
│  │    - Idempotency Key:                                 │ │
│  │      overage-{nonce}-{start}-{end}                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 4. markEventsAsBilled()                               │ │
│  │    - UPDATE overage_events                            │ │
│  │    - SET billable = true                              │ │
│  │    - WHERE id IN (...)                                │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  External Billing Systems                                   │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   Stripe        │  │   Polar.sh      │                 │
│  │  - Invoice Item │  │  - Order        │                 │
│  │  - Auto-charge  │  │  - Auto-charge  │                 │
│  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created (Pre-Session)

### Core Billing Logic

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/billing/overage-billing-reconciler.ts` | Main reconciliation engine | ~600 |
| `src/lib/billing/polar-metered-billing.ts` | Polar.sh API wrapper | ~530 |
| `src/lib/billing/billing-types.ts` | Type definitions | ~290 |
| `src/lib/billing/billing-sync.ts` | Billing sync utilities | - |
| `src/lib/billing/polar-usage-reporter.ts` | Polar usage reporting | - |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cron/overage-billing` | GET | Scheduled reconciliation (cron) |
| `/api/admin/quota/reconcile` | POST | Manual trigger |
| `/api/admin/quota/mark-billable` | POST | Mark events as billable |
| `/api/admin/quota/overage-summary` | GET | Summary report |

### Database Schema

```sql
-- overage_events table
CREATE TABLE overage_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  license_nonce VARCHAR(255) REFERENCES raas_licenses(nonce),
  exceeded_type VARCHAR(50) NOT NULL,  -- hourly/daily/monthly_credits, daily_requests
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,
  requested_credits INTEGER NOT NULL,
  endpoint VARCHAR(255),
  service_name VARCHAR(100),
  action VARCHAR(100),
  tier_at_exceeded VARCHAR(50) NOT NULL,
  external_customer_id VARCHAR(255),  -- Stripe/Polar customer ID
  billable BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  created_at INTEGER NOT NULL  -- Unix timestamp
);

-- Indexes for performance
CREATE INDEX idx_overage_events_billable ON overage_events(billable) WHERE NOT billable;
CREATE INDEX idx_overage_events_user_license ON overage_events(user_id, license_nonce);
CREATE INDEX idx_overage_events_created_at ON overage_events(created_at);
```

---

## Features Implemented

### 1. Overage Detection

Triggered when usage exceeds quota limits:

```typescript
// From quota-checker.ts
if (usageAfter > limit) {
  await logOverageEvent({
    userId,
    licenseNonce,
    exceededType: 'hourly_credits',
    exceededLimit: limit,
    exceededCurrent: current,
    exceededBy: usageAfter - limit,
    requestedCredits,
    tier: userTier,
  });
}
```

### 2. Reconciliation Flow

**Step 1: Scan unbilled events**
```typescript
const unbilledGroups = await scanUnbilledOverageEvents();
// Returns: UnbilledEventsByUser[] grouped by userId + licenseNonce
```

**Step 2: Calculate charges**
```typescript
const charge = calculateOverageCharges(group);
// BASIC: 100 credits × $0.10 = $10.00
// PREMIUM: 100 credits × $0.05 = $5.00
// ENTERPRISE: 100 credits × $0.03 = $3.00
// MASTER: 100 credits × $0.02 = $2.00
```

**Step 3: Create invoice items**
```typescript
// Stripe
await createStripeInvoiceItem(charge);
// → Invoice item with idempotency key

// Polar
await createPolarInvoiceItemForCharge(charge);
// → Order created in Polar
```

**Step 4: Mark as billed**
```typescript
await markEventsAsBilled(eventIds);
// → UPDATE overage_events SET billable = true
```

### 3. Idempotency

Prevents double-billing via idempotency keys:

```typescript
export function generateIdempotencyKey(
  licenseNonce: string,
  periodStart: number,
  periodEnd: number
): string {
  return `overage-${licenseNonce}-${periodStart}-${periodEnd}`;
}
```

**Stripe:** Passed to `invoiceItems.create({ idempotencyKey })`

**Polar:** Stored in order metadata

### 4. Retry Logic

Exponential backoff for transient failures:

```typescript
export async function reconcileOverageEventsWithRetry(
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<ReconciliationResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await reconcileOverageEvents();
    if (result.success) return result;

    // Exponential backoff: 1s, 2s, 4s
    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### 5. Rate Limit Handling (Polar)

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  config: PolarMeteredConfig,
  operation: string
): Promise<T> {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429;
      if (!isRateLimit || attempt === config.maxRetries) throw error;

      // Exponential backoff + jitter
      const delay = calculateBackoff(attempt);
      await sleep(delay);
    }
  }
}
```

---

## API Response Schemas

### GET /api/cron/overage-billing

**Response:**
```json
{
  "success": true,
  "scannedEvents": 15,
  "unbilledEvents": 15,
  "billableEvents": 15,
  "totalOverageCredits": 450,
  "totalCharge": 31.50,
  "currency": "USD",
  "charges": [
    {
      "userId": "user-uuid",
      "licenseNonce": "nonce-uuid",
      "tier": "PREMIUM",
      "overageCredits": 150,
      "pricePerCredit": 0.05,
      "totalCharge": 7.50,
      "currency": "USD",
      "eventCount": 3,
      "periodStart": 1709280000,
      "periodEnd": 1709366400
    }
  ],
  "invoiceItemsCreated": 2,
  "eventsMarkedAsBilled": 15,
  "errors": []
}
```

### POST /api/admin/quota/reconcile

**Request:**
```json
{
  "dryRun": false,
  "stripeEnabled": true,
  "polarEnabled": true
}
```

**Response:** Same as cron endpoint

---

## Pricing Tiers

| Tier | Price per Credit | Example: 100 credits |
|------|------------------|---------------------|
| BASIC | $0.10 | $10.00 |
| PREMIUM | $0.05 | $5.00 |
| ENTERPRISE | $0.03 | $3.00 |
| MASTER | $0.02 | $2.00 |

**Rationale:** Higher tiers get cheaper overage rates as incentive to upgrade.

---

## Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_xxx

# Polar.sh
POLAR_ACCESS_TOKEN=sk_xxx
POLAR_ORGANIZATION_ID=org_xxx
POLAR_METER_SLUGS=api_credits,api_requests

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key

# Cron Secret (for /api/cron/overage-billing)
INTERNAL_WEBHOOK_SECRET=your_secret
```

---

## Testing Verification

### Unit Tests

File: `src/lib/billing/overage-billing-reconciler.test.ts`

```typescript
describe('calculateOverageCharges', () => {
  it('calculates correct charge for PREMIUM tier', () => {
    const charge = calculateOverageCharges({
      tier: 'PREMIUM',
      totalOverageCredits: 100,
      // ...
    });
    expect(charge.totalCharge).toBe(5.00); // 100 × $0.05
  });
});
```

### Integration Tests

```typescript
describe('reconcileOverageEvents', () => {
  it('creates Stripe invoice items for unbilled events', async () => {
    const result = await reconcileOverageEvents();
    expect(result.success).toBe(true);
    expect(result.invoiceItemsCreated).toBeGreaterThan(0);
  });
});
```

### Manual Testing

```bash
# 1. Insert test overage event
psql "$DATABASE_URL" -c "
  INSERT INTO overage_events (user_id, license_nonce, exceeded_type,
    exceeded_limit, exceeded_current, exceeded_by, tier_at_exceeded,
    billable, created_at)
  VALUES ('test-user', 'test-nonce', 'hourly_credits',
    100, 150, 50, 'PREMIUM', false, extract(epoch from now()));
"

# 2. Trigger reconciliation
curl -X POST http://localhost:3000/api/admin/quota/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# 3. Verify result
psql "$DATABASE_URL" -c "
  SELECT billable FROM overage_events WHERE license_nonce = 'test-nonce';
"
# Expected: billable = true
```

---

## Audit Logging

All billing actions logged with structured JSON:

```typescript
logger.info('[Overage Reconciler] Calculated overage charge', {
  userId,
  licenseNonce: licenseNonce.slice(0, 8),
  tier,
  overageCredits: totalOverageCredits,
  pricePerCredit: pricing.pricePerCredit,
  totalCharge,
  currency: pricing.currency,
});

logger.info('[Overage Reconciler] Created Stripe invoice item', {
  invoiceItemId: invoiceItem.id,
  userId: charge.userId,
  licenseNonce: charge.licenseNonce.slice(0, 8),
  amount: charge.totalCharge,
  currency: charge.currency,
});
```

**Logs visible in:**
- Console (development)
- Vercel Logs (production)
- Structured logging service (if configured)

---

## Cron Configuration

### Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/overage-billing",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule:** Every hour at minute 0

### Alternative: GitHub Actions

```yaml
# .github/workflows/overage-billing.yml
name: Overage Billing Reconciliation

on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reconciliation
        run: |
          curl -X POST https://sophia-ai-factory.vercel.app/api/cron/overage-billing \
            -H "x-internal-secret: ${{ secrets.INTERNAL_WEBHOOK_SECRET }}"
```

---

## Error Handling

### Retryable Errors

| Error Type | Retryable | Strategy |
|------------|-----------|----------|
| Network timeout | ✅ Yes | Exponential backoff |
| Stripe 429 | ✅ Yes | Retry after header |
| Polar 429 | ✅ Yes | Retry after header |
| Database lock | ✅ Yes | Retry with delay |
| Invalid customer ID | ❌ No | Log and skip |
| Stripe API error (4xx) | ❌ No | Log and skip |

### Non-Retryable Errors

```typescript
if (error.code === 'resource_missing') {
  // Customer not found - skip billing
  logger.warn('Customer not found, skipping billing', { customerId });
  return { success: false, message: 'Customer not found' };
}
```

---

## Integration with Analytics Dashboard

Overage events visible in Analytics Dashboard:

**Components:**
- `src/components/billing/overage-fee-display.tsx` - Display overage charges
- `src/components/billing/quota-usage-gauge.tsx` - Quota usage with overage indicator

**API:**
- `GET /api/billing/usage-summary` - Returns overage charges summary

---

## Next Steps (Optional Enhancements)

1. **Real-time Overage Alerts**
   - Email/SMS notification when overage detected
   - Slack webhook integration

2. **Overage Caps**
   - Maximum overage per period (e.g., $100/month)
   - Hard block after cap reached

3. **Overage Plans**
   - Pre-purchase overage credits at discount
   - Auto-replenish when balance low

4. **Custom Overage Rates**
   - Negotiate custom rates for enterprise customers
   - Store in quota_limits table

---

## Unresolved Questions

1. **Polar vs Stripe Priority:** Should both run in parallel or fallback (Stripe first, Polar fallback)?
2. **Tax Handling:** Should overage charges include tax calculation?
3. **Refund Policy:** How to handle refunds for disputed overage charges?
4. **Invoice PDF:** Generate PDF invoices for overage charges?

---

## Conclusion

**Overage Billing Status:** ✅ COMPLETE

Hệ thống overage billing với Stripe/Polar integration đã được implement hoàn chỉnh với:

- ✅ Reconciliation engine (scan → calculate → bill → mark)
- ✅ Stripe invoice items với idempotency
- ✅ Polar.sh orders với rate limit handling
- ✅ Retry logic với exponential backoff
- ✅ Structured audit logging
- ✅ Cron job + manual trigger API
- ✅ Unit tests + integration tests

**Ready for:** Production deployment pending environment variable verification.

---

## Environment Verification Checklist

```bash
# Check Stripe
[ -n "$STRIPE_SECRET_KEY" ] && echo "✅ Stripe configured" || echo "❌ Stripe missing"

# Check Polar
[ -n "$POLAR_ACCESS_TOKEN" ] && echo "✅ Polar configured" || echo "❌ Polar missing"

# Check database
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && echo "✅ Supabase configured" || echo "❌ Supabase missing"
```

Run before production deploy!
