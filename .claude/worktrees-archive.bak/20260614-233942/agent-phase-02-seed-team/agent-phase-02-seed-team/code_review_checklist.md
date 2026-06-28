# Code Review Checklist — Sophia AI Factory

This checklist defines the canonical criteria for reviewing code contributions in the **Sophia AI Factory** codebase. It merges the standard code review patterns with project-specific constraints, type safety requirements, and runtime architectures.

---

## 📋 Quick Reference

| Category | High-Risk Indicators | Verification Tool / Command |
| :--- | :--- | :--- |
| **Type Safety** | `:any`, `as any`, `@ts-ignore`, `await createServerClient()` | `npm run type-check` |
| **Database** | Missing `insertTyped`, raw `.insert()` with manual casts, missing CAS filters | `npm run build` |
| **Edge Runtime** | Named `scheduled` exports, missing `verifyCronAuth`, missing `fallbackToPlatform: false` | `npm test` |
| **Compliance** | Missing `#ad` overlay filter, PII in log records | GDPR routes check |
| **Payments** | Polar.sh / PayPal references | Banned imports grep |

---

## 1. Type Safety (Strict Zero-Tolerance)

Every pull request must maintain **0 TypeScript errors** and enforce strict type boundaries.

- [ ] **No Unsafe Types:** Check that no `:any`, `as any`, or `@ts-ignore` comments are introduced.
- [ ] **D1 Response Handlers:** D1 query results must cast using the canonical pattern `as unknown as D1Response<T>`.
- [ ] **Strict D1 Inserts:** Ensure all insert operations utilize the `insertTyped<R, T>` wrapper instead of raw inserts with manual casts.
- [ ] **Banned Imports Guard:** Ensure none of the consolidated legacy modules are imported:
  - ❌ `import ... from '@/lib/auth'` (Use `@/seed/auth/better-auth-session`)
  - ❌ `import ... from '@/lib/subscription'` (Use `@/seed/db/get-user-tier`)
  - ❌ `import ... from '@/lib/unified-tier-config'` (Use `@/seed/config/tiers`)
  - ❌ `import ... from '@/lib/tier-gate'` (Use `@/seed/config/tiers`)
- [ ] **Tier Enum Cases:** All subscription tiers must be uppercase and map exactly to:
  ```typescript
  type Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  ```

---

## 2. Database & State Transitions

Concurrency and multi-tenant isolation are critical for Sophia's Cloudflare D1 environment.

- [ ] **Synchronous DB Client:** `createServerClient()` is synchronous. Ensure it is never prefixed with `await`.
- [ ] **Compare-And-Swap (CAS) Transitions:** State mutations must use atomic updates specifying the expected state in the query parameters to prevent race conditions.
  > [!IMPORTANT]
  > Always check `rowsAffected` or verify the return row from the CAS query before executing downstream side effects (e.g., sending emails or dispatching tasks).
- [ ] **Atomic Compensation Grants:** Unique indexes must guard compensation events. Balance increments must only occur if the unique insert succeeds (rows affected > 0).
- [ ] **Tenant Isolation:** Ensure all queries are scoped by `org_id` / `tenant_id`.

```typescript
// ✅ Good: Concurrency-safe state transition (CAS)
const result = await db
  .from<VideoRow>('videos')
  .update({ status: 'processing' })
  .eq('id', videoId)
  .eq('status', 'queued') // Concurrency gate
  .select('id')
  .single();
```

---

## 3. Background Jobs & Cloudflare Edge Runtime

Fulfillment and cron jobs operate inside Cloudflare Workers with specific edge behaviors.

- [ ] **CF Workers Export Format:** All worker entry point handlers (like `scheduled`) must be exported as methods on the default export. Named exports will not fire in production.
  ```typescript
  // ✅ Correct default export format
  export default {
    fetch(request, env, ctx) { ... },
    scheduled(scheduledEvent, env, ctx) { ... }
  };
  ```
- [ ] **Cron Security:** Every cron route must enforce bearer token verification using the `verifyCronAuth(request, env)` utility matching `env.CRON_SECRET`.
- [ ] **BYOK Fallbacks:** In customer video generation paths (`one-time-fulfillment`), `fallbackToPlatform: false` must be passed to credential retrieval to prevent usage of the operator's platform keys.
- [ ] **Non-Blocking Renders:** Video rendering processes (e.g., Remotion/MoviePy) must run asynchronously and never block the main Cloudflare Workers edge thread.

---

## 4. Payments & Revenue Stack

Sophia operates on a strict self-onboarding, no-code revenue model.

- [ ] **NOWPayments / PayOS Only:** Check that no Stripe, PayPal, or Polar.sh references are introduced for core checkout features. (Polar is rejected and banned).
- [ ] **Idempotent Webhooks:** IPN webhook handlers must check for existing purchases/subscriptions using a database unique constraint to prevent double-activation.

---

## 5. Compliance & Security

- [ ] **FTC Disclosure:** All generated user videos must include a 3-second `#ad` overlay rendered via FFmpeg.
- [ ] **GDPR Account Actions:** Verify that new data tables are mapped to the GDPR `/api/account/export` JSON generator and the `/api/account/delete` soft-delete anonymizer.
- [ ] **PII Filter:** Sensitive user credentials, tokens, or PII must never be output to standard logging utilities.

---

## 6. Testing Quality Gate

- [ ] **Vitest Suite:** All changes must pass the entire unit test suite locally (`npm test` in the `apps/sophia-ai-factory` directory).
- [ ] **Test Coverage:** New business logic must include corresponding unit tests in a `.test.ts(x)` file in the same directory.
