# Phase 6 Research: Cloudflare Workers Scheduled Tasks + R2 Storage

**Date:** 2026-03-09
**Researcher:** general-purpose agent
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory`

---

## 1. Cloudflare Workers Scheduled Tasks - Implementation Patterns

### Current Implementation

The codebase already has a **scheduled handler** configured in the Cloudflare Worker:

**File:** `apps/sophia-ai-factory/wrangler.toml`
```toml
[triggers]
crons = ["* * * * *"]  # Every minute
```

**File:** `apps/sophia-ai-factory/src/worker/index.ts`
```typescript
async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const config: AlertDispatcherConfig = {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
    agencyosWebhookUrl: env.AGENCYOS_ALERT_WEBHOOK_URL,
    agencyosApiKey: env.AGENCYOS_API_KEY,
    debounceMs: 60000,
    enabledThresholds: [80, 90, 100],
  };

  await handleScheduledAlertCheck(config, env.KV_KV, ctx);
}
```

### Key Patterns Found

1. **Scheduled Handler Signature:**
   ```typescript
   async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>
   ```

2. **Cron Expression Format:** Standard Unix cron (5 fields)
   - `* * * * *` = Every minute
   - `0 * * * *` = Every hour
   - `0 0 * * *` = Daily at midnight
   - `0 0 * * 0` = Weekly on Sunday

3. **Background Processing with `ctx.waitUntil()`:**
   ```typescript
   ctx.waitUntil(asyncOperation);  // Don't block response
   ```

4. **Existing Scheduled Task:** Realtime alert dispatcher checks quota thresholds every minute

### For Phase 6 Billing Reconciliation

**Recommended cron schedule:**
```toml
[triggers]
crons = ["0 0 * * *"]  # Daily at midnight UTC
```

**Handler implementation pattern:**
```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const reconciler = new OverageBillingReconciler(env);

  // Run reconciliation
  const result = await reconciler.reconcileAll();

  // Store result in R2 for audit trail
  await storeReconciliationReport(result, env.R2_BUCKET);

  logger.info('[Scheduled] Reconciliation complete', result);
}
```

---

## 2. R2 Storage Setup - Bucket Config + Read/Write Patterns

### Current R2 Usage in Codebase

**References found in documentation/skills:**
- Video storage for AI-generated content (`videos/{date}/{script_id}_youtube.mp4`)
- Thumbnail storage (`videos/{date}/{script_id}_thumbnail.jpg`)
- 90-day retention policy
- Cost: $0.015/GB/month (zero egress fees)

**File:** `.claude/skills/devops/references/cloudflare-r2-storage.md`

### R2 Bucket Configuration

**wrangler.toml binding:**
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "sophia-audit-reports"
```

**Worker environment type:**
```typescript
interface Env {
  R2_BUCKET: R2Bucket;
  // ... other bindings
}
```

### R2 Read/Write Patterns

**Write JSON Report:**
```typescript
// Store reconciliation report
async function storeReconciliationReport(
  report: ReconciliationResult,
  bucket: R2Bucket
): Promise<string> {
  const timestamp = new Date().toISOString();
  const key = `reports/reconciliation-${timestamp}.json`;

  await bucket.put(key, JSON.stringify(report, null, 2), {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'private, max-age=0'
    },
    customMetadata: {
      generatedAt: timestamp,
      reportType: 'reconciliation',
      period: report.period
    }
  });

  return key;
}
```

**Read Report:**
```typescript
async function getReconciliationReport(
  bucket: R2Bucket,
  reportId: string
): Promise<ReconciliationResult | null> {
  const object = await bucket.get(`reports/${reportId}`);

  if (!object) {
    return null;
  }

  const content = await object.text();
  return JSON.parse(content);
}
```

**List Reports (for audit API):**
```typescript
async function listReconciliationReports(
  bucket: R2Bucket,
  options?: { prefix?: string; limit?: number }
): Promise<R2Object[]> {
  const listed = await bucket.list({
    prefix: options?.prefix || 'reports/',
    limit: options?.limit || 100
  });

  return listed.objects;
}
```

**Delete Old Reports (lifecycle management):**
```typescript
async function cleanupOldReports(
  bucket: R2Bucket,
  retentionDays: number = 90
): Promise<number> {
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const listed = await bucket.list({ prefix: 'reports/' });

  let deleted = 0;
  for (const obj of listed.objects) {
    if (obj.uploaded.getTime() < cutoff) {
      await bucket.delete(obj.key);
      deleted++;
    }
  }

  return deleted;
}
```

