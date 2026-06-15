# Phase 10: Usage Metering `:any` Cleanup Catalog

**Date:** 2026-04-20  
**Files Scanned:** 8 non-test + 2 route handlers  
**Total `:any` Occurrences:** 20

---

## File: `src/lib/usage-metering/rollup/hourly-rollup.ts` (3 occurrences)

### Line 29: D1 RPC response cast
```typescript
  .gte('created_at', hourStart)
  .lt('created_at', hourEnd) as { data: UsageEventRow[] | null; error: Error | unknown };

if (error) {
```
**Shape:** D1 RPC response  
**Fix:** Define proper response type; `error: Error | unknown` should be `unknown` + `instanceof Error` check  
**Recommended:** Create `type D1Response<T> = { data: T | null; error: unknown }`

---

### Line 158: Service breakdown cast (JSON column)
```typescript
  service_breakdown: summary.serviceBreakdown as any,
  updated_at: new Date().toISOString(),
} as any) as any;
```
**Shape:** JSON.parse() / D1 JSON column (stores array of `ServiceBreakdownItem`)  
**Fix:** Change to `service_breakdown: summary.serviceBreakdown as unknown` + validate on read  
**Note:** `serviceBreakdown: ServiceBreakdownItem[]` is already typed; cast redundant

---

### Line 160: Insert object cast
```typescript
} as any) as any;
```
**Shape:** D1 insert object cast (double-cast after line 158 service_breakdown cast)  
**Fix:** Remove both `as any` — the insert object matches D1 schema when properly typed  
**Recommended:** Type the entire insert payload

---

### Line 167: Error cast
```typescript
throw error as any;
```
**Shape:** Error object  
**Fix:** Change to `throw error instanceof Error ? error : new Error(String(error))`  
**Context:** `error` already `instanceof Error` checked at line 162

---

## File: `src/lib/usage-metering/rollup/daily-rollup.ts` (4 occurrences)

### Line 25: D1 RPC response cast
```typescript
    .select(`
      hour_timestamp, tenant_id, license_nonce, external_customer_id,
      total_requests, total_credits, total_tokens_input, total_tokens_output,
      total_errors, avg_response_time_ms, service_breakdown
    `) as { data: HourlySummaryRow[] | null; error: Error | unknown };
```
**Shape:** D1 RPC response  
**Fix:** Extract response type; use `unknown` for error, check `instanceof Error`

---

### Line 92: Service breakdown cast (from DB JSON)
```typescript
    const services = (hourly.service_breakdown as unknown as ServiceBreakdownItem[]) || [];
    for (const svc of services) {
```
**Shape:** D1 JSON column read (double-cast: `unknown → ServiceBreakdownItem[]`)  
**Fix:** Change to single safe cast with validation:  
```typescript
const services = Array.isArray(hourly.service_breakdown) 
  ? (hourly.service_breakdown as ServiceBreakdownItem[])
  : [];
```
**Note:** `HourlySummaryRow.service_breakdown` is typed as `unknown` in rollup-utils.ts:98

---

### Line 169: Service breakdown cast (insert)
```typescript
      hourly_breakdown: summary.hourlyBreakdown as any,
      service_breakdown: summary.serviceBreakdown as any,
```
**Shape:** D1 JSON columns (insert)  
**Fix:** Remove both `as any` — payload already properly typed; JSON.stringify handled by D1 client

---

### Line 171: Insert object double-cast
```typescript
    } as any) as any;
```
**Shape:** D1 insert object cast  
**Fix:** Same as hourly-rollup.ts:160 — remove both casts once payload is properly typed

---

### Line 178: Error cast
```typescript
throw error as any;
```
**Shape:** Error object  
**Fix:** Use `throw error instanceof Error ? error : new Error(String(error))`

---

## File: `src/lib/usage-metering/usage-kv-sync.ts` (3 occurrences)

### Line 82: D1 query response cast (license lookup)
```typescript
        .single() as any;

      if (licenseError || !license) {
```
**Shape:** D1 RPC response (license record)  
**Fix:** Type as `{ data: { nonce: string; tier: string; is_revoked: boolean; created_by: string } | null; error: unknown }`

---

### Line 132: Insert record cast (acceptedRecords array)
```typescript
      } as any);

      result.success = true;
```
**Shape:** Individual D1 insert object cast  
**Fix:** Define `InsertableUsageEvent` interface matching D1 `usage_events` schema; remove `as any`

---

### Line 147: DB client cast (bulk insert)
```typescript
    const { error: insertError } = await (db as any).from('usage_events').insert(acceptedRecords);
```
**Shape:** D1 client object cast  
**Fix:** Remove `as any` — `db` is already typed as D1 client from `createServerClient()`

---

## File: `src/lib/usage-metering/export.ts` (2 occurrences)

### Line 49: Query response cast
```typescript
  const { data: rawEvents, error: eventsError } = await query as any;
```
**Shape:** D1 RPC response (query chaining)  
**Fix:** Define explicit return type for query chain; avoid `as any` by typing query builder

---

### Line 125: CSV generation with untyped events
```typescript
export function generateCsv(events: unknown[]): string {
  if (!events || events.length === 0) {
    return '';
  }

  // Use new aggregator CSV generation with standardized fields
  const csvRows = generateCsvRows(events as any);
```
**Shape:** Function parameter cast  
**Fix:** Change to `events: Array<{ service_name: string; tokens_input?: number; ... }>` or use Zod validation

---

## File: `src/lib/usage-metering/tracker.ts` (2 occurrences)

