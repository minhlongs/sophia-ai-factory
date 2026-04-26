# Code Standards

## General Principles

1. **Turnkey First**: The code must support a "zero-config" experience. Always assume the user has not set up the environment variables manually.
   - **Bad**: Crashing if `OPENROUTER_API_KEY` is missing.
   - **Good**: Redirecting to `/setup-wizard` or showing a friendly UI prompt to configure the key.

2. **Simplicity Over Complexity (KISS)**:
   - Use Server Actions for data mutations.
   - Use standard Next.js fetch for data querying (with caching).
   - Avoid complex state management libraries (Redux/Zustand) unless absolutely necessary.

3. **Type Safety**:
   - Strict TypeScript mode is enabled.
   - No `any` types allowed.
   - Define interfaces for all API responses (especially from Airtable and n8n).
   - **Shared Row Interfaces:** For modules with multiple files (e.g., audit, raas, usage-metering), extract reusable database row types to `<module>/types.ts` as canonical source. Example: `AuditScheduledReportRow`, `AuditLicenseRow`, `AuditUsageEventRow` in `src/lib/audit/types.ts` eliminate type duplication and improve maintainability.

## Directory Structure & Naming

- **Components**: `src/components/{kebab-case-name}.tsx`
- **Hooks**: `src/hooks/use-{kebab-case-name}.ts`
- **Utilities**: `src/lib/{camelCaseName}.ts`
- **Page Routes**: `src/app/{route}/page.tsx`
- **API Routes**: `src/app/api/{route}/route.ts`

## Coding Conventions

### React Components
- Use **Functional Components** with named exports.
- Use `interface` for Props definition.
- **Server Components** by default. Add `'use client'` only when interactivity (hooks, event listeners) is needed.

```tsx
// src/components/feature-card.tsx
interface FeatureCardProps {
  title: string;
  description: string;
}

export function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold">{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

### Server Actions
- Place server actions in `actions.ts` files co-located with the feature or in `src/app/actions`.
- Always validate input data (e.g., using Zod).
- Handle errors gracefully and return typed result objects `{ success: boolean, data?: any, error?: string }`.

```tsx
// src/app/dashboard/actions.ts
'use server'

import { z } from 'zod';

const schema = z.object({
  topic: z.string().min(5)
});

export async function createScript(formData: FormData) {
  const parsed = schema.safeParse({ topic: formData.get('topic') });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  // ... logic
}
```

### Styling (Tailwind CSS 4)
- Use utility classes directly.
- For complex class logic, use the `cn()` utility (clsx + tailwind-merge).
- Use CSS variables for theming (defined in `globals.css`).

```tsx
import { cn } from '@/lib/utils';

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn("bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded", className)}
      {...props}
    />
  );
}
```

### Error Handling & Logging
- Use `try/catch` blocks in Server Actions and API routes.
- Log errors via `logger.error()` from `@/lib/logger` (routes through observability stack).
- `logger.error()` accepts: `(message, {error?, ...metadata}?, requestId?)` object form OR legacy `(message, error, metadata, requestId)` form for backward compatibility.
- Return user-friendly error messages to the UI.
- Use `toError()` from `@/lib/utils/to-error` to normalize thrown values into Error instances. `toError()` also recognizes Supabase `PostgrestError` shape — when given a `{ message: string, code?, details?, hint? }` object, it returns `new Error(message)` with `code`, `details`, and `hint` attached as own-properties for structured logging.

**Logging Best Practices:**
```typescript
import { logger } from '@/lib/logger';
import { toError } from '@/lib/utils/to-error';

// New object form (preferred)
logger.error('Operation failed', { error: err, userId, orgId }, requestId);

// Legacy form (still supported)
logger.error('Operation failed', err, { userId, orgId }, requestId);