### R2 Bucket Creation Commands

```bash
# Create bucket
wrangler r2 bucket create sophia-audit-reports --location=wnam

# Bind to worker (add to wrangler.toml manually)
# [[r2_buckets]]
# binding = "R2_BUCKET"
# bucket_name = "sophia-audit-reports"

# Enable public access (optional, for download URLs)
# Dashboard → R2 → Bucket → Settings → Public Access
```

---

## 3. Billing Reconciliation - Existing Flow + Gaps

### Current Architecture

**File:** `apps/sophia-ai-factory/src/lib/billing/overage-billing-reconciler.ts`

**Key Functions:**
```typescript
// Scan unbilled overage events from database
scanUnbilledOverageEvents(config): Promise<UnbilledEventsByUser[]>

// Calculate charges based on tier pricing
calculateOverageCharges(userEvents): OverageCharge

// Create invoice items (Stripe/Polar)
createStripeInvoiceItem(charge): Promise<StripeInvoiceItemResult>
createPolarInvoiceItem(charge): Promise<PolarInvoiceItemResult>

// Mark events as billed (idempotent)
markEventsAsBilled(eventIds, invoiceItemId): Promise<void>
```

**Tier Pricing:**
```typescript
const PRICING_TIERS = {
  BASIC: { pricePerCredit: 0.10 },      // $0.10 per overage credit
  PREMIUM: { pricePerCredit: 0.05 },    // $0.05 per overage credit
  ENTERPRISE: { pricePerCredit: 0.03 }, // $0.03 per overage credit
  MASTER: { pricePerCredit: 0.02 }      // $0.02 per overage credit
};
```

### Data Flow

```
usage_events (Supabase)
       ↓
overage_events (unbilled, billable=false)
       ↓
overage-billing-reconciler.ts (scan + calculate)
       ↓
Stripe/Polar Invoice Items (create charge)
       ↓
overage_events (mark as billed, billable=true)
```

### Identified Gaps for Phase 6

| Gap | Current State | Required for Phase 6 |
|-----|---------------|---------------------|
| **Scheduled Execution** | Manual API trigger via `/api/admin/billing/reconcile` | Cloudflare Worker `scheduled` handler |
| **Report Storage** | In-memory response, not persisted | R2 bucket for JSON reports |
| **Audit Trail** | Database rows only | R2-stored snapshots with hash verification |
| **KV Metering Sync** | `kv-metering-log-sync.ts` exists but not integrated with Worker | Worker reads KV for edge reconciliation |
| **Discrepancy Detection** | Basic validation only | Cross-reference KV vs database vs gateway logs |
| **Report Retrieval API** | Not implemented | `/api/admin/audit/reports` (exists but needs R2 integration) |

### KV Metering Log Integration

**File:** `apps/sophia-ai-factory/src/lib/usage-metering/kv-metering-log-sync.ts`

**Key Interface:**
```typescript
interface MeteringLogEntry {
  eventId: string;
  userId: string;
  licenseNonce: string;
  service: string;
  creditsUsed: number;
  idempotencyKey: string;
  timestamp: number;
  reconciledWithGateway: boolean;
  gatewayDiscrepancy?: string;
}
```

**Integration Point:**
Worker scheduled handler should:
1. Fetch metering logs from KV (`metering:{timestamp}:{eventId}`)
2. Compare with RaaS Gateway logs (from proxy requests)
3. Flag discrepancies for manual review
4. Store reconciliation report in R2

---

## 4. RaaS Gateway - Auth + Rate Limiting Patterns

### Authentication Flow

**File:** `apps/sophia-ai-factory/src/worker/middleware/raas-auth-middleware.ts`

**Two Authentication Methods:**

1. **API Key (mk_ prefix):**
   ```typescript
   // Header: X-API-Key: mk_{keyId}_{signature}
   const apiKey = extractApiKey(request);
   const result = await validateApiKey(apiKey, kv);
   ```

2. **JWT Bearer Token:**
   ```typescript
   // Header: Authorization: Bearer <token>
   const token = extractJwt(request);
   const payload = await jwtVerify(token, JWKS);
   const enrichedClaims = extractEnrichedClaims(payload, kv);
   ```

