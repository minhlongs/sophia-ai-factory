# Handoff Report: Explorer 2 (R2 & R3 Investigation)

**Author**: Explorer 2 (`teamwork_preview_explorer_m1_2`)  
**Timestamp**: 2026-09-19T15:58:30Z  
**Type**: Hard Handoff (Milestone 1 Discovery Complete)  
**Detailed Report Reference**: `.agents/teamwork_preview_explorer_m1_2/report.md`

---

## 1. Observation

1. **Missing Variables in Production `wrangler.toml`**:  
   In `apps/sophia-ai-factory/wrangler.toml` lines 133–226, the `[vars]` block defines runtime environment variables such as `NEXT_PUBLIC_DISTRIBUTE_ENABLED = "1"`, `IS_CONFIGURED = "true"`, `OPENNEXT_VERSION = "1.19.11"`, but neither `BETTER_AUTH_URL` nor `APP_URL` is declared.
   In contrast, `apps/sophia-ai-factory/wrangler.staging.toml` lines 71–72 contains:
   ```toml
   BETTER_AUTH_URL = "https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev"
   APP_URL = "https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev"
   ```

2. **Better Auth Base URL & Trusted Origins Fallback in `better-auth-server.ts`**:  
   In `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` lines 45–56:
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
   When `BETTER_AUTH_URL` and `APP_URL` are missing and `process.env.NODE_ENV !== 'production'`, `baseURL` evaluates to `http://localhost:3000` and `trustedOrigins` becomes `['http://localhost:3000', 'http://127.0.0.1:3000']`.

3. **Unhandled Exception in `user.create.before` Hook**:  
   In `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` lines 152–159:
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
   If `user.name` is missing or empty, this throws an uncaught `Error('Name is required')`.

4. **Magic Link Flow Passes No Name**:  
   In `apps/sophia-ai-factory/src/components/stitch/screens/login/login-form.tsx` line 55:
   ```typescript
   const result = await authClient.signIn.magicLink({ email });
   ```
   Better Auth's magic link plugin provisions a new user when the email does not exist, supplying `email` with `name` undefined.

5. **Registration Form Bypasses Validation and Passes Raw Company Name**:  
   In `apps/sophia-ai-factory/src/components/stitch/screens/auth/register-page.tsx`:
   - Line 176 has `<form className="space-y-4" onSubmit={handleSubmit} noValidate>`.
   - Lines 59–64:
     ```typescript
     const result = await authClient.signUp.email({
       name: companyName,
       email,
       password,
       callbackURL: '/dashboard/onboarding',
     });
     ```
   - When a user leaves the company name blank, `companyName` is `""`, causing Better Auth's `user.create.before` hook to throw `Error('Name is required')`.

6. **Database Schema Nullability**:  
   In `apps/sophia-ai-factory/migrations/0003-better-auth.sql` line 11, the `user` table schema is:
   ```sql
   CREATE TABLE IF NOT EXISTS "user" (
     id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
     email TEXT UNIQUE NOT NULL,
     emailVerified INTEGER DEFAULT 0,
     name TEXT,
     ...
   ```
   The column `name` is nullable in the database. The rejection is solely imposed by the `before` hook.

---

## 2. Logic Chain

1. **Origin 403 Logic**:
   - `BETTER_AUTH_URL` and `APP_URL` are missing in `wrangler.toml` [Observation 1].
   - In Cloudflare Workers edge runtime, `process.env.NODE_ENV` is not guaranteed to be `'production'` across all handler contexts.
   - Therefore, `baseURL` falls back to `http://localhost:3000` and `trustedOrigins` falls back to localhost only [Observation 2].
   - When a browser makes a request with `Origin: https://sophia.agencyos.network`, Better Auth checks if the origin is in `trustedOrigins`. Because it is absent, Better Auth returns HTTP 403 `INVALID_ORIGIN`.
   - Even when `NODE_ENV === 'production'`, `trustedOrigins = [baseURL]` only allows the exact `baseURL` and rejects requests coming from `https://sophia-ai-factory.agencyos-openclaw.workers.dev`.

2. **Magic Link & Registration Crash Logic**:
   - In magic-link authentication, only `email` is submitted [Observation 4].
   - When Better Auth auto-creates a new user for an unregistered email, `user.name` is undefined.
   - In email registration without a company name, `noValidate` bypasses client HTML5 validation, and empty string `name: ""` is sent [Observation 5].
   - The `user.create.before` hook throws `Error('Name is required')` whenever `name` is empty or undefined [Observation 3].
   - This causes new magic-link registrations and registrations without explicit company names to abort with an uncaught exception, even though `name` is nullable in the underlying database table [Observation 6].

---

## 3. Caveats

- **External Deploy Attestation / Secrets**: `COMMIT_SHA` and `DEPLOYED_AT` are injected during deploy via Cloudflare Secrets (`wrangler secret put`), which are distinct from `[vars]`. `BETTER_AUTH_URL` and `APP_URL` must live in `[vars]` of `wrangler.toml` so they are immediately bound on worker startup.
- **Client BaseURL**: `better-auth-client.ts` dynamically sets `baseURL: typeof window !== 'undefined' ? window.location.origin : ...`. The client correctly transmits `Origin: https://sophia.agencyos.network` from the browser. The failure was strictly server-side in `better-auth-server.ts` and `wrangler.toml`.

---

## 4. Conclusion

To eliminate 403 `INVALID_ORIGIN` and registration crashes:

1. **R2 Solution**:
   - Add `BETTER_AUTH_URL = "https://sophia.agencyos.network"` and `APP_URL = "https://sophia.agencyos.network"` to `wrangler.toml` under `[vars]`.
   - Update `src/seed/auth/better-auth-server.ts` to deterministically include `https://sophia.agencyos.network`, `https://sophia-ai-factory.agencyos-openclaw.workers.dev`, `http://localhost:3000`, `http://localhost:8787`, and `127.0.0.1` in `trustedOrigins` regardless of `NODE_ENV`.
   - Add defensive read of `globalThis.__env__` for Cloudflare Workers runtime parity.

2. **R3 Solution**:
   - In `better-auth-server.ts` `databaseHooks.user.create.before`: if `name` is empty/missing, fall back to email prefix (`user.email.split('@')[0]` sanitized) instead of throwing `Error('Name is required')`.
   - In `register-page.tsx`: in `handleSubmit`, resolve `name: companyName.trim() || emailPrefix || 'user'` and remove `required` attribute from the `<input id="company">` element in JSX.

---

## 5. Verification Method

1. **Code & Boundary Verification**:
   - Run type-check: `cd apps/sophia-ai-factory && npm run type-check` (Must exit 0).
   - Check layer boundaries: `bash scripts/check-layer-boundaries.sh` (Must exit 0).
   - Run test suite: `npx vitest run src/seed/auth/`.

2. **HTTP Origin Verification**:
   - Post to `/api/auth/sign-up/email`:
     `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: https://sophia.agencyos.network" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Password123!"}'`
     *Verify*: Status is NOT 403 `INVALID_ORIGIN`.
   - Post to `/api/auth/sign-in/magic-link`:
     `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" -H "Origin: https://sophia.agencyos.network" -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`
     *Verify*: Returns HTTP 200 (NOT 403 `INVALID_ORIGIN`).