// Normalize unknown errors (including PostgrestError) to Error
try {
  await someSupabaseCall();
} catch (e) {
  const err = toError(e); // Preserves { message, code, details, hint } if present
  logger.error('Supabase operation failed', { error: err, userId });
}
```

## Environment Variables
- Access environment variables **only on the server**.
- Prefix public variables with `NEXT_PUBLIC_`.
- Use `process.env.VARIABLE_NAME`.
- **Validation**: Check for required variables at startup or usage time.

## Git Workflow
- **Commit Messages**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branches**: `feature/{name}`, `fix/{issue}`.
- **PRs**: Require CI checks (Lint, Build, Test) to pass.

## Service Factory Pattern

We use a Service Factory pattern to decouple business logic from external service providers. This allows for easy swapping of providers (e.g., swapping D-ID for HeyGen) and robust testing via Mock Mode.

### 1. Define the Interface
All services must implement a strict interface defined in `src/lib/services/types.ts`.

```typescript
export interface IMyService {
  doSomething(params: Params): Promise<Result>;
}
```

### 2. Implement Real & Mock Versions
Create two implementations: one calling the real API, and one returning static/fake data.

- `src/lib/services/real/my-service.ts`: Real API calls.
- `src/lib/services/mock/my-service.ts`: Fake data (delays, sample responses).

### 3. Register in Factory
Update `src/lib/services/factory.ts` to instantiate the correct version based on `NEXT_PUBLIC_MOCK_AI_SERVICES`.

```typescript
export function getMyService(): IMyService {
  const useMock = process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true';
  return useMock ? new MockMyService() : new RealMyService();
}
```

## TypeScript Patterns

### HTTP Boundary Type Cast (Anti-Corruption Layer) — Standard Pattern

External HTTP requests/responses arrive as `unknown` after `.json()`. Use local interfaces at the boundary to type-cast wire contracts, separated from internal domain types. This is now an **established standard** across 8 verified instances (Phases 6–14), with 2 formalized sub-variants.

**Pattern: Local Interface + Cast + Fallback**

```typescript
// src/lib/heygen/heygen-client.ts
interface HeyGenVideoStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
}

