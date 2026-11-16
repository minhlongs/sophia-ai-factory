# ROOT CAUSE ANALYSIS — SUPREME COMMAND #04: SOPHIA BYOK AUTHENTICATION RECOVERY

- **Forensic Baseline Commit SHA**: `f586db4790b92b38366fadcb25e5f2873ba2fb58`
- **Branch**: `feat/sophia-anatomy-workflow-explainer`
- **Date**: `2026-11-09`
- **Status**: `RESOLVED & VERIFIED (Local)`

---

## 1. Executive Summary

During customer onboarding in the Sophia Setup Wizard (Step 3 — AI Provider Setup) and Settings BYOK management, clicking **Verify** on **OpenRouter** (`sk-or-v1-...`) or **Anthropic** (`sk-ant-...`) failed in **~39ms** with generic error message `"Xác thực khóa không thành công"`.

Forensic tracing from the React UI down through Edge Middleware, Next.js API routes, upstream provider probes, and D1 persistence identified **three compound root causes**:

1. **Root Cause #1 (Primary — ~39ms Immediate Failure Across All Providers)**: Edge Middleware (`src/middleware.ts:71-74` + `src/seed/security/csrf.ts`) enforces Double-Submit Cookie CSRF validation (`requiresCsrfCheck` + `verifyCsrfToken`) on all `POST`/`PUT`/`PATCH`/`DELETE` requests to `/api/*` (except `/api/auth/*`, `/api/webhooks/*`, `/api/inngest`, `/api/cron/*`, `/api/telegram/*`, `/api/health`). None of the client-side BYOK/Setup Wizard `fetch` calls attached the `x-csrf-token` header from the `csrf-token` cookie. Every `POST /api/setup-wizard/validate-key`, `POST /api/user/byok`, and `POST /api/user/byok/test` from a browser session with a `csrf-token` cookie was rejected at the Edge Middleware layer in ~39ms with `HTTP 403 {"error":"csrf_token_invalid"}` before the route handler ever executed.
2. **Root Cause #2 (Secondary — Upstream Provider Probe Endpoint & Response Validation Drift)**:
   - `src/tree/byok/provider-probe-endpoints.ts` probed `https://openrouter.ai/api/v1/auth/key` instead of OpenRouter's documented key-introspection endpoint `GET https://openrouter.ai/api/v1/key`.
   - `src/app/api/user/byok/test/route.ts` probed `https://openrouter.ai/api/v1/models`, which is a public unauthenticated endpoint returning HTTP 200 even when passed a completely invalid API key (false-positive verification).
   - `src/tree/byok/provider-probe.ts` did not parse/validate upstream JSON payloads on HTTP 200 responses (`PROVIDER_RESPONSE_ERROR`) and lacked structured `errorCode`, `verifiedAt`, `durationMs`, and `correlationId` metadata required by Gate G3.
3. **Root Cause #3 (Tertiary — Setup Wizard Save Contract & Frontend State Machine Race)**:
   - `src/tree/components/setup-wizard/steps/setup-wizard-api.ts` sent `{ provider, apiKey }` to `POST /api/user/byok`, whereas `PostSchema` in `src/app/api/user/byok/byok-route-helpers.ts` requires `{ provider, key }`, causing every Setup Wizard key save to fail Zod validation with HTTP 400 (`Promise.allSettled` silently swallowed the 400s).
   - `src/tree/components/setup-wizard/steps/use-setup-wizard.ts` did not reset key verification status/error on input change (`updateConfig`) and had no sequence counter to discard stale out-of-order responses when a user edited a field mid-flight.
   - Masked placeholder strings (`****...1234`) could be re-submitted without an explicit guard in `/api/user/byok`.

---

## 2. G1 — Full BYOK Architecture & Call-Chain Map

