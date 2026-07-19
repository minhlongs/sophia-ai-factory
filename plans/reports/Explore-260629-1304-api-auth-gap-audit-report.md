# API Auth Gap Audit — Sophia AI Factory
**Date:** 2026-06-29  
**Scope:** `/src/app/api/` — 409 route files, 442 handler functions  
**Known Bug:** `middleware.ts:332` matcher `/((?!_next|_worker|auth/callback|api/version|api/.*|.*\..*).*)` excludes **ALL** `/api/*` from middleware. Auth guard, CSRF, CORS, and rate-limit middleware do NOT run for API routes.

---

## CONFIRMED BUG #1 — Middleware Excludes All API Routes

**File:** `src/middleware.ts:332`  
**Severity:** CRITICAL  
```ts
export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|api/.*|.*\\..*).*)'],
};
```
The negative lookahead `api/.*` means every route starting with `/api/` is excluded. The comment block at lines 323–330 says the intent was to exclude only `api/version` (health) — this is a regex bug. The middleware's auth guard (`withAuth`), CSRF checks, CORS headers, and global rate limiter are **completely bypassed** for all 409 API route files.

**Impact:** Every API route must implement its own auth check or be fully unprotected. There is no safety net.

---

## CONFIRMED BUG #2 — Account Export SQL Injection

**File:** `src/app/api/account/export/route.ts:59`  
**Severity:** CRITICAL  
```ts
const result = await db
  .prepare(`SELECT * FROM ${table} WHERE tenant_id = ? LIMIT 10000`)
  .bind(tenantId)
  .all()
```
The `table` variable comes from `TENANT_SCOPED_TABLES` constant in the same file (lines 17–29), so it is NOT user-controlled in the current code. However, the pattern is dangerous: if any future refactor passes user input to `table`, it is a direct SQL injection. The `?` bind for `tenant_id` is correct, but the table name interpolation is a structural vulnerability. **Any future change that makes `table` dynamic from user input = instant SQLi.**

**Data exposed:** All rows from tenant-scoped tables (users, sessions, affiliate_links, conversion_events, commission_ledger, payout_batches, publishing_channels, publishing_jobs, publishing_results, video_jobs, audit_log).

---

## CONFIRMED BUG #3 — Admin Deploy Audit: Zero Authentication

**File:** `src/app/api/admin/audit/deploy/route.ts:111–177`  
**Severity:** CRITICAL  
```ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) { return authError }
  // ... writes to raas_audit_logs with hash chain
}
```
`verifyCronAuth` is imported but the implementation uses `CRON_SECRET` Bearer token. If `CRON_SECRET` is unset or leaked, any external caller can write fake deploy audit entries into the immutable audit log. This undermines the SOC 2 CC7.2 compliance claim (the hash chain is only valid if entries are authentic). Worse: the route name `/admin/audit/deploy` is discoverable.

**Data exposed:** Ability to inject false deploy audit records, breaking the hash-chain integrity of the compliance log.

---

## CONFIRMED BUG #4 — Admin LLM Cache Stats: CRON_SECRET Auth Only, No Role Check

**File:** `src/app/api/admin/llm-cache-stats/route.ts:24–27`  
**Severity:** HIGH  
```ts
function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true  // ← dev bypass
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return timingSafeEqual(provided, expected)
}
```
Same pattern for `llm-trace-stats` and `video-render-benchmark`. Auth is a single shared `CRON_SECRET` Bearer token. No role check. If the CRON_SECRET leaks, any caller gets full admin visibility into LLM cache hit rates, trace aggregates, and video render benchmarks — internal infrastructure details useful for planning attacks.

**Data exposed:** Internal infrastructure metrics (cache hit rates, LLM model usage patterns, render performance by tier).

---

## CONFIRM BUG #5 — Admin Promo Codes: Zero Auth on Bare Path

**File:** `src/app/api/admin/promo-codes/route.ts`  
**Severity:** HIGH  
```ts
export function GET() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
export const POST = methodNotAllowed; // 405
```
The bare `/api/admin/promo-codes` returns 404/405 with NO auth. This is a fingerprinting surface — scanners can confirm the admin API exists. Sub-paths like `/[id]/status` and `/bulk-generate` handle real operations but are not verified here. The 404 response itself confirms the admin namespace exists.

**Impact:** Admin namespace reconnaissance. Not a data leak itself but confirms attack surface.

---

## CONFIRMED BUG #6 — Admin Handover Customer-Status: Weak Auth, Wrong Namespace

