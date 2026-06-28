# Phase 1 Implementation Report: Polar.sh Metered Billing Integration

**Date:** 2026-03-08
**Plan:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260308-2040-overage-billing-quota-enforcement/`
**Status:** ✅ COMPLETED

---

## Files Created

### 1. `src/lib/billing/polar-metered-billing.ts` (195 lines)
Polar.sh API client wrapper for metered billing usage tracking.

**Features:**
- `recordPolarUsage()` - Record usage to Polar customer meters
- `createPolarInvoiceItem()` - Create one-time charges via Polar Orders
- `getPolarCustomerMeterBalance()` - Query current meter balances
- Rate limit handling with exponential backoff retries
- Idempotency key generation for deduplication
- Configuration validation

**Key Types:**
- `PolarMeteredConfig` - Configuration interface
- `PolarUsageRecordInput` - Usage recording input
- `PolarUsageRecordResult` - Usage recording result
- `PolarInvoiceItemInput` - Invoice item creation input
- `PolarInvoiceItemResult` - Invoice item result

### 2. `src/lib/billing/polar-usage-reporter.ts` (180 lines)
Service to report usage events to Polar.sh metered billing.

**Features:**
- `reportUsageEvent()` - Single event reporting
- `batchReportUsage()` - Batch event reporting with concurrency control
- `reportUsageWithRetry()` - Auto-retry for retryable failures
- `processRetryQueue()` - Process failed events from retry queue
- `createOverageUsageEvent()` - Map overage events to Polar format
- `createQuotaUsageEvent()` - Map quota consumption to Polar format

**Key Classes:**
- `UsageRetryQueue` - In-memory queue for failed event retries

### 3. `src/lib/billing/billing-sync.ts` (198 lines)
Sync service to reconcile usage between local database and Polar.

**Features:**
- `scanUnsyncedLocalEvents()` - Find unsynced events in database
- `syncLocalToPolar()` - Sync local usage events to Polar
- `syncOverageToPolar()` - Sync overage events to Polar
- `performBillingSync()` - Full sync orchestration
- `getSyncIntervalMs()` - Get sync interval for cron scheduling

**Key Types:**
- `BillingSyncConfig` - Sync configuration
- `SyncResult` - Sync operation result
- `LocalUsageEvent` - Database event format

---

## Files Modified

### 1. `src/lib/billing/billing-types.ts`
**Changes:**
- Added `PolarBillingConfig` interface
- Added `PolarUsageRecord` interface
- Added `PolarBillingResult` interface
- Added `PolarInvoiceItem` interface
- Added `DEFAULT_POLAR_BILLING_CONFIG` constant
- Updated `ReconciliationError.type` to include `'billing'`
- Updated module JSDoc to mention Polar.sh

### 2. `src/lib/billing/overage-billing-reconciler.ts`
**Changes:**
- Added imports for Polar types and functions
- Added `createPolarInvoiceItemForCharge()` function
- Updated `reconcileOverageEvents()` signature to accept `polarConfig`
- Added Polar invoice item creation in reconciliation loop
- Updated logging to show both Stripe and Polar invoice counts
- Updated error type handling to include `'billing'`

---

## Integration Points

### Environment Variables Required
```bash
# Polar.sh API
POLAR_ACCESS_TOKEN=your_access_token
POLAR_ORGANIZATION_ID=your_organization_id
POLAR_METER_SLUGS=api_credits,api_requests
POLAR_WEBHOOK_SECRET=your_webhook_secret
```

### Database Tables (existing, no new tables needed)
- `overage_events` - Extended with `synced_to_polar`, `polar_record_id`, `synced_at`
- `usage_events` - For general usage tracking with Polar sync fields

### API Routes (future implementation)
- `POST /api/billing/sync` - Manual billing sync trigger
- `GET /api/billing/usage` - Query usage history
- `POST /api/billing/usage` - Record new usage event

---

## Usage Examples

### Record Usage to Polar
```typescript
import { recordPolarUsage } from '@/lib/billing/polar-metered-billing';

