# Handoff Report: Milestone 2 Review & Adversarial Audit

**Agent:** `teamwork_preview_reviewer_m2_2` (reviewer, critic)  
**Parent:** `78b5382f-0b81-4402-ad59-b06284d61c09`  
**Working Directory:** `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/`  
**Date:** 2026-09-20  
**Verdict:** `REQUEST_CHANGES`  

---

## 1. Observation

Direct observations and evidence from code inspections and command executions:

1. **Tenant Isolation Guard (`assertTenantScope`)**:
   - File: `apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`
   - Lines 43–71:
     ```typescript
     export function assertTenantScope(
       currentOrgId: string | null | undefined,
       targetResourceOrgId: string | null | undefined,
     ): void {
       const cleanCurrent = (currentOrgId || '').trim();
       const cleanResource = (targetResourceOrgId || '').trim();

       if (!cleanCurrent || !cleanResource || cleanCurrent !== cleanResource) {
         logger.error('[security] cross_tenant_violation', { ... });
         logAuditEvent({ action: 'CROSS_TENANT_VIOLATION', ... }).catch(() => {});
         throw new CrossTenantViolationError(cleanCurrent, cleanResource);
       }
     }
     ```
   - Lines 16–33:
     ```typescript
     export class CrossTenantViolationError extends Error {
       readonly code = 'CROSS_TENANT_VIOLATION' as const;
       readonly status = 403;
       ...
       super(`CROSS_TENANT_VIOLATION: Current org context '${curr}' is not authorized to access resource in org '${res}'`);
     }
     ```
   - Verbatim check: On org ID mismatch, empty string, whitespace, null, or undefined, `assertTenantScope` strictly throws `CrossTenantViolationError` with property `code = 'CROSS_TENANT_VIOLATION'` and message matching `/CROSS_TENANT_VIOLATION/`.

2. **5-Tier RBAC Matrix & Role Permissions**:
   - File: `apps/sophia-ai-factory/src/seed/types/rbac-matrix.ts`
   - Lines 65–66: `viewer: [] as const`
   - Lines 100–106:
     ```typescript
     viewer: {
       canCreateMissions: false,
       canManageBilling: false,
       canInviteMembers: false,
       canPublishVideos: false,
       canConfigureWebhooks: false,
     }
     ```
   - Lines 79–85, 93–99:
     - `admin.canManageBilling === false`
     - `creator.canManageBilling === false`
     - `billing_manager.canManageBilling === true`
     - `owner.canManageBilling === true`
   - File: `apps/sophia-ai-factory/src/tree/rbac/permissions.ts`
   - Lines 105–120: `canAssignRole(actorRole, targetRole)` prevents `admin` from assigning `admin` or `owner` roles; `viewer`, `creator`, and `billing_manager` return `false` unconditionally.
   - Verbatim check: `viewer` has 0 mutation permissions across all 5 capabilities; only `owner` and `billing_manager` can manage billing.

3. **Cryptographic Token Storage in D1**:
   - File: `apps/sophia-ai-factory/migrations/0277_enterprise_org_invitations.sql`
   - Lines 18–34:
     ```sql
     CREATE TABLE IF NOT EXISTS org_invitations (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
       email TEXT NOT NULL,
       role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'creator', 'billing_manager', 'viewer')),
       token_hash TEXT UNIQUE NOT NULL,
       expires_at INTEGER NOT NULL,
       accepted_at INTEGER DEFAULT NULL,
       created_by TEXT NOT NULL,
       invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
       created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
       status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
     );
     ```
   - File: `apps/sophia-ai-factory/src/seed/security/invitation-token.ts`
   - Lines 20–25: `sha256Hex` computes lowercase hex digest via `crypto.subtle.digest('SHA-256', data)`.
   - Lines 36–49: `generateInvitationToken` uses `crypto.getRandomValues(new Uint8Array(32))` (256-bit CSPRNG, 64 hex characters) and computes `tokenHash = await sha256Hex(rawToken)`.
   - File: `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`
   - Lines 66–76: Insertion binds `tokenHash` to column `token_hash`. No column exists for raw tokens.
   - Verbatim check: Raw tokens are never stored in D1. Only standard SHA-256 digests are persisted.

