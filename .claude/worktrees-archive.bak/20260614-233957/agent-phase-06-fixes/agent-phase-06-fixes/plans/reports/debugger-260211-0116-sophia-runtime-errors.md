# Sophia AI Factory -- Runtime Error Investigation

## Summary
- Total issues found: 14
- Critical: 3 | Warning: 6 | Info: 5

## Build Status
- Build result: **FAIL**
- TypeScript errors: 1 (`generate-campaign.ts:84` -- `Partial<CampaignRow>` not assignable to `never`)

## Test Status
- Test result: **PASS**
- Test files: 32 passed (32)
- Tests: 241 passed (241)
- Duration: 7.02s

---

## Findings

### 1. [Build] TypeScript compilation error in generate-campaign.ts
- **Severity**: Critical
- **File(s)**: `src/lib/inngest/functions/generate-campaign.ts:84`
- **Description**: `Partial<CampaignRow>` type for `updatePayload` is inferred as `never` when passed to `.update()`. This breaks the production build.
- **Evidence**:
  ```
  Type error: Argument of type 'Partial<CampaignRow>' is not assignable to parameter of type 'never'.
  ```
  The variable `updatePayload` is typed as `Database['public']['Tables']['campaigns']['Update']` (line 70), but Supabase's generated types for `.update()` expects a different shape, resulting in a `never` type collision.
- **Recommendation**: Cast `updatePayload` explicitly: `.update(updatePayload as any)` as temporary fix, or regenerate Supabase types with `npx supabase gen types typescript` to align the `Update` type with the actual table schema.

### 2. [Runtime] InvariantError -- client reference manifest missing for route "/"
- **Severity**: Critical
- **File(s)**: `server.log` (multiple occurrences, lines 20-37)
- **Description**: `next start` produces repeated `InvariantError: The client reference manifest for route "/" does not exist. This is a bug in Next.js.` errors. This causes the root route to fail server-side rendering.
- **Evidence**:
  ```
  Error [InvariantError]: Invariant: The client reference manifest for route "/" does not exist. This is a bug in Next.js.
      at Object.get (.next/server/chunks/ssr/apps_sophia-ai-factory_apps_sophia-ai-factory_7461503d._.js:1:14266)
  ```
  Logged 9 times. Also: `TELEGRAM_BOT_TOKEN is not defined. Telegram bot functionality will be disabled.`
- **Recommendation**: This is a known Next.js 16 bug with deeply nested monorepo structures. Run `rm -rf .next && npx next build` for a clean build. If persists, set `outputFileTracingRoot` in `next.config.ts` to the correct workspace root, or remove duplicate lockfiles.

### 3. [Module Init] Supabase browser client throws at module scope
- **Severity**: Critical
- **File(s)**: `src/lib/supabase/client.ts:7-9`
- **Description**: The browser Supabase client throws `Error('Missing required environment variables...')` at module import time (top-level scope). If any server-side code or build-time import touches this module when env vars are missing, it crashes the entire process.
- **Evidence**:
  ```typescript
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: ...')
  }
  export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
  ```
- **Recommendation**: Wrap in lazy initialization (factory function or getter), matching the pattern already used in `server.ts` and `admin.ts`. Module-scope throws are dangerous in Next.js because modules can be imported during build/SSR even when not needed.

### 4. [Hydration] Navbar className uses window check in render
- **Severity**: Warning
- **File(s)**: `src/app/components/layout/navbar.tsx:59`
- **Description**: The `cn()` call evaluates `typeof window !== "undefined" && !window.location.hash` during render. Server-side, `typeof window !== "undefined"` is `false`; client-side it's `true`. This produces different class names between SSR and hydration, causing a hydration mismatch warning.
- **Evidence**:
  ```typescript
  pathname === link.href || (link.href.startsWith("/#") && pathname === "/" && typeof window !== "undefined" && !window.location.hash)
    ? "text-[var(--neon-cyan)]"
    : "text-muted-foreground hover:text-foreground"
  ```
- **Recommendation**: Move the `window.location.hash` check into a `useEffect` + state pattern, or remove the window check and rely only on pathname for initial render.

### 5. [Logger] Logger utility is a complete no-op
- **Severity**: Warning
- **File(s)**: `src/lib/utils/logger-utility.ts:83-84`
- **Description**: The `log()` function formats the entry but discards it with `void formatLogEntry(entry)`. No console output ever occurs. All `logger.info()`, `logger.warn()`, `logger.error()` calls throughout the codebase do nothing.
- **Evidence**:
  ```typescript
  // No-op: console statements removed for production cleanliness
  void formatLogEntry(entry);
  ```
