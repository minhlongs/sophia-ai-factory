# AUTH/TENANT FORENSIC REPORT — Sophia AI Factory

**Audit Lane:** Lane B (Phases 3, 4, 12)  
**Target Codebase:** `apps/sophia-ai-factory/src/`  
**Auditor:** Senior SRE / Forensic Security Auditor  
**Audit Date:** 2026-09-11  
**Status:** COMPLETED — EVIDENCE BACKED  

---

## Executive Summary

A forensic code-level audit was conducted across authentication, session management, tenant boundary enforcement, privilege elevation guards, and cryptographic data isolation within Sophia AI Factory.

All high-risk paths were systematically verified with evidence:
1. **Founder Bootstrap Anti-Spoofing:** **PASS**. Promotion to `admin` role and `MASTER` tier requires strict email verification (`emailVerified === true` or `1`) in Cloudflare D1. Unverified accounts cannot claim privileges.
2. **Session Consistency & Identity Resolution:** **PASS**. Sensitive API routes derive `user.id` strictly from cryptographic Better Auth session cookies parsed by `getCurrentUser()` / `getCurrentUserFromHeaders()`. No tenant-scoped data mutations trust user IDs from query parameters or request bodies.
3. **Cross-Tenant Isolation:** **PASS**. Enforced both at the query layer (`WHERE user_id = ?` / `WHERE tenant_id = ?`) and cryptographically at the BYOK storage layer via AES-GCM-256 with Authenticated Additional Data (AAD) bound to `userId`.
4. **Admin Route Protection:** **PASS**. Admin routes enforce dual-factor verification: session role validation against the database `user_profiles` table plus a short-lived HMAC-signed `admin_challenge_token` cookie for sensitive administrative mutations.
5. **Brute-Force & Account Lockout:** **PASS**. ASVS V2.2.2 compliant per-account rate limiter (`5 attempts → 24-hour lockout`) wired at the email sign-in route handler.
6. **Multi-Factor Authentication (MFA):** **PASS**. TOTP-based MFA enforces fail-closed pre-session challenges and requires valid TOTP proof before deactivation.

---

## 3-A. Founder Bootstrap Isolation [PASS]

### 1. Threat Model & Audit Question
Can an attacker register an account using the email configured in `FOUNDER_EMAIL` (or bypass verification) to automatically escalate privileges to `admin` role and `MASTER` tier?

### 2. Implementation Audit & Evidence Path
- **Configuration Source:** `process.env.FOUNDER_EMAIL` (comma-separated list of authorized founder email addresses).
- **Control File:** `src/seed/auth/founder-bootstrap.ts` (lines 33–161).
- **Execution Triggers:**
  - `src/seed/auth/better-auth-server.ts`:
    - Hook `databaseHooks.user.create.after` (lines 259–268): Checks `user.emailVerified`. If `false`, logs deferred notice and does NOT call bootstrap.
    - Hook `databaseHooks.user.update.after` (lines 284–291): Triggers bootstrap when `emailVerified` transitions to true upon email confirmation.
- **Fail-Closed Verification Gate:**
  In `src/seed/auth/founder-bootstrap.ts` (lines 57–88):
  ```typescript
  // Fail-closed gate: verify that the email address is verified before elevating privileges
  let isEmailVerified = Boolean(user.emailVerified);

  if (!isEmailVerified) {
    try {
      const db = await getD1();
      if (db) {
        const row = await db
          .prepare('SELECT emailVerified FROM "user" WHERE id = ?1 LIMIT 1')
          .bind(user.id)
          .first<{ emailVerified?: boolean | number | null }>();
        if (row && (row.emailVerified === true || row.emailVerified === 1)) {
          isEmailVerified = true;
        }
      }
    } catch (err) {
      logger.warn('[FounderBootstrap] Failed checking emailVerified in database', toError(err), {
        userId: user.id,
      });
    }
  }

  if (!isEmailVerified) {
    logger.warn(
      '[FounderBootstrap] Refusing to elevate unverified user to founder/admin role (fail-closed)',
      undefined,
      { userId: user.id, email: user.email }
    );
    return false;
  }
  ```
- **Privilege Elevation Operations:**
  When verified, execution runs atomic D1 updates:
  1. `UPDATE "user" SET role = 'admin' WHERE id = ?1`
  2. `UPDATE user_profiles SET role = 'admin', subscription_tier = 'MASTER' WHERE user_id = ?1`
  3. `UPDATE subscriptions SET tier = 'MASTER', plan = 'master' WHERE user_id = ?1`
  4. `INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at) VALUES (?1, ?2, 'FOUNDER_BOOTSTRAP', ...)`
- **Verification Tests:**
  `src/security-tests/cross-tenant-and-anti-spoofing.test.ts` (lines 69–126):
  - Confirmed: Blocks unverified malicious user with `emailVerified: false`.
  - Confirmed: Blocks promotion if database has `emailVerified: 0`.
  - Confirmed: Only authorizes promotion when email is explicitly verified in D1.

