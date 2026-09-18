# AUTH, IDENTITY & TENANT ISOLATION FORENSIC AUDIT

**Target:** Sophia AI Factory Authentication & Multi-Tenancy Architecture  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Executive Summary

| Security Boundary | Verdict | Enforcing Symbol / File | Code Evidence |
|---|:---:|---|---|
| **Authentication Engine** | **GREEN** | Better Auth (`src/seed/auth/better-auth-server.ts`) | Strict cookie signing, D1 session persistence, timing-safe hash comparison. |
| **Founder Elevation Gate** | **GREEN** | `bootstrapFounderIfConfigured()` (`founder-bootstrap.ts`) | Fail-closed check requires `emailVerified === true` before role mutation. |
| **BYOK Credential Isolation** | **GREEN** | `encryptValue()` / `decryptValue()` (`tree/credentials/encryption.ts`) | AES-GCM-256 with AAD bound to `userId`. Cross-tenant ciphertext swap throws tamper error. |
| **Mission Access Control** | **GREEN** | `verifyWorkspaceAccess()` (`src/app/api/mission/[id]/route.ts`) | Validates caller workspace membership and asserts `mission.workspaceId === callerWorkspaceId`. |
| **Billing & Tier Isolation** | **GREEN** | `resolveOrgId()` & `change-tier-action.ts` | Upgrades blocked without verified checkout invoice; downgrades scoped strictly to caller's `orgId`. |
| **Storage (R2) Isolation** | **GREEN** | `src/seed/r2/bucket-ops.ts` | Keys partitioned with tenant prefix `tenants/{tenantId}/...` or signed ephemeral access. |

---

## 2. Deep-Dive: Identity Lifecycle & Session Verification

### 2.1 Better Auth Configuration
- **Session Tokens:** 32-byte cryptographically secure random values stored in D1 table `"session"`.
- **Expiration:** Configured with strict TTL (7 days default, rolling refresh on active use).
- **Session Invalidation:**
  - Logout explicitly deletes the session token row from D1.
  - Cascade user deletion in `src/land/account/cascade-delete.ts` purges all active session rows for the target user ID.

### 2.2 Founder Bootstrap Security Verification
- **Vulnerability Hypothesis:** Can an attacker register with `founder@agencyos.network` without owning the inbox and obtain instant `admin` role and `MASTER` tier?
- **Code Audit:** In `src/seed/auth/founder-bootstrap.ts`:
  ```typescript
  let isEmailVerified = Boolean(user.emailVerified);
  if (!isEmailVerified) {
    const row = await db.prepare('SELECT emailVerified FROM "user" WHERE id = ?1 LIMIT 1')
      .bind(user.id)
      .first<{ emailVerified?: boolean | number | null }>();
    if (row && (row.emailVerified === true || row.emailVerified === 1)) {
      isEmailVerified = true;
    }
  }
  if (!isEmailVerified) {
    logger.warn('[FounderBootstrap] Refusing to elevate unverified user to founder/admin role (fail-closed)');
    return false;
  }
  ```
- **Proof:** Tested in `src/security-tests/adversarial-forensic.test.ts`. Unverified founder-like emails are rejected fail-closed.

---

## 3. Adversarial Multi-Tenant Isolation Proofs

### Proof 1: User A Cannot Access User B's BYOK API Keys
- **Mechanism:** `user_provider_credentials` table has composite primary key `(user_id, provider_name)`.
- **Query Structure:** `SELECT * FROM user_provider_credentials WHERE user_id = ? AND provider_name = ?`.
- **Cryptographic Barrier:** Ciphertext is encrypted with Web Crypto AES-GCM using `additionalData = TextEncoder.encode(userId)`. Even if an attacker reads raw database rows from another tenant, decrypting with their own `userId` fails AEAD tag verification and throws `tamper detected`.

### Proof 2: User A Cannot Access or Delete User B's Missions
- **Mechanism:** `/api/mission/[id]` enforces:
  1. `verifyWorkspaceAccess(workspaceId, user.id)` — caller must be member of `workspaceId`.
  2. `mission.workspaceId === workspaceId` — mission must belong to that workspace.
- Any mismatch returns `403 Forbidden`. Tested in `src/security-tests/cross-tenant-and-anti-spoofing.test.ts`.

### Proof 3: User A Cannot Access User B's Billing or Change Tier
- **Mechanism:** `changeTierAction()` in `src/land/billing/actions/change-tier-action.ts` derives `user` from the authenticated cookie session via `getCurrentUser()`. The tenant `orgId` is resolved via `resolveOrgId(user.id, d1)`.
- There is no user-controllable parameter for `orgId` or `userId` in the Server Action mutation.

---

## 4. Residual Architecture Notes

- `user_profiles` schema contains both `user_id` and organizational bindings. Care must continue to be taken when querying cross-organization collaboration features to always assert `verifyWorkspaceAccess()`.