async getVideoStatus(videoId: string): Promise<string> {
  const response = (await this.request(`/videos/${videoId}`)) as HeyGenVideoStatusResponse;
  return response.status ?? 'pending';
}
```

**Rationale:**
- External contracts (`HeyGenVideoStatusResponse`, `RaasSyncResponse`) describe the wire shape only
- Internal domain types (`VideoProcessingState`, `LicenseValidationResult`) model business logic
- Separation prevents external API changes from cascading into domain logic
- Type cast occurs at boundary; fallback (`?? 'pending'`) handles schema evolution gracefully

### Sub-Variant 1: Response-Body Type Cast (14 Instances)

Client receives response from server, casts `(await res.json()) as InterfaceName`.

**Canonical Examples:**
- Phase 6: `src/worker/lib/metering-reconciler-license-validator.ts` — `RaasSyncResponse` cast from `/api/license/sync` (single-endpoint)
- Phase 8: `src/lib/heygen/heygen-client.ts` — `HeyGenVideoStatusResponse` cast from HeyGen API (single-endpoint)
- Phase 9: `src/app/[locale]/dashboard/proposals/page.tsx` — `ProposalApiResponse` cast from `/api/proposals` (single-endpoint)
- Phase 10: `src/components/raas/api-key-create-modal.tsx` — `ApiKeysCreateResponse` cast from `/api/raas/api-keys/create` (single-endpoint)
- Phase 11 (cleanest): `src/components/admin/licenses/audit-log-table.tsx` — `AuditLogsResponse` cast from `/api/admin/licenses/audit-logs` (single-endpoint, strict YAGNI: omits unused server fields, minimal scope)
- **Phase 12 (dual-endpoint variant):** `src/components/quota/quota-usage-dashboard.tsx` — `QuotaUsageResponse` + `QuotaLimitResponse` casts from parallel `Promise.all([fetch1, fetch2])` on `/api/quota/usage` + `/api/quota/limits`. **Sub-pattern: DUAL-ENDPOINT** — 2 separate response interfaces for independent parallel fetches (do NOT merge into god-type); each interface typed individually, each cast applied at boundary with fallback.
- **Phase 13 (single-endpoint minimal):** `src/components/dashboard/referral-share-widget.tsx` — `ReferralGenerateResponse` cast from `/api/referral/generate`. Pattern variant: minimal 2-field interface (`code?`, `error?`), inline cast in event handler, clean YAGNI scope.
- **Phase 18 (async/await + snake_case API contract):** `src/components/raas/mcu-balance-widget.tsx` — `RaasUsageResponse` cast from `/api/raas/usage` endpoint via async/await block. Pattern variant: preserves snake_case API contract (`credit_balance?`, `monthly_limit?`), demonstrates response-body cast works in async/await context (prior Phases 6–13 used .then() chains or inline).
- **Phase 18 (async/await + optional nested object):** `src/components/raas/mission-launcher.tsx` — `MissionCreateResponse` interface cast from `/api/missions/create` endpoint via async/await. Pattern variant: optional nested `mission?: { id?: string }` + parallel `error?: string` + hardened `onSuccess(string)` signature with fallback `?? ''` for required string field. Demonstrates response-body cast handles complex optional structures + async/await blocks.
- **Phase 19 (dual-endpoint with individual fallbacks):** `src/components/raas/api-key-list.tsx` — DUAL-ENDPOINT variant with 2 parallel fetches (same as Phase 12 pattern). `Promise.all([fetch(...), fetch(...)])` → separate interfaces for each response, individual fallbacks per response. Demonstrates pattern consistency across Phase 12 and Phase 19 in dual-fetch scenarios.
- **Phase 21 (response-body + latent bug fix):** `src/components/admin/licenses/license-generator.tsx` — `CreateLicenseResponse` cast from POST `/api/admin/licenses/create` endpoint. Pattern variant: callback now passes narrowed `data.license` (`LicenseSummary`) instead of full response envelope — corrects latent type mismatch where callback signature expected `LicenseSummary` but received response wrapper.
- **Phase 21 (response-body + internal list):** `src/components/raas/mission-dashboard.tsx` — `MissionListResponse` cast from `/api/missions` endpoint. Pattern variant: mirrors Phase 12/19 dual-fetch pattern structure; establishes client-side contract before server implementation complete.
- **Phase 21 (response-body + discriminated union):** `src/components/raas/mission-detail.tsx` — `MissionDetailResponse` cast from `/api/missions/[id]` endpoint with discriminated-union fallback: `'mission' in data && data.mission ? data.mission : (data as MissionData)`. Pattern variant: demonstrates safe narrowing when API contract uses wrapper object or direct data shape interchangeably.

### Sub-Variant 2: Request-Body Type Cast (6 Instances)

Server API route receives request body from client, casts `(await request.json()) as InterfaceName`.

**Canonical Examples:**
- **Phase 14 (first request-body variant):** `src/app/api/coupons/apply/route.ts` — `CouponApplyRequest` cast from POST `/api/coupons/apply` body. Pattern variant: API boundary input validation, interface models optional fields (`code?`, `tier?`, `project?`) for flexible client submissions.
- **Phase 15 (second request-body variant):** `src/app/api/coupons/activate/route.ts` — `CouponActivateRequest` cast from POST `/api/coupons/activate` body. Same pattern shape: optional fields (`coupon?`, `tier?`), canonical example of request-body casting pattern reuse across sibling endpoints.
- **Phase 16 (third request-body variant, defensive `.catch()` pattern):** `src/app/api/usage/reconciliation/sync/route.ts` — `UsageReconciliationSyncRequest` cast from POST `/api/usage/reconciliation/sync` body. Defensive variant: request body is optional (cron/admin endpoint), wrapped with `.catch(() => ({}))` before cast to prevent parse failures from throwing. Interface has all-optional fields so empty object `{}` is structurally valid.
- **Phase 17 (fourth + fifth request-body variants, batch admin dunning):** `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` — `RestoreLicenseRequest` + `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` — `SuspendLicenseRequest`. Both apply defensive `.catch(() => ({}))` pattern. Both interfaces share identical shape (`reason?: string`) but maintained as separate types per HTTP boundary anti-corruption isolation principle (avoids god-type, each endpoint owns its contract). Canonical examples of defensive variant reuse across sibling admin endpoints.
- **Phase 20 (sixth request-body variant, graphql analytics):** `src/app/api/graphql/analytics/route.ts` — defensive `.catch(() => ({}))` wrapper on internal Promise boundary cast (secondary pattern instance in same file). Demonstrates Sub-Variant 2 generalizes to defensive boundaries beyond pure HTTP request-body scenarios.

**Defensive Variant Pattern** (Phase 16 / Phase 17):
```typescript
interface UsageReconciliationSyncRequest {
  timeRangeHours?: number;
  batchSize?: number;
}
const body = (await request.json().catch(() => ({}))) as UsageReconciliationSyncRequest;

