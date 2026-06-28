# Code Standards — Sophia AI Factory

> Canonical standards for development, enforced across all code changes (2026).

**Last Updated:** 2026-04-20 (Type Safety + DB Helpers + FSM Design)
**Codebase Commitment:** Zero `:any` types, 100% TypeScript strict mode, 1297+ test pass rate, 87+ `:any` eliminated (Phases 5-12)

---

## Type Safety (Non-Negotiable)

### Zero `:any` Rule
- **All code files** must have 0 `:any`, `as any`, or `@ts-ignore` directives
- D1 response double-casts use `as unknown as T` pattern only (see D1Response generic below)
- TypeScript strict mode enforced via `tsconfig.json`
- Verification: `grep -r ': any\|as any\|@ts-ignore' src --include="*.ts" --include="*.tsx"` must return 0 results

### Canonical Pattern: D1Response<T> Generic
**Purpose:** Type-safe wrapper for D1 query results that return `{ data: T | null; error: unknown }`.

**Location:** `src/seed/db/types.ts` (canonical source since Phase 12; older changelog entries may still say `src/lib/db/types.ts`).

**Usage:**
```typescript
import { D1Response } from '@/seed/db/types';

const result = await db.from('licenses').select().single();
const typed = result as unknown as D1Response<LicenseRow>;
if (typed.error) {
  // handle error
}
```

### Canonical Pattern: insertTyped<R, T> Helper
**Purpose:** Type-safe D1 insert wrapper that eliminates boilerplate `as unknown as Record<string, unknown>` casts on `.insert()` calls.

**Location:** `src/seed/db/insert-typed.ts` (established Phase 12; moved into `seed` during layer consolidation).

**Type Parameters:**
- `<R>` — Result row type (e.g., `UsageEventRow`), flows through `.select().single()` chaining
- `<T>` — Payload type (e.g., `UsageEventInsertable`), enforced at call site

**Usage (Anti-pattern ❌):**
```typescript
// Without helper — requires unsafe cast:
const { data, error } = await db
  .from<UsageEventRow>('usage_events')
  .insert(payload as unknown as Record<string, unknown>)
  .select()
  .single();
```

**Usage (Pattern ✅):**
```typescript
import { insertTyped } from '@/seed/db/insert-typed';
import { D1Response, UsageEventRow, UsageEventInsertable } from '@/seed/db/types';

// With helper — type-safe, chain preserves downstream typing:
const result = await insertTyped<UsageEventRow, UsageEventInsertable>(
  db.from<UsageEventRow>('usage_events'),
  payload
).select().single();

const typed = result as unknown as D1Response<UsageEventRow>;
if (typed.error) {
  logger.error('insert failed', { error: typed.error });
}
```

**Benefits:**
- Eliminates 40 chars of boilerplate per site
- Payload type `T` enforced at call site (IDE autocomplete works)
- Result type `R` flows through chaining (e.g., `.select().single()` preserves return type)
- Zero `:any` required

### Module-Level Types Pattern
**Rule:** Every domain module must have a `<module>/types.ts` file exporting:
1. Shared row interfaces (D1 query results)
2. Domain-specific input/output contracts
3. Reusable generic types (like `D1Response<T>`)

**Established in:** `src/tree/audit/types.ts` (Phase 9 lineage), `src/forest/usage-metering/types.ts` (Phase 10 lineage)

**Example:**
```typescript
// src/forest/usage-metering/types.ts
export interface D1Response<T> { /* ... */ }
export interface UsageEventInsertable { /* ... */ }
export interface LicenseMetadataRow { /* ... */ }
```

### Discriminated Union Narrowing Pattern
**Purpose:** Type-safely narrow union types without `as any` casts.

**Pattern:** Extract a helper function that returns the narrowed type, leveraging TypeScript control-flow analysis.

**Location:** `src/forest/raas/raas-rate-limiter.ts` (established Phase 11)

**Anti-pattern (❌):**
```typescript
// Unsafe — requires `as any` to satisfy TypeScript
function checkQuota(result: QuotaResult) {
  if (!result.allowed) {
    const denied = result as any; // ❌ Avoid this
    return denied.deniedReason; // might throw at runtime
  }
}
```