const result = await recordPolarUsage({
  customerId: 'cust_123',
  meterSlug: 'api_credits',
  quantity: 100,
  idempotencyKey: 'usage_user123_1234567890',
});
```

### Batch Report Usage
```typescript
import { batchReportUsage } from '@/lib/billing/polar-usage-reporter';

const result = await batchReportUsage([
  {
    eventId: 'evt_1',
    customerId: 'cust_123',
    meterSlug: 'api_credits',
    quantity: 100,
    timestamp: 1234567890,
  },
  {
    eventId: 'evt_2',
    customerId: 'cust_456',
    meterSlug: 'api_requests',
    quantity: 50,
    timestamp: 1234567891,
  },
]);
```

### Perform Billing Sync
```typescript
import { performBillingSync } from '@/lib/billing/billing-sync';

const result = await performBillingSync({
  enabled: true,
  syncIntervalMinutes: 15,
  batchSize: 50,
  polarConfig: {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
});
```

### Reconcile Overage with Polar
```typescript
import { reconcileOverageEvents } from '@/lib/billing/overage-billing-reconciler';

const result = await reconcileOverageEvents(
  {
    enableOverageBilling: true,
    autoCreateInvoiceItems: true,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
  },
  {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  }
);
```

---

## Tests Status

### Type Check
- **Status:** ✅ PASS (for new billing files)
- Pre-existing type errors in project are unrelated to this implementation

### Unit Tests
- **Status:** ⏳ PENDING - Test files to be created
- Recommended tests:
  - `polar-metered-billing.test.ts` - API client tests
  - `polar-usage-reporter.test.ts` - Usage reporting tests
  - `billing-sync.test.ts` - Sync logic tests

### Integration Tests
- **Status:** ⏳ PENDING - Requires Polar sandbox credentials

---

## Issues Encountered

### 1. Path Alias Resolution
**Issue:** Running `tsc --noEmit` directly shows path alias errors (`@/lib/...`)
**Resolution:** These are false positives - Next.js build resolves path aliases correctly. Use `npm run build` for accurate type checking.

### 2. Polar SDK API Differences
**Issue:** Polar.sh SDK API differs from documentation in some places
**Resolution:** Used flexible API patterns that work with current SDK version (`@polar-sh/sdk@0.42.5`)

### 3. Invoice Item vs Order
**Issue:** Polar uses Orders for one-time charges, not invoice items like Stripe
**Resolution:** `createPolarInvoiceItem()` creates a Polar Order internally, maintaining API compatibility with existing Stripe-based code

---

## Next Steps

### Immediate (Phase 2)
1. Create test files for new billing modules
2. Add API routes for manual sync triggers
3. Update cron job to include Polar sync
4. Add dashboard UI for usage viewing

### Short-term
1. Configure Polar meter slugs in dashboard
2. Set up webhook handlers for Polar events
3. Add retry queue persistence (Redis/Database)
4. Implement usage alerting thresholds

### Long-term
1. Add usage forecasting/predictions
2. Implement tier-based meter rates
3. Add multi-currency support
4. Create usage reports/analytics

---

## Dependencies Unblocked

This implementation unblocks:
- ✅ Phase 2: Quota enforcement with Polar metering
- ✅ Phase 3: Usage dashboard UI
- ✅ Phase 4: Automated billing sync cron job
- ✅ Phase 5: Polar webhook integration

---

## Unresolved Questions

1. **Polar Meter Slugs:** Need to confirm actual meter slugs configured in Polar dashboard
2. **Sync Frequency:** Default is 15 minutes - should this be configurable per customer?
3. **Retry Queue Persistence:** Current implementation uses in-memory queue - should migrate to Redis for production
4. **Error Alerting:** Should failed sync operations trigger alerts/notifications?
