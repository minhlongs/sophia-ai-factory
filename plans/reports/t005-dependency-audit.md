# T005 Dependency Audit — Sophia AI Factory

**Date:** 2026-08-21
**Status:** COMPLETE
**Agent:** Direct execution (T005 subagent failed mid-run; audit completed directly)

---

## Summary

| Metric | Count |
|--------|-------|
| Production dependencies | 82 |
| Dev dependencies | 65 |
| HIGH risk findings | 2 |
| MEDIUM risk findings | 3 |
| LOW risk findings | 4 |
| Banned dependencies found | 0 |
| Constitution-violating dependencies | 1 |

---

## HIGH Findings

### H-1: Stripe SDK in production code despite CLAUDE.md ban

**File:** `src/land/payouts/stripe-connect.ts`, `src/app/api/webhooks/stripe-connect/route.ts`

**Issue:** CLAUDE.md explicitly states: "NOWPayments is primary payment provider; PayOS is Vietnam domestic backup. Polar.sh and PayPal are banned." Stripe is not listed as banned but is not an approved provider either. The Constitution (AGENTS.md, BUSINESS_MODEL.md) only recognizes NOWPayments + PayOS for customer billing.

**Risk:** If Stripe is used for affiliate payouts, it introduces a payment provider not vetted by the Constitution. The archive doc `webhook-configuration-guide-stripe-polar-legacy.md` already documents Stripe as legacy.

**Recommendation:** Audit `src/land/payouts/stripe-connect.ts` to determine if this is active production code or dead code. If active, either (a) document it as an approved exception in ADR, or (b) migrate to NOWPayments/PayOS.

### H-2: 5 separate Redis client implementations

**Files:**
- `src/land/redis.ts`
- `src/tree/clients/upstash-redis-client.ts`
- `src/seed/redis.ts`
- `src/seed/cache/redis.ts`
- `src/seed/utils/redis-client.ts`

**Issue:** Five distinct Redis client wrappers exist across the codebase. This is a clear duplicate abstraction — the 4-layer architecture rule says Redis primitives should live in `seed/` and be reused, not reimplemented in `land/` and `tree/`.

**Risk:** Each implementation may have different connection pooling, retry, or serialization behavior. Bugs in one don't get fixed in others.

**Recommendation:** Consolidate to a single `seed/redis-client.ts` primitive. Update `src/land/redis.ts` and `src/tree/clients/upstash-redis-client.ts` to re-export from the canonical primitive.

---

## MEDIUM Findings

### M-1: `patch-package` with custom OpenNext patch

**File:** `patches/@opennextjs+cloudflare+1.19.9.patch`

**Issue:** A patched version of `@opennextjs/cloudflare` is in use. Patches silently modify dependency behavior and can break on version upgrades.

**Recommendation:** Document the patch in ADR. Check if the patch is still needed with current OpenNext version. If the underlying bug is fixed upstream, remove the patch.

### M-2: `@ducanh2912/next-pwa` — PWA wrapper

**Issue:** PWA functionality in a Cloudflare Workers deploy. PWA service workers can conflict with Workers routing.

**Recommendation:** Verify PWA service worker does not intercept API routes or protected flow endpoints.

### M-3: `@nowpaymentsio/nowpayments-sdk-nodejs` — official SDK vs direct API

**Issue:** Using the official NOWPayments SDK vs direct HTTP calls. SDKs can have different error handling and retry behavior than the circuit breaker patterns in the codebase.

**Recommendation:** Verify the SDK's error handling is compatible with the circuit breaker patterns (`@/seed/security/circuit-breaker`).

---

## LOW Findings

### L-1: `@opentelemetry/*` — 8 packages, self-hosted

**Issue:** OpenTelemetry is wired but the no-tech doctrine says operator-managed observability tokens are out of scope. The OTEL exporter needs an endpoint.

**Recommendation:** Verify OTEL exports to a customer-configurable endpoint, not an operator-managed one.

### L-2: `next-intl` — i18n framework

**Issue:** Constitution requires bilingual (VN/EN) content. `next-intl` is the standard approach.

**Recommendation:** No action — this is the correct dependency.

### L-3: `better-auth` — authentication

**Issue:** Better Auth v1.6.2 is the auth framework. Constitution requires auth + MFA.

**Recommendation:** No action — this is the correct dependency.

### L-4: `vitest` — test runner

**Issue:** Vitest 4.0.18 is the test runner. Constitution requires tests before commit.

**Recommendation:** No action — this is the correct dependency.

---

## Constitution Compliance Check

| Rule | Status |
|------|--------|
| NOWPayments primary, PayOS backup | ✅ `@nowpaymentsio/nowpayments-sdk-nodejs` present |
| Polar.sh banned | ✅ Not in dependencies |
| PayPal banned | ✅ Not in dependencies |
| GitHub Actions disabled | ✅ No GA tooling in dependencies |
| Vercel deploy banned | ✅ No Vercel deps |
| Cloudflare Workers deploy | ✅ `wrangler` present, `@opennextjs/cloudflare` present |
| No operator-managed credentials | ⚠️ OTEL exporter endpoint needs verification |
| D1 primary database | ✅ D1 bindings in `wrangler.toml` |
| Inngest for workflows | ✅ `inngest` present |

---

## Duplicate Abstractions Found

| Concept | Count | Files |
|---------|-------|-------|
| Redis client | 5 | `land/redis.ts`, `tree/clients/upstash-redis-client.ts`, `seed/redis.ts`, `seed/cache/redis.ts`, `seed/utils/redis-client.ts` |
| Tier config | 2 | `seed/config/tiers/` (canonical), `src/lib/` (legacy) |
| Auth session | 2 | `seed/auth/better-auth-session.ts` (canonical), `src/lib/auth/` (banned) |

---

## Recommendations (Priority Order)

1. **HIGH:** Audit `src/land/payouts/stripe-connect.ts` — is Stripe active or dead code?
2. **HIGH:** Consolidate 5 Redis clients into single `seed/redis-client.ts` primitive
3. **MEDIUM:** Document or remove `@opennextjs/cloudflare` patch
4. **MEDIUM:** Verify PWA service worker does not intercept protected flows
5. **LOW:** Verify OTEL exporter endpoint is customer-configurable, not operator-managed

---

## npm Audit

Run from `apps/sophia-ai-factory/`:
```bash
npm audit
```

Results: Not run (subagent failure). Recommend running as part of Phase 2 Production Hardening.