# BYOK TEST EVIDENCE — SUPREME COMMAND #04

- **Forensic Baseline Commit SHA**: `f586db4790b92b38366fadcb25e5f2873ba2fb58`
- **Branch**: `feat/sophia-anatomy-workflow-explainer`
- **Date**: `2026-11-09`

---

## 1. Automated Test Execution Summary

Command executed from `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory`:

```bash
npx vitest run \
  src/tree/byok/__tests__/ \
  src/app/api/user/byok/ \
  src/tests/customer-journey/onboarding-journey.test.ts \
  src/tree/components/setup-wizard/ \
  src/app/api/telegram/ \
  src/app/api/webhooks/nowpayments/
```

Result:
- **Test Files**: `16 passed (16)`
- **Tests**: `94 passed (94)`
- **Duration**: `3.18s`

---

## 2. G2 / G9 14-Scenario Verification Matrix

| # | Scenario | Expected ErrorCode / Status | Test File & Status |
|---|---|---|---|
| 1 | Empty credential | `VALIDATION_ERROR` (HTTP 400) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 2 | Malformed / masked placeholder (`****...5678`) | `VALIDATION_ERROR` (HTTP 400) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 3 | Valid-shaped but invalid key (upstream 401) | `INVALID_CREDENTIAL` (HTTP 422) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 4 | Valid authorized key (upstream 200 JSON) | `errorCode: null`, `status: 'ACTIVE'` (HTTP 200) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 5 | Provider HTTP 403 | `FORBIDDEN` (HTTP 422) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 6 | Provider HTTP 429 | `RATE_LIMITED` (HTTP 429) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 7 | Provider HTTP 500/503 | `PROVIDER_UNAVAILABLE` (HTTP 502) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 8 | DNS / network failure | `NETWORK_ERROR` (HTTP 502) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 9 | Request timeout (`AbortError`) | `TIMEOUT` (HTTP 502) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 10 | Missing login session | `UNAUTHORIZED` (HTTP 401) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 11 | Wrong tenant / cross-tenant isolation | Isolated by `user.id` in D1 & `resolveUserApiKey` | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 12 | Missing/bad CSRF token (`x-csrf-token`) | Middleware 403 `csrf_token_invalid` fixed by `getCsrfHeaders()` | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 13 | Unsupported provider / config error | `CONFIGURATION_ERROR` (HTTP 400) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |
| 14 | Malformed provider response (200 HTML/bad JSON) | `PROVIDER_RESPONSE_ERROR` (HTTP 502) | `byok-g2-reproduction.test.ts` — **PASS (Local Mock)** |

---

## 3. Static Analysis & Pre-Existing Working Tree Blockers (Directive #3 & #10)

1. **ESLint on all 16 touched/created BYOK files**:
   - `npx eslint --quiet <16 BYOK files>` → **PASS (0 errors, 0 warnings)**.
2. **Clean Architecture Layer Boundaries**:
   - `bash scripts/check-layer-boundaries.sh` → **PASS (`✅ All layer boundaries clean`)**.
3. **TypeScript & Next.js Build**:
   - Next.js Turbopack production compilation succeeded (`✓ Compiled successfully in 16.1s`).
   - All 16 modified/created BYOK files have **0 TypeScript errors**.
   - Full-tree `tsc --noEmit` / post-compile typecheck is **BLOCKED** by 3 pre-existing TypeScript errors in the user's untracked file `src/components/stitch/screens/landing-hero/__tests__/v3-core-landing.test.tsx(82,92,93)` (`Property 'v3Core' does not exist`), which Directive #3 forbids modifying or deleting.
4. **Live External Provider Probe (OpenRouter / Anthropic Live Sandbox Keys)**:
   - **BLOCKED** per Directive #10 and Gate 2 user confirmation (`"Ready — Chạy ngay với Mocks"`): no live sandbox API keys were supplied in environment variables.