// Phase 17 sibling pattern (separate types, shared shape)
interface RestoreLicenseRequest {
  reason?: string;
}
interface SuspendLicenseRequest {
  reason?: string;
}
const restoreBody = (await req.json().catch(() => ({}))) as RestoreLicenseRequest;
const suspendBody = (await req.json().catch(() => ({}))) as SuspendLicenseRequest;
```
Use this pattern when parse failure must not throw (e.g., cron jobs, admin operations with no required body). Ensure the cast target interface has all-optional fields so `{}` is structurally valid. For multi-endpoint batches with identical shape, create separate interfaces per endpoint rather than a shared god-type — maintains boundary isolation clarity.

**Pattern Maturity:** Established standard. Apply to all new HTTP boundary type-casts across the codebase. Distinguish between response-body (client reads server) and request-body (server reads client) variants. For multi-endpoint scenarios, maintain separate interfaces per endpoint rather than merging responses.

### Sub-Variant 3: Internal Promise<unknown> Type Cast (1 Instance — NEW)

The HTTP Boundary Cast pattern **generalizes beyond HTTP boundaries** to ANY `Promise<unknown>` boundary in typed code. When an internal async helper or async function returns `Promise<unknown>`, narrow at the **consumption site** (not the definition) with a local interface + inline `as` cast.

**Canonical Example (Phase 19 — NEW):**
- **Phase 19:** `src/app/api/graphql/analytics/route.ts` — `AnalyticsQueryResponse` cast applied to internal async helper return value. Pattern variant: same anti-corruption layer principle (define local interface inline, cast at boundary with `as AnalyticsQueryResponse`), but applied to **internal Promise<unknown>** rather than external HTTP response. The narrowing occurs where the promise result is consumed, not where it's created. Interface includes only fields consumed at the call site (YAGNI: don't replicate full return shape of the helper). This pattern is generalizable to any `Promise<unknown>` → typed code boundary.

**General Pattern:**
```typescript
// Internal async helper returns Promise<unknown> (common in type-erased patterns)
async function getAnalyticsData(query: QueryInput): Promise<unknown> {
  // ...implementation
}

// At consumption site: define local interface, cast with as
interface AnalyticsQueryResponse {
  result?: Record<string, number>;
  error?: string;
}