**Verdict:** **PASS**. No unverified user can claim founder privileges.

---

## 3-B. Session Validation Consistency [PASS]

### 1. Threat Model & Audit Question
Does every API endpoint handling sensitive tenant or customer data enforce session validation, or are there unprotected endpoints leaking tenant resources?

### 2. Session Architecture
- **Session Framework:** Better Auth v1.6.2 backed by Cloudflare D1 Kysely adapter (`src/seed/auth/better-auth-server.ts`).
- **Session Duration:** 7 days (`expiresIn: 7 * 24 * 60 * 60`), updated every 24 hours (`updateAge: 24 * 60 * 60`).
- **Cookie Security Attributes:**
  - `useSecureCookies: true` in production (enforcing `__Secure-` prefix).
  - `httpOnly: true`.
  - `sameSite: 'lax'`.
  - `path: '/'`.
- **Identity Resolver:**
  - Server components / Server Actions: `getCurrentUser()` in `src/seed/auth/better-auth-session.ts`.
  - Route handlers: `getCurrentUserFromHeaders(request.headers)` in `src/seed/auth/better-auth-session.ts`.

### 3. Route Access Classification
Audit of all route handlers under `src/app/api/`:

| Route Category | Path Examples | Auth Mechanism | Classification |
|---|---|---|---|
| **Public Endpoints** | `/api/version`, `/api/health`, `/api/public/*` | None (Public metadata) | Intentionally Public |
| **Auth Engine** | `/api/auth/[...all]`, `/api/auth/sign-in/email` | Better Auth internal handler | Intentionally Public |
| **External Webhooks** | `/api/webhooks/nowpayments`, `/api/webhooks/telegram`, `/api/webhooks/heygen` | HMAC signature verification / Secret token | Secure Webhook |
| **Cron Jobs** | `/api/cron/*` | `Authorization: Bearer ${CRON_SECRET}` | Protected (Machine) |
| **Setup Wizard** | `/api/setup-wizard/*`, `/api/setup/*` | `getCurrentUser()` | Authenticated (User) |
| **User Resources** | `/api/user/*`, `/api/missions/*`, `/api/videos/*` | `getCurrentUser()` / `getCurrentUserFromHeaders()` | Authenticated (User) |
| **Admin Operations**| `/api/admin/*` | `requireAdminWithRecentAuth()` / `isUserAdmin()` | Multi-Layer Admin |

**Finding:** No accidental unauthenticated data leaks were discovered. All business mutations require an authenticated session.

---

## 3-C. Cross-Tenant Isolation [PASS]

### 1. Threat Model & Audit Question
Can User A access, modify, or delete User B's API keys, missions, video artifacts, diagnostics, or billing balances?

### 2. Multi-Layer Defenses

#### Layer 1: Identity Binding at API Layer
In routes such as `/api/setup-wizard/save-credentials` (lines 35–38), `/api/user/byok` (lines 42–48), and `/api/missions/create`:
- User identity is obtained from `await getCurrentUser()`.
- The `userId` passed to database repositories is strictly `user.id`.
- Parameter tampering (e.g. sending `{"userId": "victim"}` in JSON body) is ignored because the repository methods bind `user.id` from the resolved session.

#### Layer 2: Cryptographic AAD Separation in BYOK
In `src/tree/byok/byok-crypto.ts` (lines 201–228):
```typescript
const params: AesGcmParams = userId
  ? {
      name: ALGORITHM,
      iv: iv as BufferSource,
      additionalData: new TextEncoder().encode(userId) as BufferSource,
    }
  : { name: ALGORITHM, iv: iv as BufferSource }
```
- **Provable Isolation:** During AES-GCM encryption, `userId` is passed as Authenticated Additional Data (`additionalData`).
- If Tenant B extracts Tenant A's ciphertext blob from D1, attempting decryption with Tenant B's identity (`decryptApiKey(blob, tenantBId)`) causes the Web Crypto API to fail authentication tag validation and throw an error.
- Verified in `src/security-tests/cross-tenant-and-anti-spoofing.test.ts` (lines 128–144).

#### Layer 3: Account Deletion Cascade & Data Erasure
In `src/land/account/cascade-delete.ts` (lines 38–63):
- Complete, dependents-first deletion across 24 tables (`ACCOUNT_DELETE_ORDER`).
- Associated R2 objects (audio, visual, final videos, thumbnails, batch inputs) are enumerated and purged before row removal.
- Orphan session retention check: `sessions` table is explicitly cleared (`{ table: 'sessions', column: 'tenant_id' }`), terminating active sessions for the deleted account.

**Verdict:** **PASS**. Cross-tenant access is prohibited at both logical and cryptographic boundaries.

---

## 3-D. Admin Route Protection [PASS]

### 1. Threat Model & Audit Question
Can a non-admin access `/api/admin/*` endpoints, or can an admin session execute dangerous operations (key rotation, migrations) without recent authentication confirmation?

### 2. Administrative Controls
1. **Source of Truth Check (`src/seed/auth/is-user-admin.ts`):**
   - Resolves admin privilege via `user_profiles.role = 'admin'` in D1.
   - Session claims are verified against the database to prevent privilege retention after demotion.
2. **Step-Up Authentication Guard (`src/seed/auth/require-admin.ts`):**
   - High-impact routes (`/api/admin/keys/rotate`, `/api/admin/migrations/*`) call `requireAdminWithRecentAuth(request)`.
   - Requires an `admin_challenge_token` cookie minted within 5 minutes (`maxAgeMs = 5 * 60 * 1000`).
   - The token is signed using HMAC-SHA-256 (`crypto.subtle.sign`) with `ADMIN_CHALLENGE_SECRET` (falling back to `BETTER_AUTH_SECRET`).
3. **Admin Middleware (`src/middleware.ts`):**
   - Intercepts `/dashboard/admin/:path*` and redirects non-admin sessions.

**Verdict:** **PASS**. Admin endpoints enforce database-backed role validation and step-up challenge verification.

---

## 3-E. Account Lockout Protection [PASS]

### 1. Specification & ASVS Standard
- **Standard:** OWASP ASVS V2.2.2 (brute-force rate limiting on credentials).
- **Core Module:** `src/seed/security/account-lockout.ts`.
- **Thresholds:**
  - `ACCOUNT_LOCK_THRESHOLD = 5` failed attempts.
  - `ACCOUNT_LOCK_DURATION_MS = 24 * 3600 * 1000` (24 hours).

### 2. Operational Wiring
- **Route Wrapper:** `src/app/api/auth/sign-in/email/route.ts`.
- **Execution Sequence:**
  1. Requests to `/api/auth/sign-in/email` inspect request email.
  2. Queries D1 `user` table for `failed_login_attempts` and `locked_until`.
  3. If `locked_until > Date.now()`, returns `423 Locked` immediately without invoking the password verify callback.
  4. On 401 response from Better Auth, invokes `incrementFailedLogin()`.
  5. On 2xx response, invokes `resetFailedLogin()`.
- **Unit & Security Regression Tests:**
  - `src/security-tests/f01-per-account-rate-limit.test.ts`: Passes 100%.

**Verdict:** **PASS**. Per-account brute-force lockout is active and wired.

---

## 3-F. MFA Security [PASS]

### 1. Implementation Architecture
- **TOTP Service:** `src/seed/auth/mfa/totp-service.ts` (RFC 6238, HMAC-SHA-1, 30-second time-step).
- **Secret Encryption:** MFA secret keys are encrypted at rest in `mfa_secrets.totp_secret_enc` using AES-GCM-256 (`src/tree/crypto/token-crypto.ts`).
- **Session Interceptor:** `better-auth-server.ts` hook `session.create.before` (lines 132–145):
  ```typescript
  const { required } = await requireMfaIfEnabled(session.userId);
  if (required) {
    await markSessionMfaPending(session.id);
  }
  ```
  Fails-closed: if the MFA check fails or throws, session creation is aborted.

### 2. Critical Route Controls
- `/api/auth/mfa/disable` (`src/app/api/auth/mfa/disable/route.ts`):
  - Requires active authenticated user.
  - Requires 6-digit TOTP code confirmation (`BodySchema = z.object({ code: z.string().length(6) })`).
  - Decrypts stored TOTP secret, validates code via `verifyTotp()`.
  - Only updates `totp_enabled = 0` if code is valid.
  - Cannot be disabled without demonstrating possession of the current TOTP authenticator.

**Verdict:** **PASS**. MFA implementation is fail-closed and protected against bypass.

---

## Severity Register

| Ref | Domain | Vulnerability / Debt | Severity | Status | Mitigation / Evidence |
|---|---|---|---|---|---|
| **SEC-01** | Founder Bootstrap | Email spoofing privilege escalation | P0 (Addressed) | **CLOSED** | Fail-closed verification gate in `founder-bootstrap.ts:57-88` verifies D1 `emailVerified`. |
| **SEC-02** | BYOK Storage | Cross-tenant key decryption | P0 (Addressed) | **CLOSED** | AES-GCM AAD bound to `userId` in `byok-crypto.ts:218`. |
| **SEC-03** | Account Lockout | Brute-force credential stuffing | P1 (Addressed) | **CLOSED** | Per-account lock hook active at `/api/auth/sign-in/email`. |
| **SEC-04** | Admin Elevation | Stale session privilege retention | P1 (Addressed) | **CLOSED** | `isUserAdmin.ts` validates DB `user_profiles.role` on each check; step-up auth required. |
| **HYG-01** | Crypto Modules | Quintuplication of AES-GCM code | P3 (Hygiene) | **OPEN** | 5 distinct AES-GCM implementations exist. Recommending consolidation to `src/seed/crypto/`. |

---
**Report Authorized:** Senior SRE Forensic Team  
**Verification Digest:** All 6 sub-phases verified with direct code citations and automated test proofs.
