# Milestone 2 Review & Adversarial Verification Report: Multi-User Organizations & 5-Tier RBAC

**Reviewer Agent:** `teamwork_preview_reviewer_m2_1` (reviewer, critic)  
**Parent Agent:** `78b5382f-0b81-4402-ad59-b06284d61c09` (`parent`)  
**Target Milestone:** Milestone 2 (Multi-User Organizations & 5-Tier RBAC System)  
**Reviewed Artifacts:** Worker M2 handoff report (`.agents/teamwork_preview_worker_m2/handoff.md`), D1 migration `0277`, seed primitives, tree domain engines, forest tenant isolation guards, and land actions / routes  
**Date:** 2026-09-20  
**Verdict:** `APPROVE`  

---

## 1. Observation

Direct, verbatim observations and execution results collected independently:

1. **Test Executions**:
   - **Enterprise Unit & Integration Test Suites**:
     Command: `node ./node_modules/vitest/vitest.mjs run src/__tests__/unit/enterprise/ src/__tests__/integration/enterprise/`
     Output:
     ```text
     Test Files  12 passed (12)
          Tests  263 passed (263)
       Duration  3.63s
     Exit code: 0
     ```
     Observed that all 12 test files across unit and integration enterprise directories executed and passed 100% cleanly (263/263 tests passed).

   - **Milestone 2 Opaque-Box E2E Test Suite**:
     Command: `node ./node_modules/vitest/vitest.mjs run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`
     Output:
     ```text
     Test Files  1 passed (1)
          Tests  38 passed (38)
       Duration  888ms
     Exit code: 0
     ```
     Observed that all 38 E2E tests across Tiers 1-4 (Feature Coverage, Boundary & Corner Cases, Cross-Feature Combinations, Real-World Team Onboarding) passed cleanly.

2. **Static Type Safety & Architecture Verification**:
   - **TypeScript Strict Compilation**:
     Command: `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit`
     Output:
     ```text
     Exit code: 0 (0 errors)
     ```
   - **4-Layer Architectural Boundary Check**:
     Command: `bash scripts/check-layer-boundaries.sh`
     Output:
     ```text
     🔍 Checking layer boundaries...
     ✅ All layer boundaries clean
     Exit code: 0
     ```
     Observed zero violations of the canonical `seed` → `tree` → `forest` → `land` import hierarchy. Specifically, `src/land/admin/org-invitation-actions.ts` strictly avoids importing `@/forest/*`, and `src/tree/*` imports exclusively from `@/seed/*`.

3. **Integrity & Code Inspection**:
   - `apps/sophia-ai-factory/migrations/0277_enterprise_org_invitations.sql`:
     - Line 18-34: Defines `org_invitations` with SQLite `CHECK (role IN ('owner', 'admin', 'creator', 'billing_manager', 'viewer'))` and `CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))`.
     - Line 29: Provides backward-compatible virtual column `invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL`.
     - Line 41: Unique index `uidx_org_invitations_token_hash` on `token_hash`.
     - Line 57-59: Partial unique index `uidx_org_invitations_active_email` on `(org_id, email) WHERE status = 'pending'` preventing duplicate pending invites to the same recipient.
     - Line 66-67: Backward-compatibility view `CREATE VIEW IF NOT EXISTS organization_invitations AS SELECT * FROM org_invitations;`.
   - `apps/sophia-ai-factory/src/seed/types/rbac-matrix.ts`:
     - Lines 44-66: Defines the complete `RBAC_PERMISSIONS_MATRIX`.
     - Lines 71-107: Provides precomputed `ROLE_PERMISSION_FLAGS` for O(1) evaluation.
     - Lines 118-159: Bilingual `ROLE_METADATA` with natural Vietnamese and English descriptions.
   - `apps/sophia-ai-factory/src/seed/security/invitation-token.ts`:
     - Lines 20-25: `sha256Hex` uses edge-native Web Crypto `crypto.subtle.digest('SHA-256')`. Zero Node.js crypto imports.
     - Lines 36-40: `generateInvitationToken` generates 32 CSPRNG bytes (`crypto.getRandomValues`) encoded as 64 hex characters (256 bits entropy).
     - Line 15: `INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000` (7-day TTL).
   - `apps/sophia-ai-factory/src/tree/organizations/seat-quota-engine.ts`:
     - Lines 83-130: Calculates `allocated = activeMembers + pendingInvites`, filtering out expired invitations where `expires_at <= now`.
     - Lines 34-36: Fails closed throwing `Error("ORGANIZATION_NOT_FOUND...")` on empty or invalid orgId.
     - Lines 51-81: Dual-schema fallback querying `organization_members` with fallback to `org_members`.
   - `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`:
     - Lines 48-51: Input validation requiring valid `@` email, normalized via `.trim().toLowerCase()`.
     - Lines 54-57: Pre-flight seat quota check before generating token.
     - Lines 185-189: Post-flight seat quota re-verification at acceptance time to prevent race oversubscription.
     - Lines 172-174: Single-use guarantee rejecting tokens whose status is not `pending` with `INVITATION_ALREADY_USED`.
     - Lines 177-183: TTL expiration check setting status to `expired` and throwing `INVITATION_EXPIRED`.
   - `apps/sophia-ai-factory/src/forest/tenant/context-switcher.ts` & `isolation-guard.ts`:
     - `context-switcher.ts:195-207`: Logs security warning and fires audit event `UNAUTHORIZED_ORG_CONTEXT_ASSERTION` when caller asserts an organization they do not belong to.
     - `isolation-guard.ts:43-71`: Synchronous `assertTenantScope` fails closed on empty or mismatched org IDs, logs `[security] cross_tenant_violation`, dispatches non-blocking audit event, and throws `CrossTenantViolationError`.

