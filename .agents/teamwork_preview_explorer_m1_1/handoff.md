# Handoff Report: R1 Production Origin & Trusted Domain Hardening

**Agent**: Explorer 1 (`teamwork_preview_explorer_m1_1`)  
**Parent**: Orchestrator (`4b4014dc-c889-46e2-94e4-d87757729081`)  
**Timestamp**: 2026-09-19T15:59:00Z  
**Type**: Hard (Task Complete)

---

## 1. Observation

1. **Live Production HTTP Probing**:
   - `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: https://sophia.agencyos.network" ...` returned `HTTP/2 403` with body `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`.
   - `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" -H "Origin: https://sophia.agencyos.network" ...` returned `HTTP/2 403` with body `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`.
   - `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: https://sophia-ai-factory.agencyos-openclaw.workers.dev" ...` returned `HTTP/2 403` with body `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`.
   - `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: http://127.0.0.1:3000" ...` returned `HTTP/2 403` with body `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`.
   - `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: http://localhost:3000" ...` returned `HTTP/2 200 OK`, created user `Test`, set cookie `__Secure-better-auth.session_token`, and returned active session object.

2. **Source Code Structure**:
   - `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` (lines 45–56):
     ```typescript
     const isProduction = process.env.NODE_ENV === 'production';
     const baseURL =
       process.env.BETTER_AUTH_URL ||
       process.env.APP_URL ||
       (isProduction
         ? 'https://sophia.agencyos.network'
         : 'http://localhost:3000');

     const trustedOrigins = isProduction
       ? [baseURL]
       : [baseURL, 'http://localhost:3000', 'http://127.0.0.1:3000'];
     ```
   - `apps/sophia-ai-factory/wrangler.toml` (lines 133–227):
     `[vars]` block completely omits `BETTER_AUTH_URL` and `APP_URL`.
   - `apps/sophia-ai-factory/.open-next/server-functions/default/handler.mjs` (line 161067):
     In the compiled production artifact, the bundler statically evaluated `isProduction` as `true` and inlined `trustedOrigins` as:
     `let o2 = process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://sophia.agencyos.network", p2 = [o2];`
     and passed `trustedOrigins: p2` to `betterAuth({...})`.

3. **Better Auth Middleware Engine**:
   - `node_modules/better-auth/dist/api/middlewares/origin-check.mjs` (lines 95–114):
     `validateOrigin` checks `originHeader` against `trustedOrigins`. If not matched, it logs `Invalid origin: ${originHeader}` and throws `APIError.from("FORBIDDEN", BASE_ERROR_CODES.INVALID_ORIGIN)`.
   - `node_modules/better-auth/dist/auth/trusted-origins.mjs` (lines 13–26):
     `matchesOriginPattern` performs strict exact origin matching `pattern === getOrigin(url)` for non-wildcard HTTP/HTTPS URLs.

---

## 2. Logic Chain

1. From Observation 1, `http://localhost:3000` is accepted, while `https://sophia.agencyos.network`, `https://sophia-ai-factory.agencyos-openclaw.workers.dev`, and `http://127.0.0.1:3000` are rejected as `INVALID_ORIGIN`.
2. From Observation 2 and Observation 3, Better Auth only accepts origins present in `trustedOrigins`. In the deployed bundle, `trustedOrigins` was inlined as `[o2]` where `o2 = process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://sophia.agencyos.network"`.
3. Because `http://localhost:3000` was the ONLY origin accepted and `127.0.0.1:3000` was rejected, `trustedOrigins` in the running isolate is `["http://localhost:3000"]`.
4. This proves that `o2` resolved to `"http://localhost:3000"`, caused by `process.env.BETTER_AUTH_URL` being set to `http://localhost:3000` in Cloudflare Workers secrets/env without being overridden by canonical values in `wrangler.toml` `[vars]`.
5. Furthermore, `better-auth-server.ts` failed to include `https://sophia.agencyos.network`, `https://sophia-ai-factory.agencyos-openclaw.workers.dev`, and dev origins deterministically and unconditionally in `trustedOrigins`.
6. Therefore, hardening requires two complementary fixes:
   - Defensively and unconditionally declaring all canonical origins in `better-auth-server.ts`'s `trustedOrigins` array.
   - Adding `BETTER_AUTH_URL` and `APP_URL` to `wrangler.toml` `[vars]` set to `https://sophia.agencyos.network`.

---

## 3. Caveats

1. Cloudflare Workers secrets (set via `wrangler secret put`) take precedence over `wrangler.toml` `[vars]`. While adding `BETTER_AUTH_URL` and `APP_URL` to `[vars]` guarantees baseline parity, `better-auth-server.ts` MUST also contain the defensive guard against `localhost` in production so that even a stale secret cannot break auth.
2. Magic link creation and verification also involve user creation hooks in `better-auth-server.ts` (lines 157–159: `if (!name) throw new Error('Name is required')`). This is in scope for R3 and must be addressed so that magic-link users without an explicit name fall back to email prefix.

---

## 4. Conclusion

1. **Root Cause**: Better Auth 403 `INVALID_ORIGIN` is caused by `trustedOrigins` containing only `["http://localhost:3000"]` on live edge due to `process.env.BETTER_AUTH_URL` resolving to `http://localhost:3000` and `trustedOrigins` being constrained to `[baseURL]` without static canonical origin inclusions.
2. **Remediation Specification for Worker**:
   - In `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts`:
     - Add `CANONICAL_TRUSTED_ORIGINS` containing:
       - `https://sophia.agencyos.network`
       - `https://sophia-ai-factory.agencyos-openclaw.workers.dev`
       - `https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev`
       - `http://localhost:3000`
       - `http://localhost:8787`
       - `http://127.0.0.1:3000`
       - `http://127.0.0.1:8787`
     - Guard `baseURL` in production: if `BETTER_AUTH_URL` includes `localhost`, ignore it and force `'https://sophia.agencyos.network'`.
     - Build `trustedOrigins` unconditionally: `Array.from(new Set([...CANONICAL_TRUSTED_ORIGINS, ...dynamicOrigins]))`.
   - In `apps/sophia-ai-factory/wrangler.toml` under `[vars]`:
     - Add `BETTER_AUTH_URL = "https://sophia.agencyos.network"`
     - Add `APP_URL = "https://sophia.agencyos.network"`
     - Add `NEXT_PUBLIC_APP_URL = "https://sophia.agencyos.network"`
   - Add unit tests in `apps/sophia-ai-factory/src/seed/auth/__tests__/better-auth-origin.test.ts`.

---

## 5. Verification Method

To independently verify after implementation:
1. **Live Edge Origin Probing**:
   ```bash
   curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" \
     -H "Origin: https://sophia.agencyos.network" \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-test@agencyos.network"}'
   ```
   **Expected**: HTTP 200 OK (not 403 `INVALID_ORIGIN`).
2. **Edge Preview Domain Probing**:
   ```bash
   curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" \
     -H "Origin: https://sophia-ai-factory.agencyos-openclaw.workers.dev" \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-test-workers-dev@agencyos.network","password":"Password123!","name":"Smoke"}'
   ```
   **Expected**: HTTP 200 or 400 (application response, not 403 `INVALID_ORIGIN`).
3. **Local Suite Verification**:
   ```bash
   npm run type-check
   npx vitest run src/seed/auth/
   npm run doctor
   ```