### Line 30: License metadata cast
```typescript
    const { data: license, error } = await db
      .from('raas_licenses')
      .select('metadata')
      .eq('nonce', licenseNonce)
      .single() as { data: Pick<RaasLicense, 'metadata'> | null; error: Error | unknown };

    if (error || !license) {
      logger.debug('[External Customer ID] License not found', { licenseNonce });
      return null;
    }

    const metadata = license.metadata as Record<string, any> | null;
```
**Shape:** D1 response + metadata object cast  
**Fix:** D1 response: define type; metadata: change to `unknown` + validation:
```typescript
const metadata = (license.metadata as Record<string, unknown> | null);
```

---

### Line 146: Data extraction cast
```typescript
    return (data as { id: string }).id;
```
**Shape:** Function return cast  
**Fix:** Change to:
```typescript
if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string') {
  return data.id;
}
```

---

## File: `src/lib/usage-metering/usage-rollup-engine.ts` (4 occurrences)

### Line 80–82: Promise.all query response casts (3 casts)
```typescript
    const [hourlyRes, dailyRes, monthlyRes] = await Promise.all([
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', hourStart).lt('created_at', hourStart + 3600) as any),
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', dayStart).lt('created_at', dayStart + 86400) as any),
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', monthStart) as { data: UsageDataRow[] | null }),
    ]);
```
**Shape:** D1 query chain casts (hourly, daily use `as any`; monthly is properly typed)  
**Fix:** Define `type QuotaQuery = { data: UsageDataRow[] | null; error: unknown }`; apply consistently

---

### Line 145: Query response cast (getAggregatedSummary)
```typescript
  const { data: events, error } = await query as any;
```
**Shape:** D1 RPC response  
**Fix:** Type query chain result explicitly; remove `as any`

---

## File: `src/app/api/v1/usage/batch/route.ts` (1 occurrence)

### Line 57: API key lookup cast
```typescript
      .single() as any;

    if (error || !apiKeyRecord) {
```
**Shape:** D1 RPC response (raas_api_keys record)  
**Fix:** Type as `{ data: { user_id: string; license_nonce: string; is_active: boolean; tier?: string } | null; error: unknown }`  
**Validation:** Route uses Zod (`batchIngestionRequestSchema`) for body; API key lookup missing typed response

---

## File: `src/app/api/admin/licenses/audit/route.ts` (1 occurrence)

### Line 59: getAuditLogs parameter cast
```javascript
    } as any)

    return NextResponse.json({
```
**Shape:** Function parameter cast  
**Fix:** Define `GetAuditLogsParams` interface matching function signature:
```typescript
interface GetAuditLogsParams {
  action?: AuditAction;
  license_nonce?: string;
  page: number;
  limit: number;
  orderBy: string;
  orderDir: 'asc' | 'desc';
  startDate: number;
}
```
**Validation:** Route uses Zod for query params; function call lacks type safety

---

## Summary Table

| File | Line | Type | Shape | Priority |
|------|------|------|-------|----------|
| hourly-rollup.ts | 29 | Cast | D1 RPC response | High |
| hourly-rollup.ts | 158 | Cast | JSON column + obj | High |
| hourly-rollup.ts | 160 | Cast | D1 insert (double) | High |
| hourly-rollup.ts | 167 | Cast | Error object | High |
| daily-rollup.ts | 25 | Cast | D1 RPC response | High |
| daily-rollup.ts | 92 | Cast | JSON read (double) | High |
| daily-rollup.ts | 169 | Cast | JSON columns | High |
| daily-rollup.ts | 171 | Cast | D1 insert (double) | High |
| daily-rollup.ts | 178 | Cast | Error object | High |
| usage-kv-sync.ts | 82 | Cast | D1 license lookup | High |
| usage-kv-sync.ts | 132 | Cast | D1 insert record | High |
| usage-kv-sync.ts | 147 | Cast | DB client | High |
| export.ts | 49 | Cast | Query response | Medium |
| export.ts | 125 | Cast | Function param | Medium |
| tracker.ts | 30 | Cast | D1 response + metadata | High |
| tracker.ts | 146 | Cast | Data extraction | Medium |
| usage-rollup-engine.ts | 80–82 | Cast | Query chain (3x) | High |
| usage-rollup-engine.ts | 145 | Cast | Query response | High |
| batch/route.ts | 57 | Cast | D1 RPC response | High |
| audit/route.ts | 59 | Cast | Function param | Medium |

---

## Type Infrastructure Recommendations

### 1. Extend `src/lib/usage-metering/types.ts`
Add D1 row types + response wrappers:
```typescript
export interface UsageEventInsertable {
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  request_id: string | null;
  model_name: string | null;
  tier_at_request: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

export type D1Response<T> = { data: T | null; error: unknown };
```

### 2. Validation Patterns
- **D1 errors:** Always use `error instanceof Error` + `new Error(String(error))`
- **JSON columns:** Validate shape on read (Array.isArray, property checks)
- **Function parameters:** Define explicit interfaces; use Zod for API inputs

### 3. Route Handler Pattern
Both routes (`batch/route.ts`, `audit/route.ts`) use Zod for query/body validation. Extend to D1 query responses:
```typescript
const licenseSchema = z.object({
  user_id: z.string(),
  license_nonce: z.string(),
  is_active: z.boolean(),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).default('BASIC'),
});
```

---

## Quick Wins (Low Effort, High Impact)

1. **Global:** Replace `as any` on D1 insert objects — payload already typed
2. **Rollup files:** Extract double-casts (`:158, :160, :169, :171`) into single validation
3. **Export.ts:** Define `CsvEvent` interface; use in `generateCsvRows()`
4. **Tracker.ts:** Change `as Record<string, any>` to `as Record<string, unknown>`
5. **Audit route:** Create `GetAuditLogsParams` + pass typed object