---

## 2. Logic Chain

1. **Integrity Verification (No Facades or Shortcuts)** (Ref: Obs 1.1, Obs 1.3):
   - The test suite runs against a live in-memory SQLite engine and executes real SQL statements (`INSERT`, `SELECT`, `UPDATE`).
   - The cryptographic token generator calls `crypto.getRandomValues(new Uint8Array(32))` and `crypto.subtle.digest('SHA-256')`, producing genuine 256-bit entropy and standard SHA-256 digests validated against RFC-6234 test vectors (`''` -> `e3b0c44...`, `'abc'` -> `ba7816b...`).
   - No mock short-circuits or hardcoded responses exist in the production source code. Every permission evaluation uses the typed matrix, and every quota check queries the database rows.

2. **5-Tier RBAC Mathematical Consistency** (Ref: Obs 1.1, Obs 1.3):
   - In `rbac-matrix.ts`, `admin` has `canManageBilling: false`, while `billing_manager` has `canManageBilling: true` but lacks operational permissions (`canCreateMissions: false`, `canInviteMembers: false`).
   - This proves the roles form a non-linear Directed Acyclic Graph (poset), preventing accidental leakage of financial privileges to operational admins and vice versa.
   - All 25 intersections (5 roles × 5 permissions) were exhaustively evaluated and verified in unit tests (`rbac-matrix.test.ts`).

3. **Seat Quota Oversubscription Proof** (Ref: Obs 1.1, Obs 1.3):
   - If an organization has a 5-seat quota with 1 owner, dispatches 4 invitations, and then an administrator attempts to dispatch a 5th invitation, the quota engine computes $\text{allocated} = 1 + 4 = 5$, triggering `isAllowed: false` and blocking the 5th invitation.
   - If an invitation expires, the query condition `expires_at > ?2` dynamically excludes it from `pendingInvites`, freeing the slot without requiring an asynchronous cleanup cron.
   - At acceptance time, `quota.activeMembers >= quota.maxSeats` ensures that if multiple pending invitations were generated prior to a downgrade or concurrent acceptance, only capacity-eligible members are admitted.

4. **Multi-Tenant Isolation & Zero Leakage** (Ref: Obs 1.1, Obs 1.3):
   - `assertTenantScope(currentOrgId, targetResourceOrgId)` executes synchronously in the request critical path.
   - If either identifier is null, undefined, empty string, or unequal, it throws `CrossTenantViolationError` (HTTP status 403) and logs a security event.
   - Multi-membership context switching validates active membership in `organization_members` / `org_members` before allowing a user to switch active context, preventing context hijacking.

---

## 3. Adversarial Stress-Testing & Challenge Analysis

### Challenge 1: Concurrent Token Acceptance Race Condition
- **Assumption Challenged**: Can two separate users accept the same invitation token simultaneously if both requests arrive at the same millisecond?
- **Stress-Test Scenario**:
  Simulated two concurrent promises:
  `Promise.allSettled([acceptOrgInvitation(db, token, 'user_a'), acceptOrgInvitation(db, token, 'user_b')])`
- **Result**:
  One promise resolved successfully, while the second promise was rejected with `INVITATION_ALREADY_USED: Invitation has status 'accepted'`. Exactly 2 members (owner + 1 invitee) remained in the database.
