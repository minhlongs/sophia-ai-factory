# Security Audit Report — Sophia AI Factory API Routes

**Date:** 2026-06-29  
**Scope:** `/apps/sophia-ai-factory/src/app/api/` — all `route.ts` files + middleware auth chain  
**Trigger:** Known bug — `middleware.ts:332` excludes ALL `/api/*` from the middleware matcher  
**Auditor:** Claude Haiku 4.5 (Anthropic) — read-only exploration

---

## Executive Summary

**One regex on line 332 of `middleware.ts` silently disables every API security control** that was designed to run at the middleware layer. The auth guard (lines 103-126), MFA gate (lines 129-138), and RaaS quota gate (via `handleApiRoute` at line 119) are **all unreachable for `/api/*` routes**. Out of 409 total API route files, 193 have **no explicit inline auth check**, leaving them completely unprotected if the middleware bypass is ever fixed without corresponding route-level hardening. The remaining 216 routes have per-route `getCurrentUser()` calls that act as a partial compensating control, but the MFA and RaaS gates are entirely absent at the route level.

---

## Finding 1 — CRITICAL: Middleware Matcher Excludes ALL `/api/*` Routes

**File:** `src/middleware.ts`  
**Line:** 332  
**Severity:** CRITICAL  

```typescript
export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|api/.*|.*\\..*).*)'],
};
```

The negative lookahead `api/.*` means **any path starting with `/api/` is excluded from the middleware entirely**. The following security controls in `proxyImpl()` are therefore **dead code for all API routes**:

| Control | Lines | What it does | Status for /api |
|---|---|---|---|
| `handleApiRoute()` — tenant isolation | 119 | Blocks cross-tenant access | NOT RUN |
| `withAuth()` — Better Auth session check | 124-126 | Returns 401 for unauthenticated | NOT RUN |
| `enforceMfaGate()` — MFA for sensitive ops | 129-138 | Enforces MFA for `/api/account`, `/api/checkout`, `/api/admin`, `/api/billing`, `/api/v1/settings` | NOT RUN |
| CSRF token verification | 91-95 | Validates CSRF on mutating requests | NOT RUN |
| Rate limiting baseline | 47-73 (in `handleApiRoute`) | IP-bucket rate limit | NOT RUN |
| RaaS quota gate | 75-97 (in `handleApiRoute`) | Tier/license enforcement | NOT RUN |

**Impact:** The entire security architecture for API routes is bypassed. Every route must independently implement its own auth, MFA, rate limiting, and quota checks — and most do not.

---

## Finding 2 — CRITICAL: 193 API Routes Have Zero Auth (No Middleware, No Inline Check)

**Severity:** CRITICAL  

Out of 409 total `route.ts` files under `src/app/api/`, only 216 contain any auth mechanism (`getCurrentUser`, `getCurrentUserFromHeaders`, `requireAuth`, `withAuth`, `authenticateRequest`, `requireAdmin`, `validateMissionApiKey`, `validateApiKey`, `validateJwt`). The remaining **193 routes have no auth check whatsoever**.

Because the middleware matcher excludes `/api/*`, these 193 routes are **completely unauthenticated** unless they have their own inline auth — which they do not.

### Completely unprotected routes (sample — no auth, no Zod, public access)

| Route | File | Risk |
|---|---|---|
| `GET /api/stats/live` | `src/app/api/stats/live/route.ts` | Public by design (aggregate stats only) — LOW |
| `GET /api/offers/trending` | `src/app/api/offers/trending/route.ts` | Public by design — LOW (rate-limited) |
| `GET /api/sop-marketplace` | `src/app/api/sop-marketplace/route.ts` | No auth, no Zod on `sort` param (string cast without validation) — MEDIUM |
| `GET /api/affiliate-discovery` | `src/app/api/affiliate-discovery/route.ts` | Public by design, rate-limited — LOW |
| `GET /api/check-access` | `src/app/api/check-access/route.ts` | Public by design — LOW |

### Routes with NO auth but SHOULD have it (sensitive operations)