4. **CAS Token Acceptance Implementation**:
   - File: `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`
   - Lines 192–237:
     ```typescript
     // 5. Add member (enforces UNIQUE constraint on org_id, user_id)
     const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
     let memberInserted = false;

     try {
       await db
         .prepare(
           `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
         )
         .bind(memberId, invitation.org_id, userId, invitation.role, now, now)
         .run();
       memberInserted = true;
     } catch (err) { ... }

     if (!memberInserted) {
       await db
         .prepare(
           `INSERT INTO org_members (id, org_id, user_id, role, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)`
         )
         .bind(memberId, invitation.org_id, userId, invitation.role, now)
         .run();
     }

     // 6. Mark invitation as accepted
     await db
       .prepare(
         `UPDATE ${targetTable}
          SET status = 'accepted', accepted_at = ?1
          WHERE id = ?2 AND status = 'pending'`
       )
       .bind(now, invitation.id)
       .run();

     return {
       success: true,
       orgId: invitation.org_id,
       role: invitation.role,
     };
     ```
   - Verbatim check:
     - Step 5 inserts the member into `organization_members` **before** the CAS update in Step 6.
     - Step 6 executes `UPDATE ... WHERE status = 'pending'` but **does not inspect** `result.meta?.changes`.
     - If two concurrent requests arrive with the same token for different `userId`s, both insert a member in Step 5. Request A updates the row (`changes = 1`); Request B matches 0 rows (`changes = 0`) but ignores the return value and returns `{ success: true }`. Both users become members.

5. **Typecheck & Layer Boundaries Execution**:
   - Command: `/opt/homebrew/bin/node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit`
     - Result: Exit code 0 (0 compilation errors).
   - Command: `bash scripts/check-layer-boundaries.sh`
     - Output:
       ```
       🔍 Checking layer boundaries...
       ✅ All layer boundaries clean
       ```
     - Result: Exit code 0 (0 architectural layer boundary violations).
   - Command: `/opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run src/__tests__/unit/enterprise/rbac-matrix.test.ts src/__tests__/unit/enterprise/seat-quotas.test.ts src/__tests__/unit/enterprise/invitation-token.test.ts src/__tests__/integration/enterprise/org-invitations-integration.test.ts src/__tests__/integration/enterprise/tenant-isolation-integration.test.ts src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`
     - Result: 6 test files passed, 102/102 tests passed in 3.47s.

---

## 2. Logic Chain

1. **Integrity & Conformance Assessment** (Ref: Obs 1.1, Obs 1.2, Obs 1.3, Obs 1.5):
   - Observations show that `assertTenantScope` strictly checks both parameters, trims strings, and throws `CrossTenantViolationError` matching `/CROSS_TENANT_VIOLATION/` with code `'CROSS_TENANT_VIOLATION'`.
   - Observations confirm `viewer` has 0 mutation permissions (`ROLE_PERMISSION_FLAGS.viewer` has all `false`), and `canManageBilling` is true only for `owner` and `billing_manager`.
   - Observations confirm migration `0277` and `invitation-token.ts` generate 256-bit CSPRNG tokens and store exclusively SHA-256 hashes in `token_hash TEXT UNIQUE NOT NULL`.
   - TypeScript compilation and layer boundaries pass with 0 errors.

2. **Concurrency & Atomicity Failure in CAS Token Acceptance** (Ref: Obs 1.4):
   - In any transactional or optimistic concurrency control model (CAS), an update conditioned on `status = 'pending'` is only atomic if the caller branches on whether the condition succeeded (`changes === 1`).
   - In `invitation-service.ts`, line 223 calls `.run()` on the `UPDATE` query without assigning or inspecting the result `meta.changes`.
   - Furthermore, member insertion in `organization_members` is performed in Step 5, prior to attempting the CAS update in Step 6.
   - Because `organization_members` enforces uniqueness on `(org_id, user_id)`, two concurrent requests with distinct `user_id`s will both succeed in Step 5.
   - The second request receives `changes = 0` from SQLite/D1, but since that return value is ignored, it returns `success: true`.
   - Consequently, multiple users can accept the same single-use token concurrently, violating the single-use invariant, bypassing seat quotas, and compromising tenant access control.
   - Therefore, the CAS atomic acceptance requirement is not met.

---

## 3. Caveats

1. **Sequential vs. Concurrent Test Coverage**: The current integration suite (`org-invitations-integration.test.ts`) tests single-use sequentially (`await accept(...)`, followed by a second `await accept(...)`). In sequential execution, the initial `SELECT` finds `status = 'accepted'` and throws `INVITATION_ALREADY_USED`. The vulnerability only surfaces under concurrent/interleaved execution.
2. **SQLite In-Memory Lock Behavior**: In standard single-connection synchronous SQLite, operations are serialized. However, in Cloudflare Workers edge runtime and production D1, HTTP requests arrive asynchronously across concurrent worker isolates, making TOCTOU race windows exploitable.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Milestone 2 cannot be approved in its current state due to a critical concurrency flaw in token acceptance.

### Required Changes:
In `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts` (`acceptOrgInvitation`):
1. **Execute the CAS update before inserting the member**:
   ```typescript
   // 5. Atomic CAS consumption of the invitation token
   const updateResult = await db
     .prepare(
       `UPDATE ${targetTable}
        SET status = 'accepted', accepted_at = ?1
        WHERE id = ?2 AND status = 'pending'`
     )
     .bind(now, invitation.id)
     .run();

   const changes = updateResult.meta?.changes ?? (updateResult as any).changes ?? 0;
   if (changes === 0) {
     throw new Error(`INVITATION_ALREADY_USED: Invitation has already been accepted or revoked`);
   }

   // 6. Add member to organization_members (only reached if token was atomically claimed)
   ...
   ```
2. Alternatively, wrap both the CAS status transition and the member insertion in a D1 atomic batch: `await db.batch([...])`.
3. Add a concurrent race test in `src/__tests__/integration/enterprise/org-invitations-integration.test.ts` using `Promise.all([ acceptOrgInvitation(db, token, 'user_1'), acceptOrgInvitation(db, token, 'user_2') ])` verifying that exactly one caller succeeds and the other fails with `INVITATION_ALREADY_USED`.

---

## 5. Verification Method

To independently verify this report and reproduce the findings:

```bash
cd apps/sophia-ai-factory