**Pattern (✅):**
```typescript
// Safe — TypeScript narrows discriminated union automatically
function narrowTier(plan: string): 'BASIC' | 'PREMIUM' | 'MASTER' {
  if (plan === 'BASIC' || plan === 'PREMIUM' || plan === 'MASTER') {
    return plan; // TypeScript narrows automatically
  }
  return 'BASIC'; // fallback
}

function checkQuota(result: QuotaResult) {
  if (!result.allowed) {
    const severity = result.exceeded_type === 'hourly_credits' ? 'critical' : 'high';
    return { allowed: false, severity };
  }
  return { allowed: true };
}
```

**Reference:** Phase 11 fixed latent severity-routing bug by properly narrowing `exceeded_type` discriminant, ensuring hourly-credits violations correctly route to `'critical'` instead of defaulting to `'high'`.

---

## Testing Standards

### Minimum Coverage
- **Unit tests:** All business logic, edge cases, error paths
- **Pass rate:** 100% (no skipped or xfail tests in main)
- **Command:** `npm test` must exit 0 before any commit
- **Current:** 1297/1297 tests pass (106 test files)

### Test Organization
- Co-locate tests: `feature.ts` → `feature.test.ts` in same directory
- Use descriptive `describe()` blocks scoped to module/function
- Test error scenarios + success paths equally
- No `console.log` in tests (use logger.debug if needed)

---

## Module Organization

### File Size Limits
- **Code files:** ≤ 200 lines (split if exceeding)
- **Type files:** ≤ 300 lines (interfaces, generics, unions)
- **Configuration:** No limit (config files exempt)

### Naming Conventions
- **Files:** kebab-case (e.g., `usage-metering.ts`, `api-key-store.ts`)
- **Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE (exported across modules)
- **Interfaces:** PascalCase, `Row` suffix for D1 queries (e.g., `UsageEventRow`)
- **Types:** PascalCase, `Input`/`Output`/`Config` suffix for contracts

---

## Error Handling

### Patterns
1. **Database errors:** Always type as `unknown`, narrow via `instanceof` or typeof guards
2. **API responses:** Use Zod for validation, return typed response objects
3. **Logging:** Use `logger` from `@/lib/logger.ts`, include structured metadata
4. **No silent failures:** All D1 errors logged with org_id + endpoint context

### Example
```typescript
try {
  const result = await db.from('users').select();
  const typed = result as unknown as D1Response<UserRow>;
  if (typed.error) {
    logger.error('db query failed', { error: typed.error, table: 'users' }, requestId);
    return { ok: false, error: 'failed to query users' };
  }
} catch (err) {
  logger.error('unexpected error', { error: err }, requestId);
  throw err;
}
```

---

## API Design

### Input Validation
- All route handlers validate input via Zod schemas
- Schema location: `src/lib/schema.ts` or route-local `{route}.schema.ts`
- Return errors consistently: `{ ok: boolean; error?: string; data?: T }`

### Tier-Based Gating
- Import tier config from `@/seed/config/tiers` (single source of truth)
- Use `getUserTier()` helper from `@/seed/db/get-user-tier`
- Enforce quotas via `usage-metering` module (pre-flight check before action)
- Return 429 (Too Many Requests) when quota exceeded

---

## Database Conventions

### D1 Migrations
- File naming: `migrations/NNNN-description.sql` (zero-padded sequence)
- Idempotent: all migrations use `IF NOT EXISTS`, `IF EXISTS` where applicable
- Comments: Include `-- TODO` notes for deferred follow-ups (e.g., purge crons, indexes)

### Query Patterns
- Use `db.from<T>()` generics for type inference where possible
- Avoid raw SQL in handlers; extract to the owning layer (`seed`, `tree`, `forest`, `land`, or legacy `lib/<domain>/` where the domain still lives)
- Index critical paths: `org_id`, composite keys for multi-tenant isolation

### One-Time vs Subscription SKU Pattern (2026-05-02)
- **Single Source of Truth:** `ONE_TIME_SKUS` and one-time invoice metadata are defined in `src/seed/config/one-time-skus.ts`
- **Dispatcher:** NOWPayments IPN webhook branches on Sophia-owned checkout metadata / SKU mapping. Do not rely on Polar metadata; Polar is rejected for this product.
- **Branching:** 
  - If in `ONE_TIME_SKUS` → route to one-time handler (create `user_purchases` record)
  - Else → route to subscription handler (create/update `subscriptions` + credit MCU)
- **Idempotency:** One-time inserts use `UNIQUE(user_id, user_purchase_id)` constraint; duplicates rejected safely
- **Schema:** `user_purchases(id, user_id, sku, video_credits, ttl_end, created_at)` isolated from subscription state