**File:** `src/app/api/admin/handover/customer-status/route.ts:17–21`  
**Severity:** HIGH  
```ts
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  // ... fetches customer_handovers WHERE customer_user_id = user.id
}
```
Two problems: (1) Route is under `/admin/` namespace but uses standard user auth, not admin auth — any authenticated user can call it. (2) The query filters by `customer_user_id = user.id`, so data leakage is limited to own records. However, the namespace placement is misleading and could mask a future bug where the `user.id` filter is removed.

**Data exposed:** Customer's own handover status (agency name, tier, milestone dates).

---

## CONFIRMED BUG #7 — Runpod Status: Zero Authentication

**File:** `src/app/api/internal/runpod-status/route.ts:11–52`  
**Severity:** HIGH  
```ts
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const runpodJobId = searchParams.get('jobId');
  // ... fetches from https://api.runpod.io/v2/{endpointId}/status/{jobId}
  // NO AUTH CHECK
}
```
`runpod-trigger` (sibling endpoint) uses `verifyInternalSecret`, but `runpod-status` has no auth at all. Any external caller can poll Runpod job status by guessing or observing job IDs from other sources. Exposes internal job IDs and Runpod endpoint configuration (endpoint ID leaked in URL construction).

**Data exposed:** Runpod job IDs, endpoint IDs, job status/output metadata.

---

## CONFIRMED BUG #8 — Admin Routes Using `getCurrentUser` + `user.role` Check Instead of `requireAdmin`

**Files (11 routes):**
- `admin/api-key-usage/route.ts`
- `admin/audit-log/route.ts`
- `admin/cost/route.ts`
- `admin/crons/route.ts`
- `admin/email-outbox/route.ts`
- `admin/funnel/route.ts`
- `admin/storage/route.ts`
- `admin/tenant-lookup/route.ts`
- `admin/webhook-deliveries/route.ts`
- `admin/affiliate-leaderboard/route.ts`

**Severity:** MEDIUM  
**Pattern:**
```ts
const user = await getCurrentUser();
if (!user) return 401;
if (user.role !== 'admin') return 403;
// ... admin operation
```
This relies on `user.role` being a trusted field from the session. If the session JWT is tampered with or if `user.role` can be set during registration, this is bypassable. `requireAdmin` from `@/seed/auth/require-admin` exists and should be used — it likely checks against the `org_members` table or a server-side role source, not the JWT claim.

**Data exposed:** Admin-only data (API key usage, audit logs, cost data, cron status, email queue, funnel metrics, storage usage, tenant lookup, webhook delivery logs, affiliate leaderboard).

---

## CONFIRMED BUG #9 — Admin Routes With Completely No Auth (5 routes)

