# Handoff Report: R4 Deployment & Verification Tooling, Test Suites, and Auth Origin Diagnostics

**Agent**: Explorer 3 (`teamwork_preview_explorer_m1_3`)  
**Parent Agent**: Orchestrator (`4b4014dc-c889-46e2-94e4-d87757729081`)  
**Type**: Hard Handoff (Investigation Complete)  
**Date**: 2026-09-19T15:58:30Z  

---

## 1. Observation

1. **Production Endpoint Behavior with Origin Header**:
   - Command: `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" -H "Origin: https://sophia.agencyos.network" -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`
     - Verbatim Result:
       ```
       HTTP/2 403
       content-type: application/json
       {"message":"Invalid origin","code":"INVALID_ORIGIN"}
       ```
   - Command: `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`
     - Verbatim Result:
       ```
       HTTP/2 200
       content-type: application/json
       {"status":true}
       ```
   - Command: `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/email" -H "Origin: https://sophia.agencyos.network" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test"}'`
     - Verbatim Result:
       ```
       HTTP/2 403
       {"message":"Invalid origin","code":"INVALID_ORIGIN"}
       ```
   - Command: `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: https://sophia.agencyos.network" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@example.com","password":"testpassword123"}'`
     - Verbatim Result:
       ```
       HTTP/2 403
       {"message":"Invalid origin","code":"INVALID_ORIGIN"}
       ```

2. **Source Code Inspection — Origin Configuration**:
   - File: `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts:45-56`:
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
   - File: `apps/sophia-ai-factory/wrangler.toml:133-150`:
     - Under `[vars]`, neither `BETTER_AUTH_URL` nor `APP_URL` is defined.

3. **Source Code Inspection — Missing Name Handling**:
   - File: `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts:152-160`:
     ```typescript
     const rawName = typeof user.name === 'string' ? user.name : '';
     const name = rawName
       .replace(/[\u0000-\u001f\u007f]/g, '')
       .trim()
       .slice(0, 100);
     if (!name) {
       throw new Error('Name is required');
     }
     return { data: { ...user, name } };
     ```
   - File: `apps/sophia-ai-factory/src/components/stitch/screens/auth/register-page.tsx:59-64`:
     ```typescript
     const result = await authClient.signUp.email({
       name: companyName,
       email,
       password,
       callbackURL: '/dashboard/onboarding',
     });
     ```

4. **Vitest Auth Test Execution**:
   - Command: `node ./node_modules/vitest/vitest.mjs run src/seed/auth/ src/middleware/__tests__/auth-routes.test.ts`
   - Result:
     - 24 test files passed (100%)
     - 284 tests passed (100%)
     - Duration: 2.79s
   - Note on sandbox execution: `npm test` and `npx vitest` fail with `env: node: Operation not permitted` due to shebang resolution in macOS sandbox; direct `node ./node_modules/...` succeeds without permission prompts.

5. **Deployment Script Inspection**:
   - File: `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`:
     - Line 46: `cd "$APP_DIR"`
     - Lines 68-109: Checks `git log origin/main..HEAD` and working tree clean status (bypassed by `ALLOW_UNPUSHED_DEPLOY=1`).
     - Line 309: `npm run type-check`
     - Line 320: `npm test`
     - Line 341: `node scripts/pre-deploy-gate.mjs`
     - Line 366: `SKIP_SENTRY_BUILD=1 SKIP_SYMBOL_UPLOAD=1 npm run build`
     - Line 429: `npx @opennextjs/cloudflare build --skipNextBuild --noMinify`
     - Line 471: `bash scripts/apply-migrations.sh "$PREVIOUS_LIVE_SHA"`
     - Line 496: `npx opennextjs-cloudflare deploy --config wrangler.toml`
     - Lines 548-550: Injects `COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH` via `npx wrangler secret put`.
     - Lines 588-612: Verifies live shortSha and checks `/api/health` and `/login` return HTTP 200.

6. **Sophia Doctor Inspection**:
   - File: `apps/sophia-ai-factory/scripts/sophia-doctor.mjs`:
     - 11 checks: `checkNode()`, `checkEnvVars()`, `checkWranglerBindings()`, `checkMigrations()`, `checkTypeScript()`, `checkMCPWhitelist()`, `checkCIDoctrine()`, `checkGit()`, `checkProdVersion()`, `checkProdHealth()`, `checkBetterStack()`.
     - In proxy environments, `fetch` in `checkProdVersion` and `checkProdHealth` fails with `TypeError: fetch failed (ENOTFOUND)` unless undici's `ProxyAgent` is configured. With `setGlobalDispatcher(new ProxyAgent(proxy))`, both pass HTTP 200.

---

## 2. Logic Chain

