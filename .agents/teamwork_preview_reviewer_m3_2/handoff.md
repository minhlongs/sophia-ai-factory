# Adversarial Security, CSRF, and Edge-Runtime Review Report (Milestone 3)

**Author**: Reviewer 2 (`teamwork_preview_reviewer_m3_2`)  
**Role**: Reviewer & Adversarial Critic  
**Timestamp**: 2026-09-19T16:08:00Z  
**Verdict**: **APPROVE**  
**Working Directory**: `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m3_2`  
**Parent Agent**: `orchestrator_auth_fix` (`4b4014dc-c889-46e2-94e4-d87757729081`)

---

## 1. Observation

### 1.1 Reviewed Files and Exact Modifications Observed
1. **`apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts`**:
   - Lines 32–40: Immutable `CANONICAL_TRUSTED_ORIGINS` defines:
     ```typescript
     export const CANONICAL_TRUSTED_ORIGINS: readonly string[] = [
       'https://sophia.agencyos.network',
       'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
       'https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev',
       'http://localhost:3000',
       'http://localhost:8787',
       'http://127.0.0.1:3000',
       'http://127.0.0.1:8787',
     ] as const;
     ```
   - Lines 46–64: `resolveBaseURL()` checks `process.env.BETTER_AUTH_URL`, `process.env.APP_URL`, and Cloudflare isolate context `globalThis.__env__`. If `NODE_ENV === 'production'`, any accidental localhost values are rejected, enforcing `https://sophia.agencyos.network`.
   - Lines 71–106: `resolveTrustedOrigins(customBaseURL?)` builds a deduplicated `Set` combining `CANONICAL_TRUSTED_ORIGINS`, `resolveBaseURL()`, and runtime environment candidates (`TRUSTED_ORIGINS`, `BETTER_AUTH_TRUSTED_ORIGINS`, `NEXT_PUBLIC_APP_URL`). Trailing slashes are stripped via `.trim().replace(/\/+$/, '')`.
   - Lines 112–131: `sanitizeAndResolveUserName(rawName?, email?)` strips control characters `[\u0000-\u001f\u007f]`, trims, limits length to 100 characters, and falls back to the email prefix or `'user'` if name is absent or empty.
   - Lines 250–253: `databaseHooks.user.create.before` resolves name defensively via `sanitizeAndResolveUserName(user.name, user.email)` instead of throwing `Error('Name is required')`.
   - Lines 259–264: `databaseHooks.user.create.after` defensively handles null/undefined `user.email` and `user.name` when generating org slugs and names:
     ```typescript
     const emailStr = typeof user.email === 'string' ? user.email : '';
     const rawPrefix = emailStr.includes('@') ? emailStr.split('@')[0] : (emailStr || 'user');
     const prefix = rawPrefix.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'user';
     const slug = `${prefix}-${orgId.slice(0, 6)}`;
     const orgName = (typeof user.name === 'string' && user.name.trim()) || user.email || 'Personal';
     ```
   - Lines 271–340: Database insertions are executed through `D1Client` and `withD1Retry` with automatic retries and fallback slug generation.

2. **`apps/sophia-ai-factory/wrangler.toml`**:
   - Lines 133–137: Added canonical production URLs under `[vars]`:
     ```toml
     [vars]
     # Auth canonical URLs (Workers runtime env parity - R2)
     BETTER_AUTH_URL = "https://sophia.agencyos.network"
     APP_URL = "https://sophia.agencyos.network"
     ```

3. **`apps/sophia-ai-factory/src/components/stitch/screens/auth/register-page.tsx`**:
   - Line 59: `const resolvedName = companyName.trim() || email.split('@')[0].trim() || 'user';` ensures client-side sign-up payload always provides a valid fallback name.
   - Line 188: Removed `required` attribute from the Company Name input (`id="company"`).

4. **`apps/sophia-ai-factory/src/seed/auth/__tests__/better-auth-server-config.test.ts`**:
   - 19 new tests verifying canonical trusted origins, base URL resolution in production/dev, `wrangler.toml` `[vars]` parity, user name sanitization, control-character stripping, length truncation, and Better Auth hook integration.

### 1.2 Tool Executions and Independent Verification Results
1. **TypeScript Typecheck**:
   - Command: `node ./node_modules/typescript/bin/tsc --noEmit` from `apps/sophia-ai-factory`
   - Result: Exit code `0`, 0 errors.
2. **Layer Boundary Verification**:
   - Command: `bash scripts/check-layer-boundaries.sh` from `apps/sophia-ai-factory`
   - Result: `✅ All layer boundaries clean` (Exit code `0`).
