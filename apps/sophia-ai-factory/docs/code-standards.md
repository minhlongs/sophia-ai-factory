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

## Wave 11 Patterns (2026-05-09)

### Password Reset Token Flow
- **Atomicity**: `signResetToken(userId)` creates D1 record with unique JTI; `consumeResetToken(token)` marks `used_at` in single transaction (prevents replay).
- **Expiry**: 15-minute lifetime; cleanup job runs hourly via Inngest to purge expired tokens.
- **Usage**: Endpoint `POST /api/auth/reset-password` validates JTI exists, not yet consumed, matches `expires_at`.
- **File**: `src/lib/publishing/token-crypto.ts` (reusable crypto utilities).

### OAuth State Encryption (Server-Side)
- **Flow**: 1) Create random state_nonce → 2) Encrypt OAuth payload (provider, clientSecret, redirect_uri) → 3) Store in `oauth_state_store` → 4) Pass state_nonce to OAuth endpoint.
- **Callback**: Receive state_nonce → decrypt payload from D1 → verify clientSecret matches (prevents CSRF/code-substitution).
- **Helpers**: `storeOauthState(provider, payload)` / `consumeOauthState(nonce)` in `src/lib/publishing/token-crypto.ts`.
- **Expiry**: 10-minute window; consumed on first callback use.

### Webhook Signature Validation (Unified Format — Wave 15)
- **Format**: `t=<unix_timestamp_sec>,v1=<hmac_sha256_hex>` (outbound default) + inbound provider wrappers.
- **Outbound Signing** (default `acceptLegacy=false`):
  - v1 = `HMAC256(hex, ${timestamp}.${body}, secret)`
  - Bare-hex legacy format (`HMAC256(body, secret)`) no longer accepted unless explicitly `acceptLegacy=true`
- **Inbound Verification** (3rd-party providers — Wave 15):
  - `verifyInboundWebhook(provider, req, options)` handles NOWPayments IPN (HMAC-SHA512), PayOS (HMAC-SHA256), Inngest
  - Each provider's canonicalization + hash algorithm specified in `InboundVerifyOptions`
  - Centralizes signature logic in `src/lib/webhooks/signature.ts`
- **Anti-Replay**: Reject if `abs(now - timestamp) > 5min` (configurable per publisher).
- **Usage**: Distribution publishers, HeyGen, NOWPayments IPN, PayOS, Inngest events.

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

## Wave 12 Patterns (2026-05-09)

### Bundle Optimization: ServerExternalPackages + OptimizePackageImports
- **Pattern**: `next.config.ts` declares runtime-only deps via `serverExternalPackages` (NOT bundled) + tree-shake candidates via `optimizePackageImports`.
- **ServerExternalPackages**: `@redis/client, ioredis` (async runtime deps, no tree-shake benefit).
- **OptimizePackageImports**: `[better-auth, date-fns, lucide-react, zod]` (explicitly mark for tree-shake).
- **Impact**: Gzipped bundle reduced 12% (487KB → 428KB post-audit). Apply when module size > 100KB or used partially.
- **File**: `next.config.ts` (5-15 LOC config).

### OAuth Token Refresh Auto-Reflow (4x Publisher Switches)
- **Pattern**: `oauth-token-refresher.ts` implements provider-specific expiry logic (Facebook: 60d, Twitter: 2h, Threads: ephemeral, Reddit: 1h).
- **Trigger**: Publish workflow detects 401 → call `refreshOAuthToken(provider, userId)` → update D1 → retry POST.
- **Providers**: Facebook, Twitter, Threads, Reddit (added in Wave 12).
- **Anti-Pattern**: Hardcoded fixed expiry across all providers (expiry varies by provider).

