# Forensic Integrity Audit Report: Milestone 2 — Multi-User Organizations & 5-Tier RBAC

**Work Product**: Milestone 2: Multi-User Organizations & 5-Tier RBAC  
**Auditor**: `teamwork_preview_auditor_m2` (forensic_auditor)  
**Parent Agent**: `78b5382f-0b81-4402-ad59-b06284d61c09`  
**Profile**: General Project (Integrity Mode: development)  
**Verdict**: **CLEAN**  
**Date**: 2026-09-20T05:32:00Z  

---

## 1. Observation

Direct empirical observations, verbatim commands, exit codes, and code line inspections:

### 1.1 Authenticity & Non-Facade Verification
- **`apps/sophia-ai-factory/src/tree/organizations/seat-quota-engine.ts`**:
  - Implements `checkSeatQuota(db, orgId)`.
  - Lines 39–42: Executes parameterized query `SELECT * FROM organizations WHERE id = ?1 LIMIT 1`.
  - Line 49: Computes tier limit using `getMaxSeatsForTier(effectiveTier)`.
  - Lines 54–81: Queries active confirmed members via `SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?1` with backward-compatible fallback to `org_members`.
  - Lines 87–126: Queries in-flight pending invitations via `SELECT COUNT(*) AS count FROM organization_invitations WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2` with `.bind(orgId, now)`.
  - Lines 128–129: Computes `allocated = activeMembers + pendingInvites` and `isAllowed = allocated < maxSeats`.
  - Zero hardcoded mock bypasses or static returns.

- **`apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`**:
  - Implements `createOrgInvitation`, `acceptOrgInvitation`, and `revokeOrgInvitation`.
  - Line 60: Generates high-entropy token via `generateInvitationToken(INVITATION_TTL_MS)`.
  - Lines 67–89: Inserts into `org_invitations` / `organization_invitations` binding `tokenHash` (`?5`), NOT `rawToken`.
  - Lines 111–169: Acceptance looks up token by computing `sha256Hex(token.trim())` and querying `WHERE token_hash = ?1`.
  - Lines 172–174: Enforces single-use invariant: `if (invitation.status !== 'pending') throw new Error(...)`.
  - Lines 177–183: Enforces TTL expiration against current timestamp `now`.
  - Lines 186–189: Re-verifies active seat capacity before member creation to eliminate race condition oversubscriptions.
  - Lines 223–230: Atomically updates `status = 'accepted'` and `accepted_at = now` where `status = 'pending'`.

