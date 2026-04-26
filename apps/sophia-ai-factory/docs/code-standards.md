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

### Zod v4 API Migration

Zod v4 removed the `.errors` property from ZodError. Use `.issues` instead for accessing validation errors.

**Migration Pattern (Phase 31):**

```typescript
// OLD (Zod v3)
if (!parsed.success) {
  const firstError = parsed.error.errors[0];  // ✗ Property 'errors' does not exist
}

// NEW (Zod v4+)
if (!parsed.success) {
  const firstError = parsed.error.issues[0];  // ✓ Correct
  const errorCode = firstError?.code;
  const errorMessage = firstError?.message;
}
```

**Applied Across 6 Instances (Phase 31):**
- Validation services (OpenRouter, ElevenLabs, D-ID key validators)
- Admin campaign routes (form validation)
- Campaign creation endpoints
- Client-side campaign form validation

Use `.issues` for all new Zod v4+ validation error handling.

### Recharts TooltipProps Intersection Pattern

Recharts upstream `TooltipProps<ValueType, NameType>` is missing optional `payload` and `label` fields in type definitions. Use intersection type pattern for proper type safety in custom tooltip components (Phase 34).

```typescript
// Custom tooltip props intersection
type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ value: number; name: string; color?: string }>;
  label?: string;
};

export function CustomTooltip({ payload, label, ...props }: CustomTooltipProps) {
  return (
    <div className="bg-white p-2 border rounded">
      {label && <p className="font-bold">{label}</p>}
      {payload?.map(entry => <p key={entry.name}>{entry.name}: {entry.value}</p>)}
    </div>
  );
}
```