### Video Generation Pipeline (Wan 2.1 + Fish Speech)
- **Schema**: Migration 0096 adds `output_video_url, output_audio_url, video_job_id` to `engine_missions`.
- **Flow**: Mission script complete → trigger Inngest `video-gen-handler` → call Wan 2.1 (text→video) + Fish Speech (text→audio) → poll job refs → R2 upload (wave 13) → update mission outputs.
- **Infrastructure**: Ready (API wired); UI registration pending (wave 13).

### Logging Standard (Observability Tier-2D)
- **Use `logger.error(...)` from `@/lib/utils/logger-utility`** (NOT `console.error`) for all production error handling
- Logger auto-forwards `error` level to Sentry SDK when available (graceful no-op without SDK)
- **Client-side exception**: React error boundaries use `Sentry.captureException(error)` directly for unhandled renders
- **Internal fallback exception**: `logger-internals.ts:92` `console.error` intentional (avoids infinite recursion if logger itself fails)
- Error context automatically includes: timestamp, requestId (if provided), structured metadata

### Money Operations: Atomic UPDATE-RETURNING with Reconciliation Revert (Sprint M Pattern)

All financial operations (wallet updates, payout approvals, commission logging) MUST be atomic with reconciliation rollback on error. This is established pattern from Sprint M revenue pipeline (affiliate commissions + payouts).

**Canonical Pattern (seen in `src/lib/wallet/payout-processor.ts`):**

```typescript
// Before: Fetch current state
const wallet = await db
  .select()
  .from('user_wallets')
  .where(eq('user_id', userId))
  .single();

const previousBalance = wallet.balance_available;

// Operation: UPDATE-RETURNING (atomic)
const [updated] = await db
  .update('user_wallets')
  .set({
    balance_available: sql`${wallet.balance_available} - ${amount}`,
    updated_at: new Date().toISOString()
  })
  .where(eq('user_id', userId))
  .returning();

// Reconciliation: Verify invariant (balance >= 0)
if (updated.balance_available < 0) {
  // Revert on error: Restore to previous state
  await db
    .update('user_wallets')
    .set({
      balance_available: previousBalance,
      updated_at: new Date().toISOString()
    })
    .where(eq('user_id', userId));
  
  throw new Error(`Insufficient balance: have ${previousBalance}, need ${amount}`);
}

// Success: Return updated state
return updated;
```

**Key Principles:**
1. **Fetch Before**: Read current state outside transaction (establishes baseline)
2. **Atomic Update**: Single UPDATE-RETURNING statement (no race conditions between read + write)
3. **Verify Invariant**: Check result satisfies business rules (balance >= 0, no negative commissions, etc.)
4. **Revert on Failure**: UPDATE back to previous state if invariant violated (not ROLLBACK; UPDATE preserves audit trail)
5. **Log All Changes**: Both forward and revert operations logged with amounts + reasons

**Applied Patterns (Sprint M):**
- `user_wallets` balance deductions (ensure balance_available never negative)
- `affiliate_conversions` commission splits (verify 70/30 calculation)
- Payout reconciliation (prevent overpaying same user)

**Anti-Pattern (Forbidden):**
```typescript
// ❌ WRONG: Separate SELECT + UPDATE (race condition window)
const wallet = await db.select().from('user_wallets').where(eq('user_id', userId));
await db.update('user_wallets').set({ balance_available: wallet.balance_available - amount });

// ❌ WRONG: Silent failure (no invariant check, balance could go negative)
await db.update('user_wallets').set({ balance_available: sql`${wallet.balance_available} - ${amount}` });
```

**Webhook Safety (ClickBank IPN):**
- `UPDATE-RETURNING` pattern ensures webhook retries are idempotent
- If conversion already logged (unique constraint on receipt+event_type), re-running adds 0 to balance
- If network error occurs mid-update, next retry finds same state, applies same delta, result unchanged
- See `src/app/api/webhooks/clickbank/route.ts` for live implementation

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

### Async Server Component Error & Loading Pattern (Dashboard GAP, 2026-05-04)

All async Server Component pages MUST have co-located `error.tsx` and `loading.tsx` boundary files. Use shared `DashboardError` and `DashboardSkeleton` components for consistency.