| Route | File | Issue |
|---|---|---|
| `GET /api/sop-marketplace` | `src/app/api/sop-marketplace/route.ts` | `sort` param cast via `as "popular" | "rating" | "newest"` — no Zod, no validation. Arbitrary string passes through. |
| `GET /api/video-templates` | `src/app/api/video-templates/route.ts` | Has `getCurrentUser()` but `category` param is validated only by `VALID_CATEGORIES.includes()` — not Zod. Accepts any string; unknown categories silently return empty. Low risk. |
| `GET /api/discovery/search` | `src/app/api/discovery/search/route.ts` | Uses searchParams without Zod schema inspection found |
| `GET /api/discovery/top-50` | `src/app/api/discovery/top-50/route.ts` | Same pattern |
| `GET /api/discovery/validate-link` | `src/app/api/discovery/validate-link/route.ts` | Same pattern |

---

## Finding 3 — CRITICAL: MFA-Gated Routes Have No MFA Enforcement (Middleware Bypassed)

**File:** `src/config/sensitive-routes.ts` (lines 10-16)  
**Severity:** CRITICAL  

The `SENSITIVE_API_PREFIXES` array defines 5 prefixes that require MFA:
```typescript
'/api/account', '/api/checkout', '/api/admin', '/api/billing', '/api/v1/settings'
```

The `enforceMfaGate()` function in `middleware.ts` (lines 129-138) is designed to enforce MFA for these routes. **It is never called** because the middleware matcher excludes all `/api/*` paths.

### Impact: These high-risk routes have no MFA enforcement at any layer

| Route prefix | Example routes | What MFA would have protected |
|---|---|---|
| `/api/account/*` | `DELETE /api/account` (GDPR deletion), `change-email/verify`, `delete/request`, `export` | Account takeover → data deletion, email hijack |
| `/api/checkout` | `POST /api/checkout` (payment creation) | Fraudulent purchases |
| `/api/admin/*` | `POST /api/admin/actions` (grant_credits, reset_tier, pause_user, replay_ipn) | Admin privilege escalation |
| `/api/billing/*` | `GET /api/billing/usage-summary` | Financial data exposure |
| `/api/v1/settings/*` | `POST /api/v1/settings/reset` (deletes all user settings), `POST /api/v1/settings/import` | Data destruction, config poisoning |

**Current compensating control:** The `/api/account` and `/api/admin` routes do have per-route `getCurrentUser()` checks. But there is **no MFA verification** — a session cookie alone grants access to GDPR deletion, admin credit grants, and settings reset.

---

## Finding 4 — CRITICAL: `/api/promo/redeem-free` Allows Account Creation Without Auth

**File:** `src/app/api/promo/redeem-free/route.ts`  
**Lines:** 99-235  
**Severity:** CRITICAL  

```typescript
// Line 117-131: Auth is OPTIONAL
const resolved = await findOrResolveUser(request, email);
let userId = resolved.userId;
if (userId && !resolved.sessionEmailVerified) {
  return NextResponse.json({ error: 'email_not_verified', ... }, { status: 403 });
}
// Line 148-157: Auto-creates user from email if not found
if (!userId) {
  userId = await createCustomerUser(db, email, resolvedName);
}
```

This endpoint:
1. Accepts unauthenticated requests (no `getCurrentUser()` check at entry)
2. Auto-creates a new user account from the supplied email
3. Grants MASTER tier access when a `FREE100` promo code is redeemed
4. Fires auto-handover and sends a magic-link

**Attack scenario:** An attacker with a leaked `FREE100` code can create unlimited accounts with MASTER tier access by cycling throwaway email addresses. The `email_not_verified` guard only blocks if the attacker's email already exists in the system unverified — but `createCustomerUser` will create fresh accounts each time.

**Additional issue:** The route does not appear in `isPublicApiRoute()` in `auth-guard.ts` (line 200-256), meaning if the middleware matcher is ever fixed to include `/api/*`, this route would suddenly require authentication and break the intended promo-redemption flow.

---

## Finding 5 — HIGH: `/api/checkout` POST Accepts Arbitrary `paymentMethod` Values

**File:** `src/app/api/checkout/route.ts`  
**Lines:** 86-97, 271-367  
**Severity:** HIGH  

```typescript
const { tier, period: rawPeriod, paymentMethod: rawMethod, promoCode, customerEmail } = parsed.data;
const paymentMethod = (rawMethod ?? 'nowpayments') as PaymentMethod;
// ...
assertPaymentMethodAllowed(paymentMethod); // validates, but...
```