const data = (await getAnalyticsData(params)) as AnalyticsQueryResponse;
```

Prefer this approach to modifying the helper's return type annotation (which may affect multiple callsites or break abstraction). The interface is defined **at the narrowest consumption point** with only the fields actually used (YAGNI principle).

### Sub-Variant 4: DB-Result Cast (16 Instances)

Casting Supabase/D1 query results from `unknown` (via `ReturnType<typeof db.from>` helper) to local DB-row interface at narrow consumption point.

**Canonical Examples:**
- **Phase 20:** `src/app/api/admin/licenses/[id]/reactivate/route.ts` — `ReactivatedLicenseRow` interface cast. Pattern: rename pattern (`data` → `rawData` distinguishes wire result from domain object), nullable cast (`as ReactivatedLicenseRow | null`) for `.single()` returns, optional-chained reads with fallbacks (`license?.expiresAt ?? null`). Only consumed fields modeled in interface (YAGNI: don't replicate full DB schema). Defensive fallbacks prevent null-dereference errors.
- **Phase 21 (roi calculation):** `src/lib/analytics/roi-calculator.ts` — `RaasLicenseRoiRow` + `UsageEventCreditRow` interfaces cast at 4 query sites. Pattern: 2-interface approach separates license metrics from event aggregation; defensive nonce filtering at L163 (`if (!license.nonce) continue`) + optional-chained reads with fallbacks; type-narrowed metadata reads via `.filter((n): n is string => !!n)` for guaranteed string array before iteration. Demonstrates pattern scales to multi-query aggregation scenarios.
- **Phase 21 (violation analytics):** `src/lib/analytics/queries/violation-queries.ts` — `ViolationRow` interface cast at 2 query sites with `toError()` logging wrapper. Pattern: combines DB-Result Cast with Logger Error Handling (see below); enum coercions (`as ViolationType`, `as SeverityLevel`) at map boundary; defensive null→undefined conversions (`resolved_at: v.resolved_at ?? undefined`) for domain contract alignment.
- **Phase 21 (usage summary):** `src/app/api/billing/usage-summary/route.ts` — `UsageSummaryLicenseRow` interface cast from license SELECT query. Pattern: minimal 3-field interface (YAGNI scope), optional-chained threshold reads.
- **Phase 22 (invoice generator):** `src/lib/raas/raas-invoice-generator.ts` — `RaasLicense` interface cast at 4 query sites (2 SELECT via `.single()`, 2 UPDATE via `.update().select().single()`). Pattern: for subscription lifecycle (reactivate/revoke), 2 functions use double-cast pattern `as unknown as RaasLicense` on UPDATE chains. Demonstrates pattern generalizes to write-then-read scenarios where Supabase return type doesn't structurally overlap with domain row interface. Added `toError()` wrapper for 2 UPDATE error logs.
- **Phase 22 (quota overage API):** `src/app/api/quota/overage-events/route.ts` — `QuotaLicenseRow` interface cast from license SELECT. Pattern: documents D1 client limitation — D1 `.single<T>()` does NOT support generic type arguments (TS2558 error with `.single<{nonce: string}>()`); fix: cast with `as unknown as QuotaLicenseRow`. Canonical anti-example of unsupported generic argument on `.single()` chain.

**General Pattern:**
```typescript
interface ReactivatedLicenseRow {
  expiresAt: number | null;
  status?: string;
}

const rawData = (await db.from('licenses').select('*').eq('id', licenseId).single()) as ReactivatedLicenseRow | null;
const expiresAt = rawData?.expiresAt ?? null;
const status = rawData?.status ?? 'active';
```

**For Nullable Joined Fields (NEW — Phase 21):**
When aggregating from nullable joined fields (e.g., `nonce?: string`), use two-step pattern:
1. Guard with early-continue at iteration: `if (!field) continue`
2. Filter array for type narrowing: `.filter((n): n is string => !!n)` for guaranteed typed array before iteration

```typescript
// In roi-calculator.ts L163, L180
const licenses = rawLicenses.filter((l) => l.nonce); // Type: (RaasLicenseRoiRow & { nonce: string })[]
const noncesList = licenses.map(l => l.nonce);
```

**For .update().select().single() Chain (NEW — Phase 22):**
When chaining `.update().select().single()` on Supabase, the return type may not structurally overlap with the row interface. Use **double-cast pattern** `as unknown as InterfaceName` to avoid TS2352 (comparison with incompatible type):

```typescript
// src/lib/raas/raas-invoice-generator.ts L66
const rawUpdated = await db
  .from('raas_licenses')
  .update({ status: 'active' })
  .eq('id', licenseId)
  .select()
  .single();