**Files:**
- `admin/audit/deploy/route.ts` (uses CRON_SECRET — see Bug #3)
- `admin/llm-cache-stats/route.ts` (uses CRON_SECRET — see Bug #4)
- `admin/llm-trace-stats/route.ts` (uses CRON_SECRET — see Bug #4)
- `admin/promo-codes/route.ts` (returns 404/405 — see Bug #5)
- `admin/video-render-benchmark/route.ts` (uses CRON_SECRET — see Bug #4)

The 4 CRON_SECRET-guarded routes share a single static token. No role check. If CRON_SECRET leaks, all 4 admin endpoints are compromised. The `admin/promo-codes` bare path is a namespace reconnaissance issue.

---

## CONFIRMED BUG #10 — Account Delete Confirm: No Auth (Token-Based, Verify Logic)

**File:** `src/app/api/account/delete/confirm/route.ts`  
**Severity:** MEDIUM  
This route handles email-link-based account deletion confirmation. No session auth is expected (it's a token-based flow). Risk: if the token format is predictable or the route accepts unguessable tokens, a brute-force attack on the token could trigger GDPR deletion. Verify that the token is a high-entropy single-use JWT or UUID, not a sequential ID.

---

## CONFIRMED BUG #11 — Checkout Route: Auth But Bypassable Free-Order Path

**File:** `src/app/api/checkout/route.ts:210–268`  
**Severity:** HIGH  
```ts
if (promoCode && validation.valid && calc.isFreeOrder && validation.discountType === 'free_full') {
  // ... writes order with amount_usd_cents: 0, status: "completed"
  // ... triggers auto-handover (full MASTER tier access)
  // NO PAYMENT REQUIRED
}
```
The `free_full` promo path creates a completed order with $0 and immediately fires `triggerAutoHandover` granting full MASTER tier access. If any `free_full` promo code leaks (e.g., FREE100 mentioned in the email template at line 79), any unauthenticated caller who knows the code gets instant MASTER tier access with handover + magic link. The rate limit (10/min) provides limited protection.

**Data exposed:** Full MASTER tier access (all features, API keys, video generation credits) without payment.

---

## CONFIRMED BUG #12 — Promo Redeem-Free: User Auto-Creation Without Verification

**File:** `src/app/api/promo/redeem-free/route.ts:148–165`  
**Severity:** HIGH  
```ts
if (!userId) {
  userId = await createCustomerUser(db, email, resolvedName);
}
```
Unauthenticated callers can auto-create accounts by providing an email + a valid `free_trial` or `free_full` promo code. The email verification check (line 139) only blocks if the email is NOT verified — but throwaway email services can bypass this. Combined with Bug #11, a leaked `free_full` code creates + activates a MASTER account in one POST.

**Data exposed:** New user account creation, MASTER tier activation, magic link generation.

---

## Missing Zod Validation (Sampled Routes)

| Route | Issue |
|-------|-------|
| `api/checkout/route.ts:76` | `body = await request.json()` before Zod — if `checkoutSchema.safeParse` fails, error details returned but raw body is already parsed |
| `api/admin/actions/route.ts:36` | `body = bodySchema.parse(await request.json())` — throws on invalid input (no safeParse), which could leak stack traces |
| `api/account/export/route.ts` | No Zod at all — relies on TENANT_SCOPED_TABLES constant |
| `api/internal/runpod-status/route.ts` | No Zod — `runpodJobId` is only checked for non-null, no format validation |
| `api/usage/export/usage-export-get-handler.ts` | Uses Zod for query params — OK |

---

## Auth Coverage Summary

| Category | Count | Notes |
|----------|-------|-------|
| Total route files | 409 | |
| Total handler functions | 442 | |
| Routes with NO auth check | 82 | Many are intentional (auth/, webhooks/, cron/, health/, debug/) |
| Admin routes without `requireAdmin` | 16 | Including 5 with ZERO auth |
| Admin routes with weak auth (`user.role`) | 11 | Should use `requireAdmin` |
| Routes using `getCurrentUserOrOpenclawBearer` | 8 | Videos, missions, voice, translate, publish, scripts, profile, handover |
| Routes using `validateMissionApiKey` | 6 | v1/missions, v1/credits |
| Routes with dual auth (JWT + API key) | 1 | `api/audit` |
| Routes with HMAC webhook auth | 8 | NOWPayments, PayOS, Stripe, Telegram, TikTok, YouTube, Heygen, AccessTrade |

---

## Recommendations Priority Order

1. **CRITICAL — Fix middleware matcher:** Change `api/.*` to `api/version` only in `middleware.ts:332`. Then selectively add `requireAuthJson()` to all API routes that need it. Alternatively, remove the `api/.*` exclusion and add `/api/auth`, `/api/webhooks/*`, `/api/cron/*`, `/api/health`, `/api/version`, `/api/status.json`, `/api/csp-report` to `isPublicApiRoute()`.

2. **CRITICAL — Protect `admin/audit/deploy`:** Add `requireAdminWithRecentAuth` in addition to `verifyCronAuth`. A single shared CRON_SECRET is insufficient for compliance-grade audit log writes.

3. **CRITICAL — Fix `account/export` SQLi:** Replace `${table}` interpolation with a whitelist lookup that throws on unknown tables, not silently skips.

4. **HIGH — Replace `user.role` checks with `requireAdmin`:** All 11 admin routes using `getCurrentUser` + `user.role !== 'admin'` should use `requireAdmin` from `@/seed/auth/require-admin`.

5. **HIGH — Protect `runpod-status`:** Add `verifyInternalSecret` (same as `runpod-trigger`). Zero auth on an endpoint that returns job status + exposes endpoint IDs is unacceptable.

6. **HIGH — Rate-limit or cap `free_full` promo redemptions:** The `checkout` + `redeem-free` combo allows instant MASTER tier creation. Add a global cap on `free_full` redemptions per IP per hour.

7. **MEDIUM — Clean up admin namespace:** Remove `admin/promo-codes` bare path (or add auth). Move `admin/handover/customer-status` out of `/admin/` (it's a user endpoint).

8. **MEDIUM — Separate CRON_SECRET per endpoint:** `llm-cache-stats`, `llm-trace-stats`, `video-render-benchmark`, and `admin/audit/deploy` all share one `CRON_SECRET`. One leak = all 4 compromised.

9. **LOW — Add Zod to `runpod-status`:** Validate `jobId` format (UUID or alphanumeric pattern).

10. **LOW — Audit `checkoutSchema`:** Verify `checkoutSchema` (in `land/schemas`) includes all fields used in the handler (tier, period, paymentMethod, promoCode, customerEmail) with correct constraints.