**Required structure:**
```
src/app/dashboard/wallet/
├── page.tsx       (async, may throw/suspend)
├── error.tsx      (error boundary)
├── loading.tsx    (loading skeleton)
└── layout.tsx     (optional, shared UI)
```

**Implementation pattern:**
```typescript
// page.tsx — async Server Component
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { TierGateCard } from '@/components/dashboard/tier-gate-card';

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user?.tier) throw new Error('Unauthorized');
  
  // TierGateCard handles tier-specific rendering
  return <TierGateCard tier={user.tier} minTier="PREMIUM">{/* content */}</TierGateCard>;
}

// error.tsx — Error Boundary
'use client';
export default function ErrorBoundary({ error }: { error: Error }) {
  return <DashboardError error={error} />;
}

// loading.tsx — Suspense Fallback
export default function Loading() {
  return <DashboardSkeleton />;
}
```

**Shared Components:**
- `DashboardError`: Renders error message + retry button + logs to Sentry
- `DashboardSkeleton`: Skeleton loader for dashboard layouts
- `TierGateCard`: Gating component; shows tier-required message if access denied
- `EmptyState`: UI for zero-data states

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

## Wave 14 Patterns (2026-05-09)

### Bundle Size Guard Script
- **Location**: `scripts/check-bundle-size.sh` (runs in CI/pre-deploy)
- **Threshold**: 9.5/10MB (gzipped OpenNext worker.js)
- **Behavior**: Parses `npm run build` output, compares `.open-next/worker.js.gz` size. Aborts if exceeded.
- **Usage**: `bash scripts/check-bundle-size.sh` (CI hooks automatically)
- **Rationale**: Prevents Cloudflare Worker cold-start latency degradation from large bundles

### SSE Cursor Separation (eventCursor vs lastHeartbeatTs)
- **Pattern**: `/api/agent-chat` SSE stream maintains TWO independent cursors:
  - `eventCursor` — incremented per user message (for Last-Event-ID resume)
  - `lastHeartbeatTs` — timestamp of last heartbeat ping (for connection keepalive)
- **Problem Solved**: Previous implementation conflated heartbeat messages with event cursor, causing duplicate message delivery on reconnect.
- **Implementation**: Message buffer indexed by `eventCursor`; heartbeat uses separate timestamp. Reconnect handler queries from `Last-Event-ID` (ignores heartbeat timestamp).
- **File**: `src/api/agent-chat/route.ts` (SSE handler) + `src/lib/agent-chat/sse-buffer.ts` (buffer logic)

### BYOK Validation Pattern (Provider Registry)
- **Schema**: `missions.byok_provider_id + byok_model_id` (migration 0097)
- **Registry**: `@/lib/byok/provider-registry.ts` exports `validateProviderModel(providerId, modelId): boolean`
- **Usage**: `POST /api/v1/missions` validates BYOK before launcher executes script
- **Fallback**: If BYOK unconfigured, uses `selectModelForTier(user.tier)` (tier-based default)
- **Security**: Secret rotation via `/api/user/byok/rotate-secrets` (admin-gated, audit logged)

## Wave 13 Patterns (2026-05-09)

### Inngest Event Schema Registration
- **Pattern**: Declare event schemas in `src/forest/inngest/client.ts` via `inngestClient.createEventSchema()` for type-safe event dispatch + subscription.
- **Example**: `video-gen` event schema `{missionId, scriptId, avatarId, voiceId, duration}` registered once, reused by trigger route `POST /api/v1/missions/[id]/generate-video` + Inngest function.
- **Benefit**: Single source of truth for event shape; TypeScript validates all emits/handlers against schema.
- **File**: `src/forest/inngest/client.ts` (barrel exports schemas).