- **`apps/sophia-ai-factory/src/tree/rbac/permissions.ts` & `src/seed/types/rbac-matrix.ts`**:
  - Complete 5-tier role definition (`owner`, `admin`, `creator`, `billing_manager`, `viewer`) and 5 typed permissions (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`).
  - Precomputed `ROLE_PERMISSION_FLAGS` enables O(1) evaluation in `hasOrgPermission`.
  - Role `viewer` has strictly empty permissions: `viewer: []` and all flags set to `false`.
  - Helper predicates `canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, and `canConfigureWebhooks` evaluate accurately.
  - Anti-privilege escalation checks `canAssignRole` and `canManageMember` prevent `admin` from assigning or managing `owner` or `admin`.

- **`apps/sophia-ai-factory/src/forest/tenant/context-switcher.ts`**:
  - Implements `validateOrgMembership`, `switchActiveOrg`, and `getActiveOrgContext`.
  - Validates active status and membership in both `organization_members` and legacy `org_members`.
  - Lines 191–214: If user attempts to assert an organization they do not belong to, logs a security warning, emits an audit event, and throws `OrgContextError` with code `'MEMBERSHIP_NOT_FOUND'`.
  - Reads active context from header (`x-active-org-id`), cookie (`active_org_id`), or falls back to user's earliest joined active organization.

- **`apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`**:
  - Implements synchronous `assertTenantScope(currentOrgId, targetResourceOrgId)`.
  - Lines 47–50: Trims and normalizes IDs, checking `if (!cleanCurrent || !cleanResource || cleanCurrent !== cleanResource)`.
  - Lines 51–69: Logs structured security event `[security] cross_tenant_violation`, emits non-blocking audit event `logAuditEvent`, and throws `CrossTenantViolationError`.
  - Error message starts with `CROSS_TENANT_VIOLATION:` matching regex `/CROSS_TENANT_VIOLATION/` with `code = 'CROSS_TENANT_VIOLATION'`.

### 1.2 Security & Integrity Checks
- **Raw Tokens Not Stored**: Verified via codebase grep and inspection of `invitation-service.ts` (lines 70–87) and `invitation-token.ts` (lines 28–50). Only 64-character SHA-256 hex digests (`token_hash`) are persisted.
- **Viewer Role 0 Mutations**:
  ```typescript
  viewer: {
    canCreateMissions: false,
    canManageBilling: false,
    canInviteMembers: false,
    canPublishVideos: false,
    canConfigureWebhooks: false,
  }
  ```
  Verified: `viewer` has 0 granted permissions; `assertOrgPermission('viewer', perm)` throws `RbacPermissionError` (status 403) on any permission.
- **Strict `assertTenantScope`**: Rejects null, undefined, whitespace, and cross-tenant mismatches synchronously.

### 1.3 Quality Gates & Build Verification
1. **Layer Boundaries**:
   - Command: `bash scripts/check-layer-boundaries.sh`
   - Output:
     ```
     🔍 Checking layer boundaries...
     ✅ All layer boundaries clean
     ```
   - Exit Code: `0`

2. **TypeScript Compilation**:
   - Command: `/opt/homebrew/bin/node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit`
   - Output: `(clean stdout/stderr)`
   - Exit Code: `0`

3. **Milestone 2 Unit, Integration, and E2E Test Suite**:
   - Command:
     ```bash
     /opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run \
       src/__tests__/unit/enterprise/rbac-matrix.test.ts \
       src/__tests__/unit/enterprise/seat-quotas.test.ts \
       src/__tests__/unit/enterprise/invitation-token.test.ts \
       src/__tests__/integration/enterprise/org-invitations-integration.test.ts \
       src/__tests__/integration/enterprise/tenant-isolation-integration.test.ts \
       src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts
     ```
   - Output:
     ```
      Test Files  6 passed (6)
           Tests  102 passed (102)
        Duration  2.86s
     ```
   - Exit Code: `0`

4. **All Enterprise Vitest Test Suites (Regression Check)**:
   - Command:
     ```bash
     /opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run \
       src/__tests__/unit/enterprise/ \
       src/__tests__/integration/enterprise/ \
       src/__tests__/e2e/enterprise/
     ```
   - Output:
     ```
      Test Files  16 passed (16)
           Tests  400 passed (400)
        Duration  4.57s
     ```
   - Exit Code: `0`

---

## 2. Logic Chain

1. **Absence of Facade or Mock Bypasses (Ref: Obs 1.1)**:
   - Every investigated module (`seat-quota-engine.ts`, `invitation-service.ts`, `permissions.ts`, `context-switcher.ts`, `isolation-guard.ts`) contains substantive algorithms executing real SQL queries against SQLite/D1 and standard Web Crypto APIs (`crypto.getRandomValues`, `crypto.subtle.digest`).
   - No mock return statements, constant bypasses, or dummy implementations were detected.
   - Therefore, the codebase represents genuine domain and infrastructural implementation.

2. **Database Integrity & Cryptographic Safety (Ref: Obs 1.1, Obs 1.2)**:
   - Generating 32 cryptographically secure random bytes guarantees 256 bits of entropy ($2^{256}$ states), eliminating collision and enumeration risks.
   - Storing only the SHA-256 digest in `org_invitations.token_hash` ensures that even a full database leakage cannot reveal the raw invitation secrets.
   - Unique partial indexing (`WHERE status = 'pending'`) and foreign key constraints on `org_id` with `ON DELETE CASCADE` guarantee referential integrity and prevent duplicate in-flight invitations for the same email.

3. **Multi-Tenant Isolation & Least Privilege (Ref: Obs 1.1, Obs 1.2)**:
   - Modeling permissions as a non-linear lattice DAG prevents dangerous role collapsing (e.g. `admin` cannot access billing operations, and `billing_manager` cannot mutate operational workflows).
   - `viewer` possesses 0 permissions, preventing unauthorized mutations.
   - Synchronous `assertTenantScope` fails closed immediately on missing or mismatched tenant context, preventing horizontal data leakage.

4. **Architectural & Quality Compliance (Ref: Obs 1.3)**:
   - `scripts/check-layer-boundaries.sh` confirmed strict acyclic layering: `seed` $\leftarrow$ `tree` $\leftarrow$ `forest`, and `seed` $\leftarrow$ `tree` $\leftarrow$ `land`. No illegal imports exist.
   - TypeScript compiler reported zero type errors across the entire codebase.
   - 102/102 Milestone 2 tests and 400/400 enterprise test suites executed and passed cleanly.

---

## 3. Caveats

1. **Production D1 Binding**: Tests verify behavior on in-memory SQLite (`DatabaseSync` / mock D1). Remote Cloudflare D1 deployment and live schema application are scheduled for Milestone 5.
2. **Clock Synchronization**: The 7-day TTL calculation relies on Cloudflare Workers edge node clock accuracy, which is synchronized via NTP within milliseconds.
3. **No External Network Dependencies**: All token generation, hashing, and quota checks operate 100% locally on Web Crypto and in-memory/D1 SQLite, ensuring zero reliance on third-party auth services or external rate-limiters.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 2 (Multi-User Organizations & 5-Tier RBAC) satisfies all integrity, architectural, and security constraints:
- Authenticity verified: Genuine logic implemented across all target files with 0 dummy facades.
- Security verified: Raw tokens are never stored (only SHA-256 hashes), `assertTenantScope` strictly throws `CrossTenantViolationError`, and `viewer` role has 0 mutation permissions.
- Quality gates passed: `tsc --noEmit` exits with code 0 (0 errors), `check-layer-boundaries.sh` exits with code 0 (clean), 102/102 M2 tests pass, and 400/400 enterprise test suite tests pass.

The work product is approved for integration.

---

## 5. Verification Method

To independently reproduce and verify this audit:

```bash
cd apps/sophia-ai-factory

# 1. Run Layer Boundaries Check
bash scripts/check-layer-boundaries.sh

# 2. Run TypeScript Typecheck
/opt/homebrew/bin/node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit

# 3. Run Milestone 2 Test Suite (102 tests)
/opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run \
  src/__tests__/unit/enterprise/rbac-matrix.test.ts \
  src/__tests__/unit/enterprise/seat-quotas.test.ts \
  src/__tests__/unit/enterprise/invitation-token.test.ts \
  src/__tests__/integration/enterprise/org-invitations-integration.test.ts \
  src/__tests__/integration/enterprise/tenant-isolation-integration.test.ts \
  src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts

# 4. Run Full Enterprise Suite (400 tests)
/opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run \
  src/__tests__/unit/enterprise/ \
  src/__tests__/integration/enterprise/ \
  src/__tests__/e2e/enterprise/
```

### Invalidation Conditions
The audit conclusion is invalidated if:
1. `hasOrgPermission('viewer', ...)` returns `true` for any permission.
2. `hasOrgPermission('admin', 'canManageBilling')` returns `true`.
3. `assertTenantScope('org_1', 'org_2')` does not throw an error matching `/CROSS_TENANT_VIOLATION/`.
4. Raw invitation tokens are found in any database table or query.
5. Any layer boundary check or TypeScript compilation error occurs.