1. **From Observation 1 & 2**:
   - POST requests from `Origin: https://sophia.agencyos.network` to Better Auth routes fail with 403 `INVALID_ORIGIN`, while POST requests from `Origin: http://localhost:3000` return 200 OK.
   - `better-auth-server.ts` computes `trustedOrigins` based on `baseURL` and `isProduction = process.env.NODE_ENV === 'production'`.
   - In Cloudflare Workers, `process.env.NODE_ENV` is not guaranteed to be `'production'`.
   - `wrangler.toml` does not define `BETTER_AUTH_URL` or `APP_URL` in `[vars]`.
   - Therefore, `baseURL` evaluates to `'http://localhost:3000'`, and `trustedOrigins` evaluates to `['http://localhost:3000', 'http://127.0.0.1:3000']`.
   - When users browse `https://sophia.agencyos.network`, the browser includes `Origin: https://sophia.agencyos.network`.
   - Better Auth detects that the request origin is neither in `trustedOrigins` nor matches `baseURL`, and rejects it with 403 `INVALID_ORIGIN`.

2. **From Observation 3**:
   - `better-auth-server.ts:157` checks `if (!name) throw new Error('Name is required')`.
   - Magic link flows do not provide a name; they only submit `{ email }`.
   - Registration on `register-page.tsx` submits `{ name: companyName }`. If `companyName` is empty, `name` is empty.
   - Therefore, magic-link authentication for new users and registration without company name throw an unhandled exception during `user.create.before`.
   - Falling back to `user.email.split('@')[0] || 'User'` safely satisfies the name requirement while preserving user creation.

3. **From Observation 4 & 5**:
   - `deploy-with-sha.sh` runs TypeScript check (`npm run type-check`), tests (`npm test`), and `pre-deploy-gate.mjs` before deploying.
   - Pre-existing auth tests (284 tests) all pass.
   - However, no test exists for `better-auth-server.ts` configuration or origin verification.
   - Also, `deploy-with-sha.sh` strictly enforces clean working tree and `origin/main` alignment unless `ALLOW_UNPUSHED_DEPLOY=1` is provided.

---

## 3. Caveats

- **Wrangler Remote Execution**: `npx wrangler d1 migrations list sophia-raas-db --remote` in doctor check requires Cloudflare OAuth or API token. In local offline mode without CF credentials, doctor outputs a non-fatal warning for D1 migrations.
- **Git Working Tree in Sandbox**: The `.agents/` folder contains git-tracked files from past runs. Any agent file writes cause git to show uncommitted files. For Milestone 4 deployment, either stage/commit changes or set `ALLOW_UNPUSHED_DEPLOY=1`.
- **Turbopack Build**: `npm run build` is hardcoded to Turbopack with `SKIP_SENTRY_BUILD=1 SKIP_SYMBOL_UPLOAD=1` due to M1 memory limits. This is doctrine-compliant per `AGENTS.md`.

---

## 4. Conclusion

The root cause of the production Better Auth 403 `INVALID_ORIGIN` bug is fully diagnosed and empirically confirmed. The remediation requires:
1. **`better-auth-server.ts`**: Unconditionally include `https://sophia.agencyos.network`, `https://sophia-ai-factory.agencyos-openclaw.workers.dev`, and localhost in `trustedOrigins` regardless of `NODE_ENV`.
2. **`wrangler.toml`**: Add `BETTER_AUTH_URL = "https://sophia.agencyos.network"` and `APP_URL = "https://sophia.agencyos.network"` under `[vars]`.
3. **`better-auth-server.ts` & `register-page.tsx`**: Add defensive fallback for missing/empty name to email prefix.
4. **Deploy & Verification**: Execute `./scripts/deploy-with-sha.sh` (with `ALLOW_UNPUSHED_DEPLOY=1` if unpushed), followed by curl origin probes and `node scripts/sophia-doctor.mjs`.

---

## 5. Verification Method

1. **Local Test Execution**:
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   node ./node_modules/typescript/bin/tsc --noEmit
   node ./node_modules/vitest/vitest.mjs run src/seed/auth/ src/middleware/__tests__/auth-routes.test.ts
   ```
2. **Live Production Origin Verification (Post-Deploy)**:
   ```bash
   # Magic link sign-in (MUST return 200, NOT 403)
   curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" \
     -H "Origin: https://sophia.agencyos.network" \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-test@agencyos.network"}' | grep -E "HTTP/2 (200|400)|INVALID_ORIGIN"

   # Email sign-in (MUST return 401/400 credential error, NOT 403 INVALID_ORIGIN)
   curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/email" \
     -H "Origin: https://sophia.agencyos.network" \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-test@agencyos.network","password":"dummy"}' | grep -E "HTTP/2 (401|400)|INVALID_ORIGIN"

   # Live edge SHA parity check
   curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"'
   git rev-parse HEAD | cut -c1-8
   ```
3. **Sophia Doctor Verification**:
   ```bash
   node scripts/sophia-doctor.mjs
   ```
   Must exit 0 with 0 errors.