**Auth Context:**
```typescript
interface AuthContext {
  userId: string;
  licenseNonce: string;
  tier: string;  // BASIC | PREMIUM | ENTERPRISE | MASTER
  featureEntitlements: string[];  // ['video_generation', 'analytics', ...]
  agencyId?: string;
  polarSubscriptionStatus?: string;  // 'active' | 'inactive' | 'canceled'
  isPaid?: boolean;
}
```

### Feature-Level Access Control

**Pattern:**
```typescript
// Check if endpoint requires specific feature
const requiredFeature = getRequiredFeature('/api/proxy/video-generation');

// Verify user has feature entitlement
const featureResult = await checkFeatureAccess(requiredFeature, authContext);
if (!featureResult.allowed) {
  return new Response(JSON.stringify({
    error: 'Feature access denied',
    reason: featureResult.reason,  // 'not_entitled' | 'license_inactive'
    feature: requiredFeature,
    tier: authContext.tier
  }), { status: 403 });
}
```

### Rate Limiting Patterns

**File:** `apps/sophia-ai-factory/src/lib/security/rate-limiter.ts`

**SQL-Based Rate Limiting:**
```typescript
async function checkRateLimit(
  apiKeyId: string,
  limit: number = 100  // requests per minute
): Promise<RateLimitResult> {
  const identifier = `api-key:${apiKeyId}`;
  const config: RateLimitConfig = {
    maxRequests: limit,
    windowSeconds: 60,
    identifier
  };

  const sqlResult = await checkSqlRateLimit(identifier, config);

  return {
    allowed: sqlResult.success,
    remaining: sqlResult.remaining,
    resetAt: sqlResult.reset,
    retryAfter: !sqlResult.success
      ? Math.ceil((sqlResult.reset - Date.now()) / 1000)
      : undefined
  };
}
```

**Response Headers for Rate Limits:**
```typescript
headers.set('X-RateLimit-Limit', '100');
headers.set('X-RateLimit-Remaining', remaining.toString());
headers.set('X-RateLimit-Reset', resetAt.toString());

if (!allowed) {
  headers.set('Retry-After', retryAfter.toString());
}
```

### Quota Enforcement Pattern

**File:** `apps/sophia-ai-factory/src/worker/lib/quota-counter.ts`

```typescript
async function checkQuota(
  apiKey: string,
  service: string,
  kv: KVNamespace
): Promise<QuotaCheckResult> {
  // Get tier
  const tier = await kv.get(`tier:${apiKey}`) || 'BASIC';

  // Get current usage
  const usageKey = `usage:${apiKey}:${service}`;
  const currentUsage = parseInt(await kv.get(usageKey) || '0');

  // Get tier limits
  const limits = TIER_LIMITS[tier];

  // Check if over hard limit (150% of base)
  const hardLimit = Math.floor(limits.base * 1.5);
  const isOverHardLimit = currentUsage >= hardLimit;

  return {
    allowed: !isOverHardLimit,
    remaining: Math.max(0, limits.base - currentUsage),
    limit: limits.base,
    overageCount: Math.max(0, currentUsage - limits.base)
  };
}
```

---

## 5. Recommendations for Phase 6 Implementation

### Task 1: Add R2 Bucket Binding to wrangler.toml

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "sophia-audit-reports"
```

### Task 2: Create Scheduled Reconciliation Handler

**File:** `apps/sophia-ai-factory/src/worker/lib/reconciliation-runner.ts`

```typescript
export async function runBillingReconciliation(
  env: Env,
  ctx: ExecutionContext
): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    unbilledEventsScanned: 0,
    invoicesCreated: 0,
    totalAmount: 0,
    errors: [],
    kvDiscrepancies: [],
    r2StorageKey: ''
  };

  // 1. Scan unbilled overage events
  const unbilledGroups = await scanUnbilledOverageEvents();
  report.unbilledEventsScanned = unbilledGroups.reduce(
    (sum, g) => sum + g.events.length, 0
  );

  // 2. Process each group
  for (const group of unbilledGroups) {
    try {
      const charge = calculateOverageCharges(group);
      const invoiceResult = await createPolarInvoiceItem(charge);

      if (invoiceResult.success) {
        await markEventsAsBilled(group.events, invoiceResult.invoiceItemId);
        report.invoicesCreated++;
        report.totalAmount += charge.totalCharge;
      }
    } catch (error) {
      report.errors.push({
        licenseNonce: group.licenseNonce,
        error: error.message
      });
    }
  }

  // 3. Store report in R2
  report.r2StorageKey = await storeReconciliationReport(report, env.R2_BUCKET);

  return report;
}
```

### Task 3: Update Worker Scheduled Handler

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // Run alert checks (existing)
  await handleScheduledAlertCheck(config, env.KV_KV, ctx);

  // Run billing reconciliation (new - daily at midnight)
  const cron = event.cron;
  if (cron === '0 0 * * *') {
    const report = await runBillingReconciliation(env, ctx);
    logger.info('[Scheduled] Billing reconciliation', report);
  }
}
```