### CAS Updates for Concurrency-Safe State Transitions (2026-05-02)
**Pattern:** Use `UPDATE … WHERE id=? AND status=<expected> RETURNING …` with rowsAffected check before side effects.

**Purpose:** Prevent lost state transitions when cron and webhook both attempt status update simultaneously.

**Example:** `seed/db/repositories/videos-repo.ts::recordAttemptCAS`
```typescript
const result = await db
  .from<VideoRow>('videos')
  .update({ status: 'processing', last_retry_at: new Date() })
  .eq('id', videoId)
  .eq('status', 'queued')  // Only proceed if currently queued
  .select('id')
  .single();

const typed = result as unknown as D1Response<{ id: string }>;
if (typed.error || !typed.data) {
  return { ok: false, reason: 'CAS failed — not queued' };
}
// Side effect safe — transitioned atomically
```

### Atomic Compensation Grants Pattern (2026-05-02)
**Pattern:** INSERT ON CONFLICT via unique partial index; only mutate balance if insert wins.

**Purpose:** Prevent double-granting credits on retried compensation events.

**Example Location:** `lib/billing/compensation.ts`
```sql
-- Create unique index on successful grants only
CREATE UNIQUE INDEX idx_compensation_unique_per_user_event 
ON billing_events(user_id, event_type)
WHERE status = 'pending';

-- Atomic insert: only one pending grant per event type per user
INSERT INTO billing_events (user_id, event_type, amount, status)
VALUES (?, ?, 1, 'pending')
ON CONFLICT DO NOTHING;

-- Check rowsAffected before crediting balance
```

### Cron-Driven Retry Pattern (2026-05-02)
**Pattern:** Exponential backoff schedule (30s→1m→5m→15m→1h) with permanent failure path after max attempts.

**Location:** `lib/fulfillment/retry-backoff.ts`

**Backoff Schedule:**
- Attempt 1: 30 seconds (immediate retry)
- Attempt 2: 1 minute (quick recovery window)
- Attempt 3: 5 minutes (provider issue detection)
- Attempt 4: 15 minutes (extended grace period)
- Attempt 5: 1 hour (final check before failure)

**Permanent Failure Trigger:** After 5 attempts → emit `videos.status = 'failed_permanent'` + compensation trigger

### Post-Build Worker Patches Pattern (2026-05-02)
**Purpose:** When opennext doesn't natively emit required Worker features (e.g., `scheduled()`), use idempotent post-build scripts under `scripts/inject-*.mjs` with marker comments for safety.

**Location:** `scripts/inject-scheduled-handler.mjs`

**Critical: CF Workers Modules Format (260502-0756)**

Cloudflare Workers Modules format requires entry point handlers as **methods on default export**, NOT named exports.

**❌ WRONG (will not fire):**
```javascript
export async function scheduled(event, env, ctx) { /* won't work */ }
```

**✅ CORRECT (will fire):**
```javascript
export default {
  fetch(request, env, ctx) { /* existing handler */ },
  scheduled(scheduledEvent, env, ctx) { /* cron dispatcher */ }
};
```

**Pattern:**
```javascript
// Idempotency marker (prevents duplicate injection if script runs twice)
const MARKER = '// [INJECTED: scheduled-handler-2026-05-02]';
if (workerCode.includes(MARKER)) {
  console.log('Already injected, skipping...');
  return;
}

// Patch `.open-next/worker.js` with scheduled export
// MUST be method on default export (not named export)
const scheduledHandler = `
export default {
  fetch(request, env, ctx) { /* existing handler */ },
  scheduled(scheduledEvent, env, ctx) { /* cron dispatcher */ }
};
${MARKER}
`;
```

**Verification (260502-0756 incident):**
- Symptom: Cron never fires after deploy (cron_run_log unchanged)
- Root cause: `export async function scheduled()` not recognized by CF (named export format)
- Fix: Refactored to `export default { scheduled }` → cron fired within 1 minute post-deploy
- Lesson: Always validate CF Workers Modules format in post-build scripts

**Benefits:**
- Transparent to build system (runs after opennext-build)
- Idempotent (safe to run multiple times)
- Preserves all existing Worker handlers
- No runtime overhead
- Correct CF Workers Modules format (method on default export)

---

### Self-Dispatch via Service Binding + Bearer CRON_SECRET Pattern (2026-05-02)
**Purpose:** Internal cron handlers need to invoke protected routes. Use service binding (`env.WORKER_SELF_REFERENCE.fetch()`) with Bearer CRON_SECRET auth (not `x-cf-cron` header bypass).