# 1. Verify TypeScript type safety (exits 0)
/opt/homebrew/bin/node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit

# 2. Verify layer boundaries (exits 0)
bash scripts/check-layer-boundaries.sh

# 3. Verify unit, integration, and E2E test suites (102 tests pass)
/opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run \
  src/__tests__/unit/enterprise/rbac-matrix.test.ts \
  src/__tests__/unit/enterprise/seat-quotas.test.ts \
  src/__tests__/unit/enterprise/invitation-token.test.ts \
  src/__tests__/integration/enterprise/org-invitations-integration.test.ts \
  src/__tests__/integration/enterprise/tenant-isolation-integration.test.ts \
  src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts

# 4. Inspect the CAS implementation flaw in invitation-service.ts
# File: src/tree/organizations/invitation-service.ts (lines 192-237)
# Notice member insertion at line 198 precedes UPDATE at line 225, and line 225 ignores .run() changes.
```

### Invalidation Conditions
This report's verdict will be updated to `APPROVE` once:
1. `acceptOrgInvitation` executes the CAS `UPDATE` statement before member insertion and throws `INVITATION_ALREADY_USED` when `meta.changes === 0`.
2. A concurrent acceptance test in `org-invitations-integration.test.ts` proves that concurrent acceptance attempts by distinct users allow at most 1 user to join.
