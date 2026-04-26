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

External HTTP responses arrive as `unknown` after `.json()`. Use local interfaces at the boundary to type-cast wire contracts, separated from internal domain types. This is now an **established standard** across 6 verified instances (Phases 6–12).

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

**Canonical Examples (6 Verified Instances):**
- Phase 6: `src/worker/lib/metering-reconciler-license-validator.ts` — `RaasSyncResponse` cast from `/api/license/sync` (single-endpoint)
- Phase 8: `src/lib/heygen/heygen-client.ts` — `HeyGenVideoStatusResponse` cast from HeyGen API (single-endpoint)
- Phase 9: `src/app/[locale]/dashboard/proposals/page.tsx` — `ProposalApiResponse` cast from `/api/proposals` (single-endpoint)
- Phase 10: `src/components/raas/api-key-create-modal.tsx` — `ApiKeysCreateResponse` cast from `/api/raas/api-keys/create` (single-endpoint)
- Phase 11 (cleanest): `src/components/admin/licenses/audit-log-table.tsx` — `AuditLogsResponse` cast from `/api/admin/licenses/audit-logs` (single-endpoint, strict YAGNI: omits unused server fields, minimal scope)
- **Phase 12 (dual-endpoint variant):** `src/components/quota/quota-usage-dashboard.tsx` — `QuotaUsageResponse` + `QuotaLimitResponse` casts from parallel `Promise.all([fetch1, fetch2])` on `/api/quota/usage` + `/api/quota/limits`. **Sub-pattern: DUAL-ENDPOINT** — 2 separate response interfaces for independent parallel fetches (do NOT merge into god-type); each interface typed individually, each cast applied at boundary with fallback.

**Pattern Maturity:** Established standard. Apply to all new HTTP boundary type-casts across the codebase. For multi-endpoint scenarios, maintain separate interfaces per endpoint rather than merging responses.

---

## Testing Standards
- **Framework**: Vitest + React Testing Library.
- **Requirement**: Core business logic and server actions must have unit tests.
- **Coverage**: Aim for high coverage on `src/lib` validation and utility functions.
- **Reference**: See `docs/testing-guide.md` for detailed instructions.