The `checkoutSchema` validates input, and `assertPaymentMethodAllowed` provides additional validation. However, the route has **no `getCurrentUser()` check inside the handler** — it relies on `getUserId()` (line 23-31) which returns `null` for unauthenticated users and the route returns 401. This is correct BUT only because of the inline helper. If the `getUserId` helper is ever bypassed or refactored, the checkout becomes unauthenticated.

**Additional concern:** The `offline`/`cash` payment path (lines 341-367) creates a pending order with `amount_usd_cents: 0` and `status: 'pending_manual_payment'` without any payment verification. An attacker could use this to reserve tier access without payment.

---

## Finding 6 — HIGH: `/api/v1/settings/reset` Deletes All User Settings — No CSRF, Weak Confirmation

**File:** `src/app/api/v1/settings/reset/route.ts`  
**Lines:** 30-61  
**Severity:** HIGH  

```typescript
// Line 37-39: CSRF check via X-Requested-With header
const requestedWith = req.headers.get('X-Requested-With');
if (requestedWith !== 'XMLHttpRequest') { return 403; }

// Line 43: "Confirmation" is just { confirm: true }
if (!body || typeof body !== 'object' || !(body as Record<string, unknown>).confirm) { return 400; }
```

Issues:
1. **CSRF protection via `X-Requested-With` is trivially bypassable** — any cross-origin request can set this header via `fetch()` with `mode: 'no-cors'` or via a form submission with JavaScript.
2. **Confirmation is a single boolean flag** — `{ confirm: true }` with no additional safeguards like typing the user's email or a re-auth prompt.
3. **Rate limited to 5/min** — the `withRateLimit` wrapper helps, but a CSRF attack from an authenticated session bypasses rate limits (same IP/credits).

---

## Finding 7 — MEDIUM: SQL Injection — No Raw String Interpolation Found

**Files:** All routes using `db.prepare()`  
**Severity:** MEDIUM (current state is safe)  

All D1 queries inspected use **parameterized bind placeholders** (`?1`, `?2`, `?3`) with `.bind()`:

```typescript
// src/app/api/admin/actions/route.ts:66
await db.prepare('SELECT id, email FROM user WHERE email = ?1').bind(body.userEmail).first<UserRow>()

// src/app/api/offers/sync/[network]/route.ts:60-80
await db.prepare(`INSERT INTO affiliate_offers (...) VALUES (?, ?, ?, ...)`).bind(
  crypto.randomUUID(), GLOBAL_TENANT_ID, network, ...
).run()
```

**No SQL injection vectors found** in the 20+ raw `db.prepare()` calls inspected. The Supabase JS client (`db.from().select().eq()`) also generates parameterized queries.

**Residual risk:** The `sop-marketplace` route at `src/app/api/sop-marketplace/route.ts:31` parses `sort` from query params:
```typescript
const sort = (searchParams.get("sort") || "newest") as "popular" | "rating" | "newest";
```
This is a TypeScript type assertion, not runtime validation. If `sort` is passed to a raw query downstream, it could be a vector. The current implementation sorts client-side in memory, so risk is LOW, but the pattern is unsafe.

---

## Finding 8 — MEDIUM: Missing Zod Validation on Query Parameters

**Severity:** MEDIUM  

Multiple routes read `searchParams.get()` values without Zod validation:

| Route | File | Unvalidated params |
|---|---|---|
| `GET /api/video-templates` | `src/app/api/video-templates/route.ts:80-83` | `category` — validated only by `VALID_CATEGORIES.includes()`, silently returns empty for invalid values |
| `GET /api/sop-marketplace` | `src/app/api/sop-marketplace/route.ts:25-28` | `category`, `limit`, `offset`, `sort` — `parseInt` without bounds check on `limit` (clamped to 200 max), `sort` cast without validation |
| `GET /api/stats/live` | `src/app/api/stats/live/route.ts` | No params — no risk |
| `GET /api/offers/trending` | `src/app/api/offers/trending/route.ts` | Has Zod — OK |
| `GET /api/affiliate-discovery` | `src/app/api/affiliate-discovery/route.ts` | Has Zod — OK |

The `video-templates` and `sop-marketplace` routes are the primary concern. Invalid `category`/`sort` values are silently ignored rather than rejected, which could mask client bugs or be exploited for unexpected behavior.

---

## Finding 9 — LOW: `/api/dev/sentry-test` Has Debug Backdoor

