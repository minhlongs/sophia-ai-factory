# Code Standards — Advanced Patterns & Specialized Topics

**Related:** See `code-standards.md` for fundamentals (General Principles through Git Workflow)

This document covers advanced implementation patterns for complex domains: Service Factory, TypeScript narrowing, database operations, authentication, and specialized patterns by phase.

---

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

---

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

### Web Crypto API Cast Pattern (Phase 45)

Web Crypto API in TypeScript 5: `Uint8Array` from `hexToBytes`/`crypto.getRandomValues` requires explicit `as BufferSource` cast when passed to `subtle.importKey/encrypt/decrypt` due to `ArrayBuffer<->SharedArrayBuffer` narrowing. Pattern: `const material = await subtle.importKey('raw', keyBytes as BufferSource, ...)`

**Name-Collision Resolution (Phase 43):** When a DB query result type and a consumer interface share the same name but live in different modules (e.g., `RaasAuditLogRow` in `@/lib/supabase/types` vs `RaasAuditLog` in `raas-schema`), **import from the schema/contract module, not the supabase row type module.** This ensures domain logic uses the canonical business contract, not the implementation detail. Apply canonical-first preference: schema types > supabase types > inline fallback.

**Conflicting `declare global var X` Blocks Across Modules (Phase 44):** When the same global variable is declared in 2+ modules with conflicting value types (e.g., `var KV_KV: KVNamespace<string>` vs `var KV_KV: KVNamespace<unknown>`), unify to single canonical declaration with `unknown` value type at the declaration site; cast to specific types at usage/call sites where narrowing is needed.

---

## Admin Auth Patterns

### Admin Auth Helper Pattern (Phase 25)

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

---

## Admin Request Handler Pattern — `requireAdmin()` (TIER-2B, 2026-04-28)

**Purpose:** Single-source entry-point for admin API routes. Handles session retrieval + role check in one call, returns `NextResponse` on auth failure or `User` on success. Replaces fragmented Basic Auth, API-key, and inline patterns.

**Canonical Location:** `src/lib/auth/require-admin.ts`

**Canonical Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { User } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';

export async function requireAdmin(request: NextRequest): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
  }
  
  // Audit log (best-effort, non-blocking)
  // Implementation deferred to lib/auth/admin-audit-log.ts
  
  return user;
}
```

**Canonical Usage Pattern — All Admin Routes:**

```typescript
// src/app/api/admin/licenses/route.ts
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  
  const user = auth; // TypeScript knows this is User
  // Admin-only logic continues...
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  
  const user = auth;
  // Admin-only logic continues...
}
```

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

**Rule:** Any route or function catching query/async errors MUST use `toError()` before passing to `logger.error()`. No direct error pass-through allowed for database/async operations.

---

## Worker Import Path Convention (Phase 30)

Files in `src/worker/lib/` must import the `Env` interface from `../index` (parent directory), NOT from `./index` (same directory, which does not exist as a barrel file).

**Pattern:**

```typescript
// src/worker/lib/metering-reconciler-license-validator.ts
import type { Env } from '../index'  // ✓ CORRECT — Env is in src/worker/index.ts

// NOT from './index'  // ✗ WRONG — no barrel file in src/worker/lib/
```

---

## TypeScript Patterns (Post-B2 Cleanup, 2026-04-26)

### Web Crypto BufferSource Cast Pattern

Web Crypto API in TypeScript 5 requires explicit `as BufferSource` cast when passing `Uint8Array` from `hexToBytes` or `crypto.getRandomValues` to `subtle.importKey/encrypt/decrypt`:

```typescript
// Pattern: explicit BufferSource cast for Web Crypto APIs
const keyBytes = hexToBytes(keyHex);  // Returns Uint8Array
const key = await subtle.importKey(
  'raw',
  keyBytes as BufferSource,  // ✓ Required cast
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);
```

Rationale: TS5 `ArrayBuffer<->SharedArrayBuffer` narrowing requires type hint. Direct pass-through causes TS2345 errors.

### Upstash Redis API Pattern

Sophia uses `@upstash/redis` (NOT Cloudflare Workers KV). Use `kv.set()` with `ex` option for TTL:

```typescript
import { Redis } from '@upstash/redis';

const kv = new Redis({ /* ... */ });

// ✓ CORRECT — Upstash syntax
await kv.set(key, value, { ex: 3600 });

// ✗ WRONG — CF KV syntax (different API)
// await kv.put(key, value, { expirationTtl: 3600 });
```

**Key difference:** Upstash auto-serializes JSON; do NOT pre-stringify.

### D1 Query Chain vs Supabase Divergence

**Text Search:** No `.textSearch()` on D1/SQLite. Use `.ilike()` with escaped patterns:

```typescript
// Prevent wildcard injection — escape %, _, \ from user input first
const escaped = userInput.replace(/[%_\\]/g, '\\$&');
const results = await db
  .from('table')
  .select('*')
  .ilike('column', `%${escaped}%`);
```

**Upsert:** No `.insert().onConflict().update()` chain on D1. Use `.upsert()` directly:

```typescript
// ✓ CORRECT — D1 upsert
await db.from('table').upsert(data);

// ✗ WRONG — Supabase-only chain
// await db.from('table').insert(data).onConflict('id').update(data);
```

**Null Ordering:** No `nulls: 'last'` option on `.order()`. Order by column, then handle nulls in memory if needed.

### D1 Migration Patterns (NEW — Post-0017)

When using D1 upsert operations (`.upsert()` on D1QueryChain), ensure the target table has **exactly ONE UNIQUE/PRIMARY KEY constraint** that matches the upsert payload fields. Bare `.upsert()` (without explicit conflict-resolution clause on D1) relies on schema-level uniqueness to disambiguate rows. Example: JWT nonce table (migration 0017) uses `nonce TEXT PRIMARY KEY` to enable upsert-by-nonce. If multiple unique constraints exist, D1QueryChain behavior is undefined; disambiguate at migration layer with explicit PK or functional index. Reference: `migrations/0017-jwt-nonces.sql`.

### Web Crypto Constants-Time Comparison

`crypto.subtle.timingSafeEqual` does NOT exist on Cloudflare Workers. Implement constant-time comparison via XOR loop:

```typescript
// Constant-time comparison helper
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
```

### Better Auth Deep Generic Inference

When assigning Better Auth singleton to a typed variable, use double-cast to break structurally-equivalent `Prettify<...>` types:

```typescript
import { betterAuth } from 'better-auth';

// Double-cast pattern for type inference
const auth = betterAuth({...}) as unknown as AuthInstance;
```

Document as known TS quirk, not a bug. Related to Better Auth's generic-heavy type architecture.

### OAuth Callback Auth Pattern

Use `getCurrentUser()` from `@/lib/better-auth-session`. Sophia migrated off Supabase Auth:

```typescript
// ✓ CORRECT — Better Auth session
const user = await getCurrentUser();

// ✗ WRONG — Supabase Auth (removed)
// const user = await supabaseAdmin.auth.admin.getUserById(userId);
```

The shim at `@/lib/supabase/server` exposes D1 only (not `.auth`).

### Zod v4 Record Signature

Use `z.record(z.string(), z.unknown())` — `z.record(z.unknown())` is v3 syntax:

```typescript
// ✓ CORRECT — Zod v4
const schema = z.record(z.string(), z.unknown());

// ✗ WRONG — Zod v3 syntax
// const schema = z.record(z.unknown());
```