### Task 4: Create Report Retrieval API

**File:** `apps/sophia-ai-factory/src/app/api/admin/audit/reports/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('type') || 'reconciliation';
  const limit = parseInt(searchParams.get('limit') || '100');

  // List reports from R2
  const reports = await listReconciliationReports(env.R2_BUCKET, {
    prefix: `reports/${reportType}-`,
    limit
  });

  return Response.json({
    reports: reports.map(r => ({
      id: r.key.split('/').pop(),
      uploaded: r.uploaded,
      size: r.size
    }))
  });
}
```

### Task 5: KV Discrepancy Detection

```typescript
async function detectDiscrepancies(
  localEvents: OverageEvent[],
  kvMeteringLogs: MeteringLogEntry[],
  gatewayLogs: GatewayLog[]
): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  // Cross-reference all three sources
  for (const local of localEvents) {
    const kvMatch = kvMeteringLogs.find(kv => kv.eventId === local.id);
    const gatewayMatch = gatewayLogs.find(g => g.idempotencyKey === local.idempotencyKey);

    if (!kvMatch) {
      discrepancies.push({
        type: 'missing_in_kv',
        eventId: local.id,
        severity: 'warning'
      });
    }

    if (!gatewayMatch) {
      discrepancies.push({
        type: 'missing_in_gateway',
        eventId: local.id,
        severity: 'high'
      });
    }

    if (kvMatch && local.creditsUsed !== kvMatch.creditsUsed) {
      discrepancies.push({
        type: 'credit_mismatch',
        eventId: local.id,
        local: local.creditsUsed,
        kv: kvMatch.creditsUsed,
        severity: 'critical'
      });
    }
  }

  return discrepancies;
}
```

---

## 6. File Inventory

### Existing Files to Update

| File | Changes Needed |
|------|---------------|
| `wrangler.toml` | Add `[[r2_buckets]]` binding |
| `src/worker/index.ts` | Add reconciliation logic to `scheduled` handler |
| `worker-configuration.d.ts` | Add `R2_BUCKET: R2Bucket` to Env interface |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/worker/lib/reconciliation-runner.ts` | Scheduled reconciliation handler |
| `src/worker/lib/r2-report-storage.ts` | R2 read/write utilities |
| `src/app/api/admin/audit/reports/[id]/route.ts` | Download individual reports |
| `src/lib/billing/reconciliation-types.ts` | Extended types for Phase 6 |

---

## 7. Unresolved Questions

1. **R2 Bucket Naming:** Should we use separate buckets for `sophia-audit-reports` vs `sophia-reconciliation-reports`?

2. **Retention Policy:** Current docs mention 90 days for video storage. Should audit reports have longer retention (1-7 years for compliance)?

3. **KV Key Format:** Current format is `metering:{timestamp}:{eventId}`. Should we add index keys for faster lookup by `licenseNonce`?

4. **Cron Schedule:** Daily at midnight (`0 0 * * *`) vs hourly (`0 * * * *`)? Hourly provides faster billing but more Worker invocations.

5. **Error Handling:** Should failed reconciliation attempts trigger PagerDuty/Slack alerts, or just log and retry next cycle?

---

## 8. References

- Cloudflare Workers Scheduled Handlers: https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
- Cloudflare R2 Storage: https://developers.cloudflare.com/r2/
- R2 Workers API: https://developers.cloudflare.com/r2/api/workers/
- Existing codebase patterns in `src/worker/`, `src/lib/billing/`, `src/lib/usage-metering/`
