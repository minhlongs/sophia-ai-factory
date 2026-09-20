# Quality & Security Review Report: Milestone 2 (Multi-User Organizations & 5-Tier RBAC)

**Reviewer:** `teamwork_preview_reviewer_m2_2` (reviewer, critic)  
**Parent:** `78b5382f-0b81-4402-ad59-b06284d61c09`  
**Date:** 2026-09-20  
**Target:** Milestone 2 Implementation by `teamwork_preview_worker_m2`  
**Verdict:** `REQUEST_CHANGES`

---

## 1. Executive Summary

An independent security, architectural, and robustness review of Milestone 2 (Multi-User Organizations & 5-Tier RBAC) was conducted.

The implementation exhibits excellent design in several key areas:
- **Tenant Isolation**: `assertTenantScope` strictly enforces tenant scope and throws `CrossTenantViolationError` (matching `/CROSS_TENANT_VIOLATION/`, code `'CROSS_TENANT_VIOLATION'`, HTTP 403) on any mismatch, empty, null, or whitespace-only input.
- **5-Tier RBAC Matrix**: The lattice RBAC model strictly grants `viewer` exactly 0 permissions and restricts `canManageBilling` exclusively to `owner` and `billing_manager`. Role delegation guards in `canAssignRole` prevent privilege escalation.
- **Cryptographic Storage**: 256-bit CSPRNG tokens generated via Web Crypto API are never stored in D1. Only standard SHA-256 lowercase hex digests are persisted and indexed (`token_hash TEXT UNIQUE NOT NULL`).
- **Layer Architecture & Types**: `npm run type-check` (0 errors) and `bash scripts/check-layer-boundaries.sh` (0 violations) passed cleanly. 102/102 vitest tests passed.

**However**, a critical concurrency vulnerability was identified in **CAS Atomic Acceptance** (`src/tree/organizations/invitation-service.ts`), where Compare-And-Swap return values are ignored and member records are inserted prior to CAS state transitions, allowing double-consumption under concurrent acceptance.

---

## 2. Detailed Findings

### [Critical] Finding 1: Broken CAS Atomicity & TOCTOU Race Condition in Invitation Acceptance

- **Location:** `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`, lines 192–237 (`acceptOrgInvitation`)
- **What:** 
  1. The CAS update `UPDATE ${targetTable} SET status = 'accepted', accepted_at = ?1 WHERE id = ?2 AND status = 'pending'` is executed **after** member insertion (`INSERT INTO organization_members ...`), rather than before it.
  2. The return value of the CAS update (`meta.changes`) is **never checked**.
- **Why this is a critical security issue:**
  - If two concurrent requests with the same invitation token arrive for different user accounts (`user_A` and `user_B`):
    1. Both requests read `status = 'pending'`.
    2. Both requests pass the seat quota check.
    3. Both requests insert into `organization_members` (`user_A` and `user_B` have distinct `user_id`s, so the `UNIQUE(org_id, user_id)` constraint does NOT prevent both insertions).
    4. Request A runs `UPDATE ... WHERE status = 'pending'` -> updates 1 row (`changes === 1`).
    5. Request B runs `UPDATE ... WHERE status = 'pending'` -> updates 0 rows (`changes === 0`).
    6. Request B ignores the 0 changes and returns `{ success: true, orgId, role }`.
  - **Impact:** A single-use invitation token can be replayed/raced to grant multiple user accounts membership in an organization, violating the single-use invariant, bypassing seat quotas, and allowing unauthorized privilege delegation.
- **Remediation:**
  Execute the CAS `UPDATE` **first** before member insertion and assert `changes === 1`:
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

  // 6. Add member only after token has been atomically claimed
  ...
  ```
  Alternatively, execute both statements inside `await db.batch([...])` in Cloudflare D1 to ensure all-or-nothing transactional atomicity.

---

## 3. Verified Claims

| Claim | Method | Result | Notes |
|---|---|---|---|
| `assertTenantScope` throws `CROSS_TENANT_VIOLATION` on org ID mismatch | Code review & vitest in `tenant-isolation-integration.test.ts` | **PASS** | Throws `CrossTenantViolationError` matching `/CROSS_TENANT_VIOLATION/` |
| `assertTenantScope` throws on empty string, whitespace, null, or undefined | Code review & vitest in `tenant-isolation-integration.test.ts` | **PASS** | Validates trimmed strings, fails closed |
| `viewer` role has 0 mutation permissions | Code review of `rbac-matrix.ts` and `permissions.ts` | **PASS** | All 5 permission flags are `false`; `canAssignRole` and `canManageMember` return `false` |
| Only `owner` and `billing_manager` can manage billing | Code review of `ROLE_PERMISSION_FLAGS` | **PASS** | `owner: true`, `billing_manager: true`; `admin: false`, `creator: false`, `viewer: false` |
| Raw tokens never stored in D1 | Code review of migration `0277` and `invitation-service.ts` | **PASS** | Table contains `token_hash TEXT UNIQUE NOT NULL`. Raw tokens are never persisted |
| SHA-256 hashes used for token storage | Code review of `invitation-token.ts` (`crypto.subtle.digest('SHA-256')`) | **PASS** | Standard 64 lowercase hex characters generated and indexed |
| Layer boundary discipline clean | `bash scripts/check-layer-boundaries.sh` | **PASS** | Exit code 0, all boundaries clean |
| TypeScript type safety | `npm run type-check` | **PASS** | Exit code 0, 0 compilation errors |
| Test suite execution | Vitest run across 6 test files | **PASS** | 102/102 tests passed in 3.47s |
| CAS atomic acceptance prevents double-use under concurrency | Code review of `acceptOrgInvitation` in `invitation-service.ts` | **FAIL** | CAS return value ignored, member inserted before state transition |

---

## 4. Integrity Check

- **Hardcoded test outputs in source code:** None detected. Real implementations in place.
- **Dummy/facade implementations:** None detected. Complete D1 queries, schemas, and helpers.
- **Shortcuts bypassing task:** None detected.
- **Fabricated verification outputs:** None. All test runs independently executed and confirmed.
- **Attestation:** Work is genuine but suffers from a critical concurrency race condition.