3. **Vitest Unit and Integration Test Suite**:
   - Command: `node ./node_modules/vitest/vitest.mjs run src/seed/auth/ src/middleware/__tests__/auth-routes.test.ts` from `apps/sophia-ai-factory`
   - Result: `Test Files 25 passed (25)`, `Tests 303 passed (303)`, duration 3.77s.
4. **ESLint Code Quality**:
   - Command: `node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/seed/auth/better-auth-server.ts src/components/stitch/screens/auth/register-page.tsx src/seed/auth/__tests__/better-auth-server-config.test.ts`
   - Result: 0 errors, 3 pre-existing function complexity warnings.
5. **Sophia Doctor Edge Diagnostics**:
   - Command: `node scripts/sophia-doctor.mjs` from `apps/sophia-ai-factory`
   - Result: 10 ✅, 0 ❌, 1 ⚠️ (uncommitted git changes on current branch). Node v26.7.0, 11/10 env vars green, wrangler bindings green, 239/239 migrations applied, production health HTTP 200.

---

## 2. Logic Chain

1. **Integrity Assessment**:
   - Source code was thoroughly audited for cheating patterns (hardcoded test returns, facade implementations, mock overrides in production logic).
   - `resolveBaseURL()`, `resolveTrustedOrigins()`, and `sanitizeAndResolveUserName()` contain authentic, production-grade algorithms.
   - All tests in `better-auth-server-config.test.ts` invoke real exported functions and assert real behavior without mocking away the subject under test.
   - Conclusion: **Zero integrity violations detected**.

2. **Origin Validation Security & CSRF Resistance**:
   - Better Auth's origin validation middleware (`node_modules/better-auth/dist/api/middlewares/origin-check.mjs:109`) delegates to `matchesOriginPattern(originHeader, origin)`.
   - Inspection of `node_modules/better-auth/dist/auth/trusted-origins.mjs:25` confirms that when an origin pattern does not contain `*` or `?`, the matcher evaluates:
     `pattern === getOrigin(url)`
   - Because all items in `CANONICAL_TRUSTED_ORIGINS` are explicit, fully-qualified origins without wildcards (`https://sophia.agencyos.network`, etc.), matching requires **strict string equality** against the parsed origin.
   - Subdomain spoofing (e.g. `https://sophia.agencyos.network.evil.com` or `https://evil-sophia.agencyos.network`), open CORS wildcards, port variation attacks, and null origin attacks are completely rejected with HTTP 403 `INVALID_ORIGIN`.
   - In addition, session cookies are configured with `SameSite: 'lax'`, `Secure: true` (in production), and `HttpOnly: true`, preventing CSRF attacks from third-party websites across browser contexts.

3. **Edge Runtime Isolation (Cloudflare Workers Compatibility)**:
   - `better-auth-server.ts` does NOT import any Node.js built-in modules (`fs`, `path`, `net`, `child_process`).
   - Dynamic imports for email sending (`@/tree/email/sender`) are executed lazily only at runtime.
   - UUID generation uses `crypto.randomUUID()`, which is a native Web Crypto API primitive standard across Cloudflare Workers `workerd` runtime.
   - The code accounts for Workers runtime environment peculiarities by checking `(globalThis as unknown as { __env__?: Record<string, unknown> }).__env__` alongside `process.env`.
   - `wrangler.toml` `[vars]` guarantees that Cloudflare Workers injects `BETTER_AUTH_URL` and `APP_URL` into worker isolate bindings.

4. **Registration & Hook Safety (SQLi / XSS / Null Handling)**:
   - **Null / Undefined Handling**: `sanitizeAndResolveUserName` type-checks inputs (`typeof rawName === 'string'`) and falls back safely to email prefix or `'user'`. Magic-link login and company-less sign-up will never crash on undefined name properties.
   - **Control Characters & Special Characters**: `[\u0000-\u001f\u007f]` strips null bytes and terminal control codes; length is hard-capped at 100 characters.
   - **SQL Injection Safety**: User creation hooks write to D1 using `D1Client.from('...').insert(...)`. Tracing through `d1-query-chain-executors.ts:106` demonstrates that column values are passed via parameterized prepared statements (`state.db.prepare(sql).bind(...vals).run()`). Values are never concatenated directly into SQL queries.
   - **XSS Prevention**: Rendering in `buildWelcomeHtml` applies `escapeHtml(raw)`, escaping `&`, `<`, `>`, `"`, `'`, and `/`. `buildMagicLinkHtml` rejects any non-`https://` or non-`http://localhost` protocols, replacing them with `'#'`. React rendering on `register-page.tsx` uses standard JSX text node escaping.

