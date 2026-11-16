# PATCH REVIEW — SUPREME COMMAND #04: SOPHIA BYOK AUTHENTICATION RECOVERY

- **Forensic Baseline Commit SHA**: `f586db4790b92b38366fadcb25e5f2873ba2fb58`
- **Branch**: `feat/sophia-anatomy-workflow-explainer`
- **Date**: `2026-11-09`

---

## 1. Files Modified & Created (BYOK Scope Only)

| File | Layer | Change Summary |
|---|---|---|
| `src/seed/security/use-csrf-token.ts` | `seed` | Added `getCsrfHeaders()` helper to read `csrf-token` cookie and return `{ 'x-csrf-token': token }` for client-side mutating `fetch` calls. |
| `src/tree/byok/provider-probe-endpoints.ts` | `tree` | Updated OpenRouter probe target URL to `https://openrouter.ai/api/v1/key` (`GET`), added `ByokErrorCode` union, `generateByokCorrelationId()`, and `isMaskedOrPlaceholderCredential()`. |
| `src/tree/byok/provider-probe.ts` | `tree` | Extended `ProbeResult` with `errorCode`, `durationMs`, `verifiedAt`, `correlationId`; added masked-key guard, JSON response validation (`PROVIDER_RESPONSE_ERROR`), and granular HTTP 401/403/429/5xx/timeout/network classification. |
| `src/tree/byok/provider-health-checker.ts` | `tree` | Synced `PROVIDER_ENDPOINTS.openrouter` to `https://openrouter.ai/api/v1/key`. |
| `src/app/api/setup-wizard/validate-key/route.ts` | `app` | Added `errorCode: 'UNAUTHORIZED'` (401), `errorCode: 'VALIDATION_ERROR'` (400), and HTTP 429 pass-through (`status: 429`). |
| `src/app/api/user/byok/byok-route-helpers.ts` | `app` | Added `isMaskedOrPlaceholderCredential` refinement in `PostSchema` so masked values (`****...1234`) cannot overwrite encrypted keys in D1. |
| `src/app/api/user/byok/test/route.ts` | `app` | Replaced unauthenticated `https://openrouter.ai/api/v1/models` with authenticated `GET https://openrouter.ai/api/v1/key` in `testKeyAgainstProvider`. |
| `src/tree/components/setup-wizard/steps/use-setup-wizard-actions.ts` | `tree` | Attached `getCsrfHeaders()` on `POST /api/setup-wizard/validate-key`; mapped `csrf_token_invalid` (403) and localized `message_vi` / `error_vi` cleanly. |
| `src/tree/components/setup-wizard/steps/setup-wizard-api.ts` | `tree` | Fixed payload key from `{ provider, apiKey }` to `{ provider, key }`, attached `getCsrfHeaders()`, skipped masked placeholders, and checked `res.ok`. |
| `src/tree/components/setup-wizard/steps/use-setup-wizard.ts` | `tree` | Reset key `status` to `'idle'` and cleared `errors[key]` on edit; added `verifySeqRef` per-key sequence guard to ignore stale in-flight verification responses. |
| `src/tree/components/setup-wizard/api-key-input-feedback.tsx` | `tree` | Updated OpenRouter placeholder to `sk-or-v1-...`. |
| `src/forest/components/byok/form/byok-form-sections.tsx` | `forest` | Attached `getCsrfHeaders()` on both `POST /api/setup-wizard/validate-key` and `POST /api/user/byok`; preferred localized `message_vi` when UI locale is Vietnamese. |
| `src/components/settings/api-keys-manager-handlers.ts` | `app/components` | Attached `getCsrfHeaders()` on `POST /api/user/byok`, `POST /api/user/byok/test`, and `DELETE /api/user/byok`. |
| `src/app/api/user/byok/route.test.ts` | `test` | Updated `ProbeResult` mock fixtures with `errorCode`, `durationMs`, `verifiedAt`, `correlationId`. |
| `src/tests/customer-journey/onboarding-journey.test.ts` | `test` | Updated OpenRouter probe URL expectation to `https://openrouter.ai/api/v1/key`. |
| `src/tree/byok/__tests__/byok-g2-reproduction.test.ts` | `test` | Added 10 comprehensive tests covering all 14 G2 failure scenarios, CSRF header attachment, OpenRouter endpoint parity, save contract, tenant isolation, and secret hygiene. |

---

## 2. Compliance with Non-Negotiable Directives

- **Zero `:any` types**: Verified via `npx eslint --quiet` on all 16 touched/created files (`0 errors, 0 warnings`).
- **Clean Architecture Layer Boundaries**: Verified via `bash scripts/check-layer-boundaries.sh` (`✅ All layer boundaries clean`).
- **Zero Plaintext Secret Leakage**: `maskApiKey` masks all keys (`****...last4`), `logger.warn` logs only `{ provider, status, errorCode, httpStatus, latencyMs, correlationId }`, and G7 test asserts raw key bytes never appear in HTTP responses or logger calls.
- **Preservation of Existing User Work**: Untracked/modified `landing-hero`, `baoyuCanvas`, and `sourcesDrawer` files were left completely untouched per Directive #3.