**Hardened Implementation (260502-0756):**
```typescript
// In scripts/inject-scheduled-handler.mjs:
const CRON_SECRET = env.CRON_SECRET; // Must be set via wrangler secret put
if (!CRON_SECRET) {
  console.error('CRON_SECRET not configured — cron dispatch disabled');
  return;
}

const req = new Request('https://self/api/cron/email-drip', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`, // REQUIRED (removed x-cf-cron bypass)
  },
});
const res = await env.WORKER_SELF_REFERENCE.fetch(req);
```

**Cron Route Verification (lib/security/cron-auth.ts):**
```typescript
// All cron routes MUST call verifyCronAuth(request, env)
export function verifyCronAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  return token === env.CRON_SECRET; // Exact match, no shortcuts
}

// Inside cron handler:
if (!verifyCronAuth(request, env)) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
}
```

**wrangler.toml binding:**
```toml
[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "sophia-ai-factory"
# Routes to current Worker without external network call
```

**Setup (Operator):**
```bash
bash scripts/set-cron-secret.sh  # Generates 32-byte random secret + sets via wrangler secret put
```

**Benefits (260502-0756):**
- **Security:** Bearer token auth replaces CF-internal `x-cf-cron` bypass (no external caller can fake header)
- **Fast:** service binding routes internally (no external latency)
- **Auditable:** CRON_SECRET can be rotated; x-cf-cron could not

---

## Security Standards

### Secrets & Credentials
- **BANNED:** Hardcoded API keys, master passwords, connection strings in code
- **Required:** Environment variables with runtime type-checking
- **Encryption:** Per-user keys stored encrypted (AES-GCM); see `@/lib/byok/*`
- **Verification:** `grep -r 'API_KEY\|PASSWORD\|SECRET' src --include="*.ts" | grep -v 'env\.' | grep -v import` must return 0

### Multi-Tenant Isolation
- All D1 queries scoped by `org_id`
- LLM cache, usage events, audit logs all org-scoped
- Single-user = single-org mapping (1-to-1 relationship in `users.org_id`)
- D1 Kysely tenant-scope plugin auto-injects `tenant_id` on all queries (Phase 11+)

### Compliance (Phase 14)
- **FTC Compliance:** All user-generated video content must include `#ad` overlay (3-second text, FFmpeg drawtext) + caption prefix in publisher adapters
- **GDPR Compliance:** 
  - `/api/account/export` endpoint: exports user data (JSON), includes orgs + missions + usage + payments
  - `/api/account/delete` endpoint: anonymizes user record, soft-deletes org + related data
  - No PII in logs (Better Stack integration filters sensitive fields)
- **Data Retention:** Audit logs retained 90 days minimum, backup retained 12 months

---

## Build & Deployment

### Pre-Commit
1. `npm run build` must exit 0 (0 TS errors)
2. `npm test` must pass all tests
3. No console.log statements (use logger instead)
4. Commit message: conventional format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)

### Production Readiness
- Build time: < 10 seconds
- Zero `:any` types in shipped code
- 100% test pass rate
- All new secrets added to `.env.example` template (no values, just keys)

---

## Established Patterns (By Phase)

| Phase | Pattern | Location |
|-------|---------|----------|
| 9 | Module types extraction | `src/tree/audit/types.ts` |
| 10 | D1Response<T> generic | `src/forest/usage-metering/types.ts` (promoted Phase 12) |
| 11 | Discriminated union narrowing | `src/forest/raas/raas-rate-limiter.ts` |
| 11 | Tenant isolation helper | `src/seed/db/with-tenant-scope.ts` |
| 12 | insertTyped<R,T> helper | `src/seed/db/insert-typed.ts` |
| 12 | D1Response canonical location | `src/seed/db/types.ts` |
| 13 | Commission ledger append-only | `src/land/payouts/commission-ledger.ts` |
| 13 | 14-day clawback window | `src/land/payouts/clawback-handler.ts` |
| 14 | **FTC #ad overlay (FFmpeg)** | **`src/lib/video/ftc-ad-overlay.ts`** |
| 14 | **GDPR account routes** | **`src/app/api/account/`** |
| 14 | **GDPR redaction helpers** | **`src/tree/audit/gdpr-redaction.ts`** |
| - | Tier normalization | `src/lib/auth/normalize-tier.ts` |
| - | BYOK encryption | `src/lib/byok/*` |
| - | Org resolution | `src/lib/auth/resolve-org-id.ts` |

---

## Code Review Checklist

- [ ] Zero `:any` types introduced
- [ ] All TypeScript errors fixed (`npm run build` clean)
- [ ] Tests pass 100% (`npm test`)
- [ ] No console.log in production code
- [ ] Database queries use proper type generics
- [ ] Error paths tested and logged
- [ ] API responses have consistent shape
- [ ] No breaking changes to existing APIs
- [ ] Comments explain *why*, not *what*

---

## Remaining Type-Safety Backlog

**Phases 5–12 cumulative:** 20 + 33 + 34 + 20 + 3 + 0 + 0 (no `:any` in P12) = **110+ `:any` eliminated** (Phases 5-12)

**DB Helper Consolidation (Phase 12):**
- ✅ D1Response<T> — 1 canonical export in `@/seed/db/types.ts`, 5 callers migrated
- ✅ insertTyped<R,T> helper — 10 call sites refactored, 0 remaining `as unknown as Record` on `.insert()`
- ✅ FSM design decision documented — log-only no-writeback, ops thresholds (10/hr warn, 100/hr page)

**Future phases (candidate work):**
- **Phase 13:** Remove `insertManyTyped` dead code (YAGNI), lint rule to enforce `insertTyped()` usage
- **Phase 13+:** `as Error` / `instanceof Error` standardization across error handlers
- **Phase 13+:** `ClientWithStorage` R2 migration audit
- **Phase 13+:** `raas_licenses` D1-vs-Supabase consolidation
- **Ongoing:** Ad-hoc refactors as new code written

Current status: **All current production code: 0 `:any` types** ✅

---

## Per-User Provider Key Access Pattern (BYOK Fulfillment, 2026-05-02)

When accessing HeyGen / Resend / NOWPayments keys in fulfillment code:

```typescript
// CORRECT — customer fulfillment (fallbackToPlatform: false)
import { getHeyGenKey } from '@/tree/credentials/get-provider-key'
const keyResult = await getHeyGenKey({ userId, fallbackToPlatform: false })
if (!keyResult) { await recordAttempt(id, 'no_user_heygen_key'); return }
const apiKey = keyResult.key  // keyResult.source === 'user'

// CORRECT — transactional email (fallbackToPlatform: true by default)
import { getResendKey } from '@/tree/credentials/get-provider-key'
const resendResult = await getResendKey({ userId })

// CORRECT — platform-only paths (health check, synthetic monitor, onboarding video)
const apiKey = process.env.HEYGEN_API_KEY  // intentional — platform key only
```

Rules:
- Customer video generation (`one-time-fulfillment`, `fulfillment-retry`): `fallbackToPlatform: false`
- Health check, synthetic monitor (`smoke-one-time`), onboarding video: keep `process.env.HEYGEN_API_KEY`
- NEVER read `process.env.HEYGEN_API_KEY` in customer fulfillment paths
- `CREDENTIALS_MASTER_KEY` (64 hex chars) encrypts `user_provider_credentials` table
- `BYOK_MASTER_KEY` (base64 32 bytes) encrypts `user_api_keys` table (LLM/media BYOK)

---

## Canonical Import Paths (post-consolidation 2026-04-14)

These are the ONLY approved paths for core concerns. Use nothing else.

| Concern | Canonical Import |
|---------|----------------|
| Auth session | `import { getCurrentUser } from '@/seed/auth/better-auth-session'` |
| Tier lookup | `import { getUserTier } from '@/seed/db/get-user-tier'` |
| DB client (sync) | `import { createServerClient } from '@/seed/db/client'` — do NOT `await` |
| Tier config | `import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'` |

### BANNED Imports

The following modules were deleted in 2026-04-14 consolidation. Any new import from these paths is a build error:

```
@/lib/auth                ← deleted (use @/seed/auth/better-auth-session)
@/lib/subscription        ← deleted (use @/seed/db/get-user-tier)
@/lib/unified-tier-config ← deleted (use @/seed/config/tiers)
@/lib/tier-gate           ← deleted (use @/seed/config/tiers + manual gate)
```

### Tier Enum

Always uppercase. Never use aliases like `pro`, `enterprise`, `free`:

```typescript
type Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
```

---

_Last reviewed 2026-05-20 by docs harness alignment | Standards enforced by pre-commit hooks_