Applied in 4 analytics chart components (src/components/analytics/*).

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

### Sub-Variant 2: Request-Body Type Cast (7 Instances) — CANONICAL PATTERN

Server API route receives request body from client, casts `(await request.json()) as InterfaceName`.

**Canonical Examples:**
- **Phase 14 (first request-body variant):** `src/app/api/coupons/apply/route.ts` — `CouponApplyRequest` cast from POST `/api/coupons/apply` body. Pattern variant: API boundary input validation, interface models optional fields (`code?`, `tier?`, `project?`) for flexible client submissions.
- **Phase 15 (second request-body variant):** `src/app/api/coupons/activate/route.ts` — `CouponActivateRequest` cast from POST `/api/coupons/activate` body. Same pattern shape: optional fields (`coupon?`, `tier?`), canonical example of request-body casting pattern reuse across sibling endpoints.
- **Phase 16 (third request-body variant, defensive `.catch()` pattern):** `src/app/api/usage/reconciliation/sync/route.ts` — `UsageReconciliationSyncRequest` cast from POST `/api/usage/reconciliation/sync` body. Defensive variant: request body is optional (cron/admin endpoint), wrapped with `.catch(() => ({}))` before cast to prevent parse failures from throwing. Interface has all-optional fields so empty object `{}` is structurally valid.
- **Phase 17 (fourth + fifth request-body variants, batch admin dunning):** `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` — `RestoreLicenseRequest` + `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` — `SuspendLicenseRequest`. Both apply defensive `.catch(() => ({}))` pattern. Both interfaces share identical shape (`reason?: string`) but maintained as separate types per HTTP boundary anti-corruption isolation principle (avoids god-type, each endpoint owns its contract). Canonical examples of defensive variant reuse across sibling admin endpoints.
- **Phase 20 (sixth request-body variant, graphql analytics):** `src/app/api/graphql/analytics/route.ts` — defensive `.catch(() => ({}))` wrapper on internal Promise boundary cast (secondary pattern instance in same file). Demonstrates Sub-Variant 2 generalizes to defensive boundaries beyond pure HTTP request-body scenarios.
- **Phase 27 (seventh + CANONICAL webhook pattern):** `src/app/api/webhooks/telegram/route.ts` — `TelegramUpdate` cast from POST `/api/webhooks/telegram` body. **THE canonical Sub-Variant 2 pattern for ALL HTTP request-body parsing across both internal AND webhook endpoints.** Defensive `.catch(() => ({}))` wrapper on request.json() ensures malformed JSON gracefully returns empty object rather than throwing, preventing Telegram retry storms. Interface models only consumed fields: optional `callback_query?: { data?: string }` (for inline keyboard button presses) + optional `message?: { text?: string; chat?: { id?: number | string } }` (for text commands). Demonstrates pattern robustness in protected-flow webhook context where payload shape varies by Telegram update type. Behavior change: malformed JSON now returns 200 OK (was 500 Internal Server Error) — more graceful, Telegram-compliant, prevents unnecessary retries.
- **Phase 32 (eighth + ninth variants, batch alerts routes):** `src/app/api/alerts/preferences/route.ts` — `AlertPreferencesPayload` cast from PUT body; `src/app/api/alerts/rules/route.ts` — `AlertRulePayload` cast from POST body. Both apply defensive `.catch(() => ({}))` pattern. `AlertPreferencesPayload` models optional preference fields (`emailEnabled?`, `smsEnabled?`, `webhookEnabled?`); `AlertRulePayload` models optional rule-configuration fields (`thresholdPercent?`, `enabled?`, `channels?`). Demonstrates Sub-Variant 2 consistency: empty object from `.catch()` → undefined fields → existing validation logic (e.g., `if (!thresholdPercent || thresholdPercent < 0 || ...)`) rejects missing required fields. Canonical example of Sub-Variant 2 on PUT/POST endpoints with defensive fallback ensuring graceful degradation over throwing errors.

**Defensive Variant Pattern** (Phase 16 / Phase 17 / Phase 27):
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

// Phase 27 CANONICAL WEBHOOK PATTERN — apply to ALL request-body parsing
interface TelegramUpdate {
  callback_query?: {
    data?: string;
  };
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
  };
}
const body = (await request.json().catch(() => ({}))) as TelegramUpdate;
// Malformed JSON → empty {}, type-safe guards on optional chains prevent crashes
```

Use this pattern when parse failure must not throw (e.g., cron jobs, admin operations, webhook endpoints with no guaranteed body structure). Ensure the cast target interface has all-optional fields so `{}` is structurally valid. For multi-endpoint batches with identical shape, create separate interfaces per endpoint rather than a shared god-type — maintains boundary isolation clarity. **Sub-Variant 2 with `.catch(() => ({}))` defensive fallback is the canonical pattern for ALL HTTP request-body parsing across both internal AND webhook endpoints.**

**Pattern Maturity:** **CANONICAL STANDARD.** Apply to all new HTTP boundary type-casts across the codebase. Distinguish between response-body (client reads server) and request-body (server reads client) variants. For multi-endpoint scenarios, maintain separate interfaces per endpoint rather than merging responses. Phase 27 confirms pattern reliability in protected-flow webhook context.

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

### Sub-Variant 4: DB-Result Cast (25 Instances)

Casting Supabase/D1 query results from `unknown` (via `ReturnType<typeof db.from>` helper) to local DB-row interface at narrow consumption point. **Phase 40 doctrine:** Prefer canonical types from `lib/supabase/types.ts` when available; inline interfaces only as fallback for tables without canonical types. Example: `OverageEventRow` now imported centrally rather than redefined inline across 3 files.

**Canonical Examples:**
- **Phase 20:** `src/app/api/admin/licenses/[id]/reactivate/route.ts` — `ReactivatedLicenseRow` interface cast. Pattern: rename pattern (`data` → `rawData` distinguishes wire result from domain object), nullable cast (`as ReactivatedLicenseRow | null`) for `.single()` returns, optional-chained reads with fallbacks (`license?.expiresAt ?? null`). Only consumed fields modeled in interface (YAGNI: don't replicate full DB schema). Defensive fallbacks prevent null-dereference errors.
- **Phase 21 (roi calculation):** `src/lib/analytics/roi-calculator.ts` — `RaasLicenseRoiRow` + `UsageEventCreditRow` interfaces cast at 4 query sites. Pattern: 2-interface approach separates license metrics from event aggregation; defensive nonce filtering at L163 (`if (!license.nonce) continue`) + optional-chained reads with fallbacks; type-narrowed metadata reads via `.filter((n): n is string => !!n)` for guaranteed string array before iteration. Demonstrates pattern scales to multi-query aggregation scenarios.
- **Phase 21 (violation analytics):** `src/lib/analytics/queries/violation-queries.ts` — `ViolationRow` interface cast at 2 query sites with `toError()` logging wrapper. Pattern: combines DB-Result Cast with Logger Error Handling (see below); enum coercions (`as ViolationType`, `as SeverityLevel`) at map boundary; defensive null→undefined conversions (`resolved_at: v.resolved_at ?? undefined`) for domain contract alignment.
- **Phase 21 (usage summary):** `src/app/api/billing/usage-summary/route.ts` — `UsageSummaryLicenseRow` interface cast from license SELECT query. Pattern: minimal 3-field interface (YAGNI scope), optional-chained threshold reads.
- **Phase 22 (invoice generator):** `src/lib/raas/raas-invoice-generator.ts` — `RaasLicense` interface cast at 4 query sites (2 SELECT via `.single()`, 2 UPDATE via `.update().select().single()`). Pattern: for subscription lifecycle (reactivate/revoke), 2 functions use double-cast pattern `as unknown as RaasLicense` on UPDATE chains. Demonstrates pattern generalizes to write-then-read scenarios where Supabase return type doesn't structurally overlap with domain row interface. Added `toError()` wrapper for 2 UPDATE error logs.
- **Phase 22 (quota overage API):** `src/app/api/quota/overage-events/route.ts` — `QuotaLicenseRow` interface cast from license SELECT. Pattern: documents D1 client limitation — D1 `.single<T>()` does NOT support generic type arguments (TS2558 error with `.single<{nonce: string}>()`); fix: cast with `as unknown as QuotaLicenseRow`. Canonical anti-example of unsupported generic argument on `.single()` chain.
- **Phase 23 (internal usage query API):** `src/app/api/internal/usage/query/route.ts` — `CustomerLicenseRow`, `NonceLicenseRow`, `RawUsageEventRow` interfaces cast at 4 query sites. Pattern: 3-interface approach separates license lookups by lookup method (customer_id, stripe_customer_id, nonce) from event aggregation; all nullable casts for `.single()` returns; optional-chained reads with fallbacks for defensive null handling. Removed 3 unsupported `.single<{...}>()` generic arguments following D1 limitation (cumulative removals: Phase 22 ×1 + Phase 23 ×3 = 4 total).
- **Phase 23 (usage summary API):** `src/app/api/usage/summary/route.ts` — `UserProfileRoleRow`, `LicenseOwnerRow` interfaces cast at 2 query sites. Pattern: defensive license ownership verification with nullable casts; optional-chained metadata reads with fallbacks. Removed 2 unsupported `.single<{...}>()` generic arguments (cumulative removals: Phase 22 ×1 + Phase 23 ×5 = 6 total generic-removal instances).

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

**For .update().select().single() Chain (Phase 22, Canonical — Phase 35 MASS APPLIED):**
When chaining `.update().select().single()` on Supabase/D1, the return type may not structurally overlap with the row interface. Use **double-cast pattern** `as unknown as InterfaceName` to avoid TS2352 (comparison with incompatible type):

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

**Phase 35 MILESTONE — Double-Cast Mass Application:**
Phase 35 B2 applied this pattern canonically across entire codebase (41 cast sites across 25 files), achieving **100% TS2352 elimination**: 38 → 0 errors. All database mutation operations, dual-interface aggregations, and SELECT chains now consistently use double-cast pattern at consumption point. **This pattern is CANONICAL — use it for all Supabase/D1 `.single()` and `.update().select().single()` chains going forward.**

**D1 Client `.single()` Limitation (NEW — Phase 22, Extended Phase 23):**
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

**Cumulative Status (Phase 23):** 5 unsupported `.single<T>()` generic arguments have been removed across phases 22–23 (Phase 22 ×1, Phase 23 ×5 = 6 total instances eliminated). No new TS2558 errors introduced.

Distinct from HTTP boundary casts: DB results are strongly typed by schema but TypeScript cannot infer `ReturnType<typeof db.from>` without manual interface definition at point of use. Cast occurs at **narrowest consumption point**, interfaces omit unused fields, all reads optional-chained. **Cumulative instances: ~50+ codebase-wide.** Phase 35 mass-applied double-cast pattern across 41 sites (25 files) for 100% TS2352 elimination. Pre-Phase 35 distribution: Phase 23 ×6, Phase 22 ×5, Phase 21 ×7, Phase 20 ×1, pre-existing ×3. Phase 35 adds: raas-invoice-generator ×4, quota/overage ×1, admin dunning ×2, usage export ×2, reconciliation ×1, alerts ×1, mission-detail ×1, roi-calculator ×4, violation-queries ×2, usage-summary ×1, license-generator ×1, graphql/analytics ×3, internal/usage/query ×5, mission-dashboard ×3, mission-launcher ×1, api-key-list ×2, mcu-balance ×1, referral-share ×1, quota-status ×2 = 41 new sites.

**For Better Auth User Type Assertion (DEPRECATED — Phase 23, REMOVED Phase 24):**

~~Legacy pattern (Phase 23 documentation):~~ When accessing `user_metadata` field via defensive type assertion, the pattern was:

```typescript
// DEPRECATED — DO NOT USE (Phase 23 usage pattern, eliminated in Phase 24)
const userMeta = (user as { user_metadata?: { role?: string } }).user_metadata;
const userRole = userMeta?.role ?? 'default_role';
```

**Why Deprecated (Phase 24):** Better Auth `User` type has no `user_metadata` field at runtime — this was defensive code from pre-migration era. The pattern is dead code (zero references post-Phase 24 cleanup). See "Direct `user.role` Access (CANONICAL — Phase 24)" immediately below.

---

**Better Auth User Type — Direct `role` Access (CANONICAL — Phase 24):**

After Better Auth migration completion (Phase 24), access user role directly from `User` object:

```typescript
// Correct (Phase 24+)
const user = await getCurrentUser(); // Better Auth User type
const isAdmin = user.role === 'admin';

// Also correct (with fallback for type safety)
const userRole = user.role ?? 'user';  // Better Auth User.role?: string
```

**Why Direct Access Works:** Better Auth `User` type (defined at `@/lib/db/client.ts:177-183`) exposes `role?: string` directly. The `getCurrentUser()` helper (src/lib/better-auth-session.ts:43) guarantees a populated string with `'user'` fallback: `role: (user.role as string) ?? 'user'`. Defensive `user_metadata` branch was migration cleanup; once migration complete, direct `user.role` access is canonical.

**Migration Cleanup (Phase 24 Completed):**
- ✅ Removed dead `(user as { user_metadata?: { ... } }).user_metadata?.role` pattern from 6 sites
- ✅ All admin-auth checks simplified to `user.role === 'admin'`
- ✅ TS2339 errors (property 'user_metadata' does not exist) eliminated
- Files cleaned: `admin/dunning/{suspend,route,restore}`, `usage/export/{get,post}-handler`, `usage/summary`

**Scope:** Use `user.role === 'admin'` for all new admin checks. The `user_metadata` assertion pattern is DEPRECATED and should not be used for new code.

---

## Admin Auth Helper Pattern (Phase 25)

Consolidate repetitive admin-authorization checks across multiple routes using the `isUserAdmin()` helper. This eliminates ~9-line inline DB-fetch + role-check duplication and provides a single point for admin-access logic.

**Canonical Location:** `src/lib/auth/is-user-admin.ts`

**Canonical Implementation:**

```typescript
import { User } from '@/lib/db/client';
import { createServerClient } from '@/lib/db/client';

export async function isUserAdmin(user: User): Promise<boolean> {
  // Fast path: Check session role first (cheap, from Better Auth)
  if (user.role === 'admin') {
    return true;
  }

  // Fallback: DB lookup if session role is falsy
  if (!user.id) return false;

  const db = createServerClient();
  const { data: userData } = await db
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Cast with Sub-Variant 4 pattern for type safety
  interface UserProfileRoleRow {
    role?: string;
  }
  const userProfile = userData as UserProfileRoleRow | null;

  return userProfile?.role === 'admin';
}
```

**Canonical Usage Pattern:**

All admin-protected routes use this pattern:

```typescript
// src/app/api/admin/dunning/[licenseNonce]/route.ts
import { isUserAdmin } from '@/lib/auth/is-user-admin';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Canonical admin check
  if (!(await isUserAdmin(user))) {
    return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
  }

  // Admin-only logic continues...
}
```

**Why This Pattern:**

1. **DRY Consolidation:** Replaces ~9-line inline DB-fetch + role-check duplicated across 6 admin handlers
2. **Fast Path Optimization:** Checks cheap session `user.role` first before hitting DB
3. **Fallback Robustness:** DB lookup only if session role falsy (migration edge-cases, session-refresh delays)
4. **Type Safety:** Uses Sub-Variant 4 cast (`UserProfileRoleRow` interface) for typed DB reads
5. **Single Responsibility:** All admin-access logic centralized, easier to audit/maintain

**Applied Instances (Phase 25):**

- `src/app/api/admin/dunning/[licenseNonce]/route.ts` — POST handler refactored
- `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` — POST handler refactored
- `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` — POST handler refactored
- `src/app/api/usage/export/usage-export-get-handler.ts` — GET handler refactored
- `src/app/api/usage/export/usage-export-post-handler.ts` — POST handler refactored (userData fetch kept separate, used for audit-receipt tier field)
- `src/app/api/usage/summary/route.ts` — GET handler refactored

**Phase 26 Extension — `isUserAdminWithRole()` Variant:**

Phase 26 extracted a new variant `isUserAdminWithRole(user): Promise<{isAdmin: boolean, dbRole: string | null}>` for callers needing both the admin boolean AND the user's role string (e.g., audit logs, tier assignment). This eliminates redundant double DB fetches.

**Canonical Implementation (Phase 26):**

```typescript
import { User } from '@/lib/db/client';
import { createServerClient } from '@/lib/db/client';

export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  // Fast path: Check session role first (cheap, from Better Auth)
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' }; // Synthesized from session
  }

  // Fallback: DB lookup if session role is falsy
  if (!user.id) {
    return { isAdmin: false, dbRole: null };
  }

  const db = createServerClient();
  const { data: userData } = await db
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Cast with Sub-Variant 4 pattern for type safety
  interface UserProfileRoleRow {
    role?: string;
  }
  const userProfile = userData as UserProfileRoleRow | null;

  const dbRole = userProfile?.role ?? null;
  return { isAdmin: dbRole === 'admin', dbRole };
}

// Phase 25 version now delegates (DRY)
export async function isUserAdmin(user: User): Promise<boolean> {
  const { isAdmin } = await isUserAdminWithRole(user);
  return isAdmin;
}
```

**New Usage — When Caller Needs Role String:**

```typescript
// src/app/api/usage/export/usage-export-post-handler.ts (Phase 26)
import { isUserAdminWithRole } from '@/lib/auth/is-user-admin';

const { isAdmin, dbRole } = await isUserAdminWithRole(user);
if (!isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Audit receipt now uses dbRole (typed string | null) instead of separate userData fetch
const auditReceipt = {
  tier: dbRole || 'user', // Properly typed, no unknown coercion
  // ... other audit fields
};
```

**Why This Variant:**

1. **Eliminates double DB call** — When a route needs both admin-check AND role for audit/tier logic, use tuple return instead of separate queries
2. **Type safety** — `dbRole` is properly typed (`string | null`), not `unknown` from raw query result
3. **Backward compatible** — Existing `isUserAdmin()` callers unchanged (delegates to variant)
4. **Applied Sites (Phase 26):**
   - `src/app/api/usage/export/usage-export-post-handler.ts` — Uses `isUserAdminWithRole()` for both check + audit tier field

**For New Routes Needing Both Admin + Role:**

When a route needs admin-check AND the user's role for audit logging or tier assignment, use `isUserAdminWithRole()` instead of making separate queries. This is the modern pattern post-Phase 26.

**Special Note — `usage-export-post-handler.ts` (Updated Phase 26):**

Previously kept a separate `userData` fetch. Phase 26 consolidated this via `isUserAdminWithRole()`, which returns both the boolean and the role string in one DB call. The audit-receipt `tier` field now uses `dbRole` from the helper tuple instead of a separate query.

```typescript
// Phase 26: Consolidated pattern
const { isAdmin, dbRole } = await isUserAdminWithRole(user);
if (!isAdmin) return 403;

const auditReceipt = {
  tier: dbRole || 'user', // From helper, no separate fetch needed
};
```

**For New Admin Routes:**

When adding new admin-protected routes, use `isUserAdmin()` for simple boolean checks. If the route also needs the user's role string for audit/tier logic, use `isUserAdminWithRole()` instead to avoid double DB calls. This maintains consistency and ensures efficient DB access patterns.

---

## next-intl Formatter Type Pattern (Phase 29)

Use the canonical type alias pattern when accepting a formatter result as a prop from `next-intl/server`. This replaces broken `import type { IntlFormat } from 'intl'` (non-existent export).

**Problem:** The `intl` npm package does not export an `IntlFormat` type. Importing it causes TS2307 (module not found) and creates a latent runtime bug if code tries to narrow on the type.

**Canonical Solution:**

```typescript
// src/components/campaign-details-sidebar.tsx
import type { getFormatter } from "next-intl/server";

// Define the type locally at component scope
type IntlFormat = Awaited<ReturnType<typeof getFormatter>>;

interface CampaignDetailsSidebarProps {
  campaignId: string;
  format: IntlFormat;  // Properly typed formatter result
}

export function CampaignDetailsSidebar({ format, ...props }: CampaignDetailsSidebarProps) {
  // Safe to call formatter methods
  const dateStr = format.dateTime(new Date());
  // ...
}
```

**Why This Pattern:**

1. **Tracks `getFormatter()` signature** — `Awaited<ReturnType<typeof getFormatter>>` automatically reflects upstream next-intl changes
2. **Type-safe narrowing** — Component receives result of `await getFormatter()` from parent; type alias ensures full type information
3. **Zero runtime cost** — Type alias is purely structural; no codegen or runtime overhead
4. **Tested across components** — Used in campaign-details-sidebar.tsx and campaign-header.tsx (Phase 29); both components render without type errors

**When to Use:**

When a server component calls `const format = await getFormatter()` and passes the result to a child component as a prop, define a local type alias in the child using this pattern instead of importing a non-existent `IntlFormat` type.

**Phase 29 Reference:** Eliminated TS2304 + TS2307 errors in 2 campaign UI components by replacing broken import with this pattern.

---

## Vitest setup file convention (Phase 29)

Even when `vitest.config.ts` sets `globals: true`, explicitly import `vi` in `src/test/setup.tsx` to satisfy TypeScript. The `globals: true` flag enables runtime global injection, but TypeScript still requires ambient type declaration or explicit import for type checking.

**Pattern:**

```typescript
// src/test/setup.tsx
import { vi } from 'vitest';  // Explicit import, line 6
import { beforeAll, afterEach } from 'vitest';

// Global mocks below
vi.mock('@/lib/db/client', () => ({
  createServerClient: () => kvMock,
}));

// ... rest of setup
```

**Why This Matters:**

1. **TypeScript correctness** — `tsconfig.json` does NOT include `"types": ["vitest/globals"]`, so ambient `vi` is undefined at type-check time
2. **Explicit over implicit** — Explicit import makes test files self-documenting; easier for maintainers to understand setup dependencies
3. **No conflict with runtime injection** — With `globals: true` AND explicit import, both resolve to the same `vi` instance; no duplication

**When `globals: true` Alone Isn't Enough:**

TypeScript type-checking happens before runtime. The `globals: true` flag in vitest.config.ts tells Vitest to inject globals at runtime, but doesn't automatically register them with TypeScript. Without either `"types": ["vitest/globals"]` in tsconfig or explicit `import { vi }`, TypeScript emits TS2304 (vi is not defined).

**Phase 29 Reference:** Added explicit `import { vi } from 'vitest'` to setup.tsx, eliminating 27 TS2304 errors across all test files that rely on the setup.

---

## Dead Export Detection in API Routes (Phase 24)

Next.js App Router **only recognizes HTTP-method-named exports** in route files: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`. All other exports are unreachable code and should be removed.

**Pattern:**

```typescript
// src/app/api/quota/overage-events/route.ts

export async function GET(request: Request) {
  // ✓ Recognized by Next.js, will be invoked
}

export async function GETStatus() {
  // ✗ UNREACHABLE — not an HTTP method
  // ✗ Should be deleted or moved to a library file
}
```

**Detection & Cleanup (Phase 24):**

When auditing API routes:
1. **Identify non-standard exports** via grep or code review
2. **Verify no callers exist** across the entire codebase (grep for function name)
3. **Delete** the unreachable export once verified
4. **Remove orphaned imports** (e.g., `getQuotaStatus` import if only used by `GETStatus()`)

Example from Phase 24: `src/app/api/quota/overage-events/route.ts` had an unreachable `GETStatus` function (only exports HTTP-method names now). Deletion eliminated orphaned helper function that would never execute.

**Why This Matters:** Dead exports:
- Inflate code size with unused logic
- Create confusion for future maintainers (suggests API contract that doesn't exist)
- May suggest a mismatch between intended API structure and actual routes

---

## Logger Error Wrapping Pattern

**CANONICAL PATTERN** — All error objects passed to `logger.error()` MUST be normalized via `toError()` helper before logging. This is now the project-wide standard across ~28+ instances (Phase 28 mass refactor).

When logging errors from Supabase/D1 query results or caught exceptions, normalize error objects using the `toError()` helper from `@/lib/utils/to-error.ts`.

**Canonical Pattern (Phase 21+, Standardized Phase 28):**

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

`toError()` recognizes Supabase/PostgreSQL `PostgrestError` shape: `{ message: string, code?, details?, hint? }`. Instead of collapsing to `Error("[object Object]")`, it:
1. Returns `new Error(message)` with preserved message
2. Attaches `code`, `details`, `hint` as own-properties for structured logging downstream
3. Falls back to string coercion for non-Error/non-PostgrestError values

**Behavior Improvement (Phase 28):**

Direct error pass-through loses error context in production logs (code, details, hint fields invisible). With `toError()` wrapping, PostgrestError shape is fully preserved: `{ message, code, details, hint }` all available to observability stack for structured error analysis. Production logs now contain actionable error metadata from database layer.

**Canonical Sites (Phase 21+, Phase 28 Mass Refactor):**

**Phase 21 (Initial Introduction):**
- `src/lib/analytics/queries/violation-queries.ts` — 2 query error sites wrapped with `toError()`
- `src/app/api/admin/licenses/[id]/reactivate/route.ts` — logger at L71 wrapped with `toError()`
- `src/lib/raas/raas-invoice-generator.ts` — 2 UPDATE error sites (L50, L113) wrapped with `toError()` for Supabase QueryError normalization

**Phase 28 Mass Refactor (Mechanical Batch - 23 Files, ~28+ Total Instances):**
- All admin routes (dunning routes, audit services)
- RAAS operations (invoice generator, MCU balance, mission launcher)
- Usage export handlers (GET/POST)
- Middleware and internal usage query APIs
- All instances now follow canonical pattern: `const err = toError(error); logger.error('msg', { error: err, ... })`

**Rule:** Any route or function catching query/async errors MUST use `toError()` before passing to `logger.error()`. No direct error pass-through allowed for database/async operations.

**Documentation Reference:**
See `Error Handling & Logging` section above for full signature and usage of `logger.error()`.

---

## Worker Import Path Convention (Phase 30)

Files in `src/worker/lib/` must import the `Env` interface from `../index` (parent directory), NOT from `./index` (same directory, which does not exist as a barrel file).

**Pattern:**

```typescript
// src/worker/lib/metering-reconciler-license-validator.ts
import type { Env } from '../index'  // ✓ CORRECT — Env is in src/worker/index.ts

// NOT from './index'  // ✗ WRONG — no barrel file in src/worker/lib/
```

**Rationale:**

The `Env` interface is defined in `src/worker/index.ts` (Cloudflare Workers binding type definitions). Files in the `src/worker/lib/` subdirectory import it from the parent directory using `../index`. There is no barrel file (`src/worker/lib/index.ts`); attempting to import from `./index` triggers TS2307 "cannot find module" errors.

**Phase 30 Reference:** Fixed 3 files in `src/worker/lib/` (metering-reconciler-license-validator.ts, metering-reconciler-runner.ts, metering-reconciler-steps.ts), correcting all `Env` imports from `./index` → `../index`, eliminating 5 TS2307 errors (100% TS2307 elimination).

---

## Testing Standards
- **Framework**: Vitest + React Testing Library.
- **Requirement**: Core business logic and server actions must have unit tests.
- **Coverage**: Aim for high coverage on `src/lib` validation and utility functions.
- **Reference**: See `docs/testing-guide.md` for detailed instructions.