- **Recommendation**: This was intentionally stripped for "production cleanliness," but it means zero observability. Consider conditional logging: output in development, or pipe to a structured log service in production (Vercel Logs, Sentry, etc.).

### 6. [Env] Polar client initialized with empty access token
- **Severity**: Warning
- **File(s)**: `src/lib/polar.ts:4`
- **Description**: If `POLAR_ACCESS_TOKEN` is not set, the client initializes with an empty string `''`. The `Polar` SDK will accept this but all API calls will fail with auth errors at runtime.
- **Evidence**:
  ```typescript
  const accessToken = (process.env.POLAR_ACCESS_TOKEN || '').replace(/\\n$/, '').trim();
  export const polar = new Polar({ accessToken, ... });
  ```
  Compare with `src/lib/clients/polar-client.ts:19-23` which properly guards with `throw new Error('POLAR_ACCESS_TOKEN must be set')`.
- **Recommendation**: Add a guard: if `!accessToken` in production, throw or warn. Or consolidate to use only `polar-client.ts` (which has proper guards) and remove `polar.ts`.

### 7. [Env] Dummy Redis/Telegram tokens in production
- **Severity**: Warning
- **File(s)**: `src/lib/redis.ts:3-4`, `src/lib/telegram/telegram-bot-instance.ts:3`
- **Description**: Both files use fallback dummy tokens: `'https://dummy-url.upstash.io'` / `'dummy_token'` for Redis; `'dummy_token_for_build'` for Telegram. If env vars are missing in production, these create silently broken clients instead of failing fast.
- **Evidence**:
  ```typescript
  // redis.ts
  const url = process.env.UPSTASH_REDIS_REST_URL || 'https://dummy-url.upstash.io'
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy_token'

  // telegram-bot-instance.ts
  const token = process.env.TELEGRAM_BOT_TOKEN || 'dummy_token_for_build'
  ```
- **Recommendation**: These dummy fallbacks are needed for build-time imports. Consider lazy initialization (factory pattern) instead, so real tokens are only required at runtime.

### 8. [Env] Tier config uses potentially undefined POLAR_PRODUCT_IDs
- **Severity**: Warning
- **File(s)**: `src/config/tiers.ts:17,34,54,78`
- **Description**: `polarProductId: process.env.POLAR_PRODUCT_ID_STARTER` etc. can be `undefined` at runtime. Checkout flow in `src/lib/polar-config.ts` relies on these being set. If missing, checkout silently fails or redirects to error page.
- **Evidence**:
  ```typescript
  BASIC: { polarProductId: process.env.POLAR_PRODUCT_ID_STARTER, ... },
  PREMIUM: { polarProductId: process.env.POLAR_PRODUCT_ID_GROWTH, ... },
  ```
- **Recommendation**: Add a startup validation function that checks all required `POLAR_PRODUCT_ID_*` env vars and logs a warning if missing, or throw during server startup.

### 9. [Security] CRON_SECRET undefined allows bypass
- **Severity**: Warning
- **File(s)**: `src/app/api/ingestion/trigger/route.ts:9`, `src/app/api/intelligence/score/route.ts:9`
- **Description**: When `CRON_SECRET` is undefined, the auth check becomes `authHeader !== 'Bearer undefined'`. An attacker sending `Authorization: Bearer undefined` would pass the check (bypassed in production mode). The development fallthrough makes this less severe but still a risk.
- **Evidence**:
  ```typescript
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  ```
- **Recommendation**: Guard with `if (!process.env.CRON_SECRET) return 500` before comparison. Or use early return: `if (!CRON_SECRET || authHeader !== ...) { return 401 }`.

### 10. [Deprecation] Middleware convention deprecated in Next.js 16
- **Severity**: Warning
- **File(s)**: `src/middleware.ts`
- **Description**: Next.js 16.1.6 warns during build: `The "middleware" file convention is deprecated. Please use "proxy" instead.` The middleware still works but will eventually be removed.
- **Evidence**: Build output: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
- **Recommendation**: Plan migration to `proxy` convention when stable. Not urgent but track as tech debt.

### 11. [Config] Middleware matcher vs logic mismatch
- **Severity**: Info
- **File(s)**: `src/middleware.ts:137-143,151`
- **Description**: The matcher regex excludes `/api` routes: `/((?!api|_next|...))`. But the middleware function body (lines 137-143) checks `pathname.startsWith("/api")` and returns `NextResponse.next()`. This code is unreachable because the matcher already prevents middleware from running on `/api` routes.
- **Evidence**:
  ```typescript
  // Line 151 - matcher excludes /api
  matcher: ["/((?!api|_next|_vercel|setup-wizard|auth/callback|.*\\..*).*)"

  // Lines 137-143 - dead code for /api
  if (pathname.startsWith("/api") || ...) { return NextResponse.next(); }
  ```