return rawUpdated as unknown as RaasLicense;  // Double-cast avoids TS2352
```

Rationale: Supabase's query builder returns `Promise<unknown>` from `.single()` without full type information about the SELECT shape. A direct `as RaasLicense` cast may trigger TS2352 (no structural overlap detected). The workaround: cast to `unknown` first (always valid), then to the target interface. Runtime behavior unchanged; pure TypeScript workaround for query builder limitations.

**D1 Client `.single()` Limitation (NEW — Phase 22):**
The D1 query chain client does NOT support generic type arguments on `.single<T>()`. Attempting `db.from('table').select().single<{nonce: string}>()` causes TS2558 ("Object is of type unknown").

**Anti-Example (DO NOT DO):**
```typescript
// TS2558 error — D1 doesn't support generics on .single()
const result = await db
  .from('licenses')
  .select('nonce')
  .eq('id', id)
  .single<{nonce: string}>(); // ← ERROR
```

**Canonical Fix (Phase 22):**
```typescript
// src/app/api/quota/overage-events/route.ts L96
interface QuotaLicenseRow {
  nonce: string | null;
  status: string;
}

const rawLicense = await db
  .from('licenses')
  .select('*')
  .eq('id', licenseId)
  .single();

const license = rawLicense as QuotaLicenseRow | null;
```

Use interface cast pattern instead of generic argument. This is a known D1 client limitation; all D1 + Supabase queries should use cast-at-consumption-point rather than generic type parameters on the `.single()` call itself.

Distinct from HTTP boundary casts: DB results are strongly typed by schema but TypeScript cannot infer `ReturnType<typeof db.from>` without manual interface definition at point of use. Cast occurs at **narrowest consumption point**, interfaces omit unused fields, all reads optional-chained. 16 instances codebase-wide (Phase 22 adds 5 new + Phase 21 7 new + Phase 20 1 + 3 pre-existing).

---

## Logger Error Wrapping Pattern

When logging errors from Supabase/D1 query results or caught exceptions, normalize error objects using the `toError()` helper from `@/lib/utils/to-error.ts`.

**Canonical Pattern (Phase 21):**

```typescript
import { logger } from '@/lib/logger';
import { toError } from '@/lib/utils/to-error';

try {
  const result = await db.from('table').select('*');
  if (!result) throw new Error('Query returned null');
} catch (error) {
  const err = toError(error);  // Normalizes to Error, preserves PostgrestError shape
  logger.error('Query failed', { error: err, userId }, requestId);
}
```

**Why `toError()` Matters:**

`toError()` recognizes Supabase `PostgrestError` shape: `{ message: string, code?, details?, hint? }`. Instead of collapsing to `Error("[object Object]")`, it:
1. Returns `new Error(message)` with preserved message
2. Attaches `code`, `details`, `hint` as own-properties for structured logging downstream
3. Falls back to string coercion for non-Error/non-PostgrestError values

**Canonical Sites (Phase 21+):**
- `src/lib/analytics/queries/violation-queries.ts` — 2 query error sites wrapped with `toError()`
- `src/app/api/admin/licenses/[id]/reactivate/route.ts` — logger at L71 wrapped with `toError()`
- `src/lib/raas/raas-invoice-generator.ts` — 2 UPDATE error sites (L50, L113) wrapped with `toError()` for Supabase QueryError normalization
- Any route or function catching query/async errors should use `toError()` before `logger.error()`

**Documentation Reference:**
See `Error Handling & Logging` section above for full signature and usage of `logger.error()`.

---

## Testing Standards
- **Framework**: Vitest + React Testing Library.
- **Requirement**: Core business logic and server actions must have unit tests.
- **Coverage**: Aim for high coverage on `src/lib` validation and utility functions.
- **Reference**: See `docs/testing-guide.md` for detailed instructions.