### Webhook Verifier Unification (acceptLegacy Flag)
- **Pattern**: Single `verifyWebhook(provider, req)` helper at `src/seed/utils/verify-webhook.ts` supports multiple signature formats via `acceptLegacy` flag.
- **Signature Formats**:
  - **Current** (v2): `t=<timestamp>,v1=<hmac>` + 5min freshness window (supported by NOWPayments v2+, HeyGen, Inngest).
  - **Legacy** (v1): Body-only `HMAC256(body, secret)` for NOWPayments v1 backward-compat (with `acceptLegacy=true` flag).
- **Usage**: `const verified = verifyWebhook('nowpayments', req, { acceptLegacy: true })` → returns `{ valid, provider, timestamp }`.
- **Security**: Eliminates code duplication; centralizes signature validation logic.

### SSE Last-Event-ID Resume (Cursor-Based Dedup)
- **Pattern**: `/api/agent-chat` SSE respects browser `Last-Event-ID` header on reconnect. Server dedupes messages by cursor range.
- **Flow**: (1) Client receives message ID from SSE event + stores locally. (2) Connection drops. (3) Browser auto-reconnects with `Last-Event-ID: <lastId>` header. (4) Server queries message buffer from `lastId` onward, restreams. (5) Client dedupes by ID before rendering.
- **UI**: Reconnect banner (yellow toast) dismissed on successful resume (no duplicate messages shown).
- **Implementation**: Message buffer kept in memory 5-minute window; expired messages discarded (prevents unbounded memory).
- **Anti-Pattern**: Relying on TCP retransmission alone (loses context on long disconnections).

## Environment Variables
- Access environment variables **only on the server**.
- Prefix public variables with `NEXT_PUBLIC_`.
- Use `process.env.VARIABLE_NAME`.
- **Validation**: Check for required variables at startup or usage time.

## Git Workflow
- **Commit Messages**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branches**: `feature/{name}`, `fix/{issue}`.
- **PRs**: Require CI checks (Lint, Build, Test) to pass.

---

## Advanced Patterns & Specialized Topics

**See separate document:** `code-standards-advanced-patterns.md` for:
- Service Factory Pattern
- TypeScript type-casting patterns (HTTP boundary, DB result, Web Crypto)
- Admin authentication helpers & `requireAdmin()` pattern
- Phase-specific patterns (Vitest, next-intl, Worker imports, etc.)
- D1/Supabase divergence reference
- Web Crypto & Upstash Redis API patterns

This main document covers fundamentals; advanced patterns are documented separately for clarity.

---

## Testing Standards
- **Framework**: Vitest + React Testing Library.
- **Requirement**: Core business logic and server actions must have unit tests.
- **Coverage**: Aim for high coverage on `src/lib` validation and utility functions.
- **Reference**: See `docs/testing-guide.md` for detailed instructions.

### Vitest Mock Patterns (Standardized)
Tests use consistent mocking conventions across `tree/handover/`, `tree/audit/`, and `forest/*`:

**1. Hoisted Mocks (Module-level)**
```typescript
import { vi, describe, it, expect } from 'vitest';

const mockFetch = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/http-client', () => ({ default: mockFetch }));

describe('MyService', () => {
  it('calls API', async () => {
    mockFetch.get.mockResolvedValue({ status: 200 });
    // test logic
  });
});
```

**2. Class Mocks (Constructor mocking)**
```typescript
const MockSDK = vi.hoisted(() => {
  return class {
    constructor() {
      this.initialized = true;
    }
    async connect() { /* */ }
  };
});

vi.mock('@/tree/sdk', () => ({ SDK: MockSDK }));
```

**3. Environment Stubs**
```typescript
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('DATABASE_URL', 'sqlite::memory:');
```

**4. File co-location**
Tests live in `{filename}.test.ts` alongside source. Structure:
- `src/tree/audit/receipt-generator.ts` → `src/tree/audit/receipt-generator.test.ts`
- `src/tree/handover/migration-plan.ts` → `src/tree/handover/migration-plan.test.ts`

Use vi.resetAllMocks() after each test for clean state.