5. **Verdict Derivation**:
   - All four criteria outlined in the user instructions (Origin Validation Security, Edge Runtime Isolation, Registration & Hook Safety, and Test/Typecheck Verification) are fully met with evidence-based verification.
   - Verdict is therefore **APPROVE**.

---

## 3. Adversarial Challenge & Stress-Test Matrix

| Challenge / Scenario | Potential Attack Vector | Expected System Response | Actual Observed Behavior | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Subdomain Spoofing** | Origin: `https://sophia.agencyos.network.attacker.com` | Reject with 403 `INVALID_ORIGIN` | `pattern === getOrigin(url)` fails equality check | **PASS** |
| **Prefix Spoofing** | Origin: `https://attacker-sophia.agencyos.network` | Reject with 403 `INVALID_ORIGIN` | Strict string match fails | **PASS** |
| **HTTP Protocol Downgrade** | Origin: `http://sophia.agencyos.network` | Reject with 403 `INVALID_ORIGIN` | Protocol mismatch fails | **PASS** |
| **Null Origin CSRF** | Origin: `null` (sandboxed iframe / privacy proxy) | Reject with 403 `MISSING_OR_NULL_ORIGIN` | Better Auth origin-check explicitly throws on `"null"` | **PASS** |
| **Magic-Link Missing Name** | User payload has `name: undefined` or `name: ""` | Resolve name from email prefix, create user | Hook returns `{ data: { ...user, name: 'email-prefix' } }` without error | **PASS** |
| **Null Byte / Control Chars** | `name: "Company\u0000Name\u001f"` | Strip control characters | Returns `"CompanyName"` | **PASS** |
| **Buffer Overflow / 10K Chars** | `name: "A".repeat(10000)` | Truncate cleanly | Capped to 100 characters | **PASS** |
| **SQL Injection Payload** | `name: "Robert'); DROP TABLE users;--"` | Escape / parameterize in DB | Parameterized via `db.prepare().bind()` | **PASS** |
| **XSS Payload in Email** | `name: "<script>alert(1)</script>"` | Escape before insertion into HTML | Escaped via `escapeHtml()` to `&lt;script...` | **PASS** |
| **Node.js Environment Absence** | Run inside Cloudflare `workerd` isolate | Resolve base URL from `globalThis.__env__` | `cfBetterAuthUrl` and `cfAppUrl` checked gracefully | **PASS** |

---

## 4. Caveats

1. **Milestone Boundary**: This review verifies source code correctness, local test suites, edge runtime isolation, and static configurations. Live deployment to Cloudflare production edge (`https://sophia.agencyos.network`) and live edge curl verification are part of Milestone 4.
2. **Cloudflare Worker Secrets Precedence**: If a secret named `BETTER_AUTH_URL` was previously set to `http://localhost:3000` via Cloudflare Dashboard secrets, `resolveBaseURL()` contains defensive logic to ignore localhost in production (`NODE_ENV === 'production'`) and fallback to `https://sophia.agencyos.network`. During M4 deployment, confirming secret values via `wrangler secret list` is recommended.

---

## 5. Conclusion

The implementation produced by `teamwork_preview_worker_m2` is rigorous, secure, resilient against CSRF/open-CORS vulnerabilities, and fully compatible with Cloudflare Workers edge runtime isolation.

**Verdict**: **APPROVE**

---

## 6. Verification Method

To independently verify this evaluation:

```bash
cd apps/sophia-ai-factory

# 1. Typecheck: Must exit with code 0
node ./node_modules/typescript/bin/tsc --noEmit

# 2. 4-Layer architectural boundary check: Must exit 0 with "All layer boundaries clean"
bash scripts/check-layer-boundaries.sh

# 3. Vitest auth test suite: Must pass 25 files, 303 tests
node ./node_modules/vitest/vitest.mjs run src/seed/auth/ src/middleware/__tests__/auth-routes.test.ts

# 4. ESLint check on modified files: Must exit with 0 errors
node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js \
  src/seed/auth/better-auth-server.ts \
  src/components/stitch/screens/auth/register-page.tsx \
  src/seed/auth/__tests__/better-auth-server-config.test.ts

# 5. Sophia Doctor diagnostics: Must report 10/10 passed checks (0 errors)
node scripts/sophia-doctor.mjs
```