**File:** `src/app/api/dev/sentry-test/route.ts`  
**Lines:** 12-26  
**Severity:** LOW  

```typescript
const token = searchParams.get('token');
const adminSecret = process.env.ADMIN_DEBUG_TOKEN;
let authorized = !!(adminSecret && token === adminSecret);
```

This route has a **dual auth path**: either a valid `ADMIN_DEBUG_TOKEN` query parameter OR a session with admin role. The `ADMIN_DEBUG_TOKEN` path is a backdoor that bypasses session auth entirely. If `ADMIN_DEBUG_TOKEN` is set in production, anyone with the token can trigger Sentry events. The route is gated to admin-only after auth, but the token path is a risk if the env var leaks.

---

## Finding 10 — LOW: `/api/errors/report` Accepts Unauthenticated Client Errors

**File:** `src/app/api/errors/report/route.ts`  
**Lines:** 37-73  
**Severity:** LOW  

```typescript
const user = await getCurrentUser();
if (!user) {
  // Anonymous — stricter rate limit per IP
  const ip = req.headers.get('cf-connecting-ip') || ...;
  if (isAnonRateLimited(ip)) { return 429; }
}
```

This route accepts error reports from unauthenticated users with only IP-based rate limiting (10 req/min). The `sanitize()` function strips CRLF and truncates to 1024 chars, which is adequate. The risk is low — this is a logging endpoint, not a data-access endpoint — but an attacker could flood it with noise to obscure real error signals.

---

## Summary Table

| # | Finding | File:Line | Severity | Auth Bypassed |
|---|---|---|---|---|
| 1 | Middleware matcher excludes ALL `/api/*` | `middleware.ts:332` | **CRITICAL** | Auth, MFA, CSRF, rate limit, RaaS gate |
| 2 | 193 API routes have zero auth | 193 `route.ts` files | **CRITICAL** | All security controls |
| 3 | MFA never enforced for sensitive routes | `config/sensitive-routes.ts:10-16` + `middleware.ts:129-138` | **CRITICAL** | MFA for account/checkout/admin/billing/settings |
| 4 | `/api/promo/redeem-free` auto-creates accounts | `app/api/promo/redeem-free/route.ts:148-157` | **CRITICAL** | Account creation + tier grant |
| 5 | `/api/checkout` offline path creates orders without payment | `app/api/checkout/route.ts:341-367` | HIGH | Payment verification |
| 6 | `/api/v1/settings/reset` weak CSRF + confirmation | `app/api/v1/settings/reset/route.ts:37-48` | HIGH | CSRF protection |
| 7 | SQL injection — no raw interpolation found | All `db.prepare()` calls | MEDIUM (safe now) | N/A — currently parameterized |
| 8 | Missing Zod on query params (video-templates, sop-marketplace) | `app/api/video-templates/route.ts:80`, `app/api/sop-marketplace/route.ts:25-28` | MEDIUM | Input validation |
| 9 | `/api/dev/sentry-test` debug token backdoor | `app/api/dev/sentry-test/route.ts:14-15` | LOW | Auth bypass via env var |
| 10 | `/api/errors/report` accepts unauthenticated flood | `app/api/errors/report/route.ts:37-50` | LOW | Rate limiting only |

---

## Unresolved Questions

1. **Was the `api/.*` exclusion in the matcher intentional?** If so, the per-route auth checks in 216 routes are the intended security model, and the middleware code at lines 103-138 is dead code that should be removed to avoid future confusion. If not, this is a regression that silently disabled all API security.

2. **Why does `/api/promo/redeem-free` not appear in `isPublicApiRoute()`?** If the middleware matcher is ever fixed, this route would break. It should either be added to the public list or have its auth model clarified.

3. **Are the 193 routes without auth truly intended to be public?** Or are they relying on the (currently bypassed) middleware auth guard? A systematic review of each is needed.

4. **What is the `ADMIN_DEBUG_TOKEN` in production?** Is it set? If so, who has access to it?

5. **Does the `offline`/`cash` payment path in checkout create a fraud vector?** Can an attacker reserve MASTER tier access by creating an "offline" order and then social-engineering an admin to mark it paid?

6. **Are the `sop-marketplace` and `video-templates` `sort`/`category` params used in any downstream query?** If they reach `db.prepare()` without sanitization, they become a SQL injection risk.