```text
[Browser UI]
 ├── Setup Wizard Step 3: src/tree/components/setup-wizard/steps/ai-brain-step.tsx
 │    ├── Verify click -> useSetupWizard.verifyKey (src/tree/components/setup-wizard/steps/use-setup-wizard.ts)
 │    │    └── requestKeyValidation (src/tree/components/setup-wizard/steps/use-setup-wizard-actions.ts)
 │    │         └── POST /api/setup-wizard/validate-key [with getCsrfHeaders()]
 │    └── Next/Save click -> saveWizardProviderKeys (src/tree/components/setup-wizard/steps/setup-wizard-api.ts)
 │         └── POST /api/user/byok ({ provider, key }) [with getCsrfHeaders()]
 │
 ├── Dashboard BYOK Card: src/forest/components/byok/form/byok-form-sections.tsx
 │    ├── Verify click -> POST /api/setup-wizard/validate-key [with getCsrfHeaders()]
 │    └── Save click   -> POST /api/user/byok ({ provider, key }) [with getCsrfHeaders()]
 │
 └── Settings API Keys Manager: src/components/settings/api-keys-manager-handlers.ts
      ├── Save click   -> POST /api/user/byok [with getCsrfHeaders()]
      ├── Test click   -> POST /api/user/byok/test [with getCsrfHeaders()]
      └── Delete click -> DELETE /api/user/byok [with getCsrfHeaders()]

[Edge Middleware]
 └── src/middleware.ts:71-74 -> requiresCsrfCheck() + verifyCsrfToken() (src/seed/security/csrf.ts)
      └── Compares Cookie `csrf-token` === Header `x-csrf-token` (constant-time XOR)

[API Routes]
 ├── POST /api/setup-wizard/validate-key (src/app/api/setup-wizard/validate-key/route.ts)
 │    └── getCurrentUser() -> probeProviderApiKey(provider, api_key)
 ├── GET/POST/DELETE /api/user/byok (src/app/api/user/byok/route.ts + byok-route-helpers.ts)
 │    └── getCurrentUser() -> PostSchema (sanitizeCredential + isMaskedOrPlaceholderCredential + validateProviderKey)
 │         └── setUserApiKey(userId, provider, key)
 └── POST /api/user/byok/test (src/app/api/user/byok/test/route.ts)
      └── getCurrentUser() -> getUserApiKey(user.id, provider) -> testKeyAgainstProvider()

[Encryption & Persistence]
 ├── src/tree/byok/crypto.ts -> AES-256-GCM (PBKDF2-SHA256 100k iterations, random 16B salt + 12B IV, "v1:" prefix)
 └── src/tree/byok/user-api-key-store.ts -> D1 table `user_api_keys` (keyed by `user_id` + `provider`)

[Runtime Consumer Resolution]
 └── src/tree/byok/resolve-user-api-key.ts -> resolveUserApiKey(userId, provider, envFallback)
      ├── Used by OpenRouter chat/LLM (`src/forest/ZeroCostRouter.ts`, `src/app/api/Sophia-chat/chat-key-resolver.ts`)
      ├── Used by Anthropic / AI SDK (`src/tree/ai/user-api-keys.ts`)
      └── Used by video/voice/avatar pipelines (`elevenlabs`, `d-id`, `heygen`, `fal-ai`, `replicate`, `muapi`)
```

---

## 3. Forensic Timeline of the ~39ms Failure

1. **T = 0ms**: User opens `/vi/dashboard/setup` (or `/vi/onboarding`). Middleware sets `csrf-token=<64-hex>` cookie on the GET response (`src/middleware.ts:107-111`).
2. **T = 5ms**: User enters `sk-or-v1-...` or `sk-ant-...` and clicks **Verify**.
3. **T = 10ms**: `requestKeyValidation` in `use-setup-wizard-actions.ts` sends `fetch('/api/setup-wizard/validate-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ... })` **without** `x-csrf-token`.
4. **T = 39ms**: Edge Middleware (`src/middleware.ts:71`) intercepts `POST /api/setup-wizard/validate-key`. `verifyCsrfToken` sees `cookieToken` present and `headerToken === null`, returning `false`. Middleware immediately returns `403 {"error":"csrf_token_invalid"}` without invoking `validate-key/route.ts` or any upstream network call.
5. **T = 40ms**: `requestKeyValidation` parses `{ error: "csrf_token_invalid" }`. Because `res.ok` is `false` and `data.message_vi` / `data.message` are undefined on the middleware CSRF payload, it returns `fallbackError` (`t('errors.verificationFailed')` = `"Xác thực khóa không thành công"`).