- **Recommendation**: Remove the dead code in the middleware function body that handles `/api` routes. It's harmless but adds confusion.

### 12. [Error Handling] No global-error.tsx boundary
- **Severity**: Info
- **File(s)**: `src/app/` (missing `global-error.tsx`)
- **Description**: No `global-error.tsx` exists at root. Errors in root layout or during SSR of layout will crash with an unhandled exception. The `[locale]/error.tsx` only catches errors within that segment.
- **Evidence**: `Glob` search for `**/global-error.tsx` returned 0 results. Existing error boundaries:
  - `src/app/[locale]/error.tsx`
  - `src/app/[locale]/dashboard/error.tsx`
  - `src/app/[locale]/dashboard/campaigns/error.tsx`
  - `src/app/[locale]/dashboard/analytics/error.tsx`
  - `src/app/[locale]/dashboard/settings/error.tsx`
  - `src/app/[locale]/dashboard/support/error.tsx`
  - `src/app/[locale]/dashboard/api-docs/error.tsx`
  - `src/app/[locale]/dashboard/create/error.tsx`
  - `src/app/[locale]/dashboard/system-health/error.tsx`
  - `src/app/[locale]/affiliate-discovery/error.tsx`
- **Recommendation**: Add `src/app/global-error.tsx` to catch root-level rendering errors. Must be a client component with its own `<html>` and `<body>` tags.

### 13. [Env] Duplicate Polar client implementations
- **Severity**: Info
- **File(s)**: `src/lib/polar.ts` vs `src/lib/clients/polar-client.ts`
- **Description**: Two separate Polar client implementations exist. `polar.ts` (eager init, no guard) vs `polar-client.ts` (lazy singleton, proper guard). This creates confusion about which to use and inconsistent error handling.
- **Recommendation**: Consolidate to one implementation. `polar-client.ts` has better patterns (lazy init, env guard). Remove or redirect `polar.ts`.

### 14. [Console] No console.log/warn/error in production code
- **Severity**: Info (positive finding)
- **File(s)**: All `src/**/*.{ts,tsx}`
- **Description**: Zero `console.log`, `console.warn`, `console.error` statements found in production source code. Clean.
- **Recommendation**: None needed. Good practice.

---

## Error Boundaries Coverage

| Route Segment | Error Boundary | Status |
|---|---|---|
| Root (`/`) | `global-error.tsx` | MISSING |
| `[locale]` | `error.tsx` | Present |
| `[locale]/dashboard` | `error.tsx` | Present |
| `[locale]/dashboard/campaigns` | `error.tsx` | Present |
| `[locale]/dashboard/analytics` | `error.tsx` | Present |
| `[locale]/dashboard/settings` | `error.tsx` | Present |
| `[locale]/dashboard/support` | `error.tsx` | Present |
| `[locale]/dashboard/api-docs` | `error.tsx` | Present |
| `[locale]/dashboard/create` | `error.tsx` | Present |
| `[locale]/dashboard/system-health` | `error.tsx` | Present |
| `[locale]/affiliate-discovery` | `error.tsx` | Present |

## API Routes Error Handling

All API routes examined have proper try-catch with structured JSON error responses:
- `/api/checkout` -- POST/GET both wrapped
- `/api/webhooks/polar` -- Multi-level try-catch
- `/api/webhooks/telegram` -- Wrapped
- `/api/health` -- Outer try-catch
- `/api/heygen/create-video` -- Wrapped
- `/api/ingestion/trigger` -- Wrapped
- `/api/intelligence/score` -- Wrapped
- `/api/setup/save` -- Multi-level try-catch
- `/api/discovery/search` -- Wrapped

## Priority Fix Order

1. **[P0]** Fix TS build error in `generate-campaign.ts` (blocks deployment)
2. **[P0]** Investigate InvariantError in server.log (clean build + `outputFileTracingRoot`)
3. **[P1]** Refactor `supabase/client.ts` to lazy init (prevents module-scope crash)
4. **[P1]** Fix navbar hydration mismatch
5. **[P2]** Guard CRON_SECRET undefined bypass
6. **[P2]** Consolidate dual Polar clients
7. **[P2]** Add `global-error.tsx`
8. **[P3]** Restore logger to functional state
9. **[P3]** Add env var startup validation

## Unresolved Questions

- Is the InvariantError caused by the nested monorepo structure (`mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory/`) or a Next.js 16 Turbopack regression? Need to test with `outputFileTracingRoot` set.
- Was the logger intentionally disabled (`void formatLogEntry`) or accidentally broken during a cleanup pass?
- Are there runtime scenarios where `src/lib/supabase/client.ts` is imported server-side (which would crash)?