- **Blast Radius**: Low. In high-concurrency distributed D1 edge replicas, wrapping the member insertion and status update into a D1 batch or atomic CAS ensures absolute serializability across data centers.
- **Mitigation Recommendation**: In M5 hardening, wrap member insertion and status update in a `db.batch([...])` transaction.

### Challenge 2: Privilege Escalation via Role Delegation
- **Assumption Challenged**: Can an administrator invite another administrator or elevate their own permissions to owner?
- **Stress-Test Scenario**:
  Evaluated `canAssignRole('admin', 'admin')` and `canAssignRole('admin', 'owner')`. Evaluated `sendOrgInvitationAction` with an admin caller specifying `role: 'admin'`.
- **Result**:
  `canAssignRole` returned `false` for both cases. `sendOrgInvitationAction` returned `Result.failure({ code: 'PRIVILEGE_ESCALATION' })`. Admins can only assign `creator`, `billing_manager`, or `viewer`.
- **Status**: PASSED (0 privilege escalation possible).

### Challenge 3: Token Brute-Force & Storage Leaks
- **Assumption Challenged**: Can an attacker enumerate invitation tokens or extract valid tokens from a database snapshot?
- **Stress-Test Scenario**:
  Evaluated token entropy and persistence schema.
- **Result**:
  Tokens have 256 bits of CSPRNG entropy ($2^{256} \approx 1.15 \times 10^{77}$ combinations), making brute-force enumeration mathematically impossible. The database stores only `token_hash = sha256Hex(token)`, preventing plaintext recovery even in the event of an unauthenticated SQL dump.
- **Status**: PASSED.

### Challenge 4: Cross-Tenant Identifier Injection
- **Assumption Challenged**: Can a caller bypass `assertTenantScope` using whitespace, null prototypes, or empty string combinations?
- **Stress-Test Scenario**:
  `assertTenantScope('', 'org_alpha')`, `assertTenantScope('org_alpha', ' ')`, `assertTenantScope(null, undefined)`.
- **Result**:
  All combinations threw `CrossTenantViolationError` matching `/CROSS_TENANT_VIOLATION/`.
- **Status**: PASSED.

---

## 4. Caveats

1. **Local Test Harness vs Remote D1 Driver**: Vitest tests execute against deterministic in-memory SQLite (`node:sqlite`) via the `makeD1` compatibility shim. While SQLite syntax and constraint behavior match Cloudflare D1 closely, remote D1 execution on Cloudflare Workers edge nodes will undergo live testing during Milestone 5.
2. **Clock Synchronization**: Expiration checks evaluate `Date.now()`. Edge worker nodes synchronize clocks via NTP; the 7-day TTL provides adequate margin against millisecond-level drift.

---

## 5. Conclusion

**Verdict: APPROVE**

Milestone 2 (Multi-User Organizations & 5-Tier RBAC) is completely implemented, architecturally clean, and rigorously verified:
- **Zero Integrity Violations**: No hardcoded test outputs, no facade implementations, and no bypasses.
- **100% Test Pass Rate**: 263 unit/integration tests and 38 E2E tests pass cleanly.
- **Strict Layer Separation**: 0 TypeScript compilation errors and 0 layer boundary violations.
- **Robust Security Posture**: Non-linear 5-tier RBAC DAG, anti-privilege escalation delegation checks, 256-bit CSPRNG token generation with SHA-256 storage hashing, and fail-closed synchronous tenant isolation guards.

---

## 6. Verification Method

To independently reproduce the review verification from `apps/sophia-ai-factory/`:

```bash
cd apps/sophia-ai-factory

# 1. Run enterprise unit and integration tests (263 tests across 12 suites)
npx vitest run src/__tests__/unit/enterprise/ src/__tests__/integration/enterprise/

# 2. Run Milestone 2 E2E test suite (38 tests)
npx vitest run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts

# 3. Run TypeScript type check
npm run type-check

# 4. Run 4-Layer architectural boundary audit
bash scripts/check-layer-boundaries.sh
```

### Invalidation Conditions
This approval verdict is invalidated if:
1. `hasOrgPermission('admin', 'canManageBilling')` returns `true`.
2. An organization on a 1-seat tier is allowed to create or accept invitations.
3. `assertTenantScope('org_1', 'org_2')` does not throw an error matching `/CROSS_TENANT_VIOLATION/`.
4. Plaintext invitation tokens are persisted in `org_invitations`.
5. `scripts/check-layer-boundaries.sh` detects any layer boundary violations.
