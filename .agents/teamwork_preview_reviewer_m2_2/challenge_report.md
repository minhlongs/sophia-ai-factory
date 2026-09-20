# Adversarial Challenge Report: Milestone 2

**Critic:** `teamwork_preview_reviewer_m2_2` (reviewer, critic)  
**Parent:** `78b5382f-0b81-4402-ad59-b06284d61c09`  
**Date:** 2026-09-20  
**Overall Risk Assessment:** **HIGH**

---

## 1. Challenge Summary

This adversarial evaluation stress-tests the assumptions, boundary conditions, and concurrency behaviors of Milestone 2 (Multi-User Organizations & 5-Tier RBAC).

While tenant isolation (`assertTenantScope`), the 5-tier RBAC poset, and SHA-256 token hashing were found to be rock-solid, the **CAS token acceptance mechanism contains a high-severity concurrency vulnerability** that allows race conditions to break single-use invariants and oversubscribe organization seat quotas.

---

## 2. Adversarial Challenges

### [Critical] Challenge 1: TOCTOU Double-Consumption via Concurrent Token Acceptance

- **Assumption Challenged:** Sequential testing in `org-invitations-integration.test.ts` assumed that `if (invitation.status !== 'pending') throw ...` is sufficient to prevent double acceptance.
- **Attack Scenario:**
  1. An organization sends an invitation link for a high-privilege role (`admin` or `creator`).
  2. The link is intercepted, shared, or automated via a replay tool.
  3. Attacker fires two concurrent HTTP requests:
     - Request 1: `POST /api/v1/invitations/accept` with `user_A`'s bearer token.
     - Request 2: `POST /api/v1/invitations/accept` with `user_B`'s bearer token.
  4. At $T_0$, both requests execute Step 1: `SELECT ... WHERE token_hash = ?1`. Both read `status = 'pending'`.
  5. At $T_1$, both requests pass Step 4: `checkSeatQuota(db, orgId)`.
  6. At $T_2$, Request 1 inserts `user_A` into `organization_members`.
  7. At $T_3$, Request 2 inserts `user_B` into `organization_members`. Because `user_A != user_B`, the `UNIQUE(org_id, user_id)` constraint does not trigger.
  8. At $T_4$, Request 1 runs `UPDATE org_invitations SET status = 'accepted' WHERE id = ? AND status = 'pending'`. 1 row updated.
  9. At $T_5$, Request 2 runs `UPDATE org_invitations SET status = 'accepted' WHERE id = ? AND status = 'pending'`. 0 rows updated.
  10. Because line 223 does not check `meta.changes`, Request 2 proceeds to return `{ success: true, orgId, role }`.
- **Blast Radius:**
  - Token reuse allows arbitrary numbers of unauthorized users to join an organization.
  - Seat quotas can be exceeded beyond tier limits.
  - Organization owner's billing or privacy boundaries are breached.
- **Mitigation:**
  - Invert the sequence: Execute the CAS `UPDATE` first.
  - Assert `meta.changes === 1`. If `0`, immediately abort and throw `INVITATION_ALREADY_USED`.
  - Alternatively, wrap both the CAS status transition and the member insertion inside an atomic `db.batch([...])` transaction.

---

### [Medium] Challenge 2: Non-Transactional Partial Failure during Member Insertion

- **Assumption Challenged:** Assumed that member insertion and token update succeed together.
- **Attack Scenario:**
  - If a user who is already a member attempts to accept an invitation for another role:
    - Step 5 tries to insert into `organization_members` and fails on `UNIQUE(org_id, user_id)`.
    - It throws, leaving the token in `status = 'pending'`.
  - Conversely, if member insertion succeeds but the database worker experiences an isolate crash or timeout before Step 6 completes:
    - The member is added in `organization_members`.
    - The invitation remains `pending`.
    - The token can be accepted again by another user.
- **Blast Radius:** Inconsistent state between `organization_members` and `org_invitations`.
- **Mitigation:** Use `db.batch()` for atomic transactional state updates across both tables.

---

## 3. Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| `assertTenantScope('org_1', 'org_2')` | Throws `CROSS_TENANT_VIOLATION` (403) | Throws `CrossTenantViolationError` (code 403) | **PASS** |
| `assertTenantScope('', 'org_1')` | Throws `CROSS_TENANT_VIOLATION` | Throws `CrossTenantViolationError` | **PASS** |
| `assertTenantScope('org_1', '')` | Throws `CROSS_TENANT_VIOLATION` | Throws `CrossTenantViolationError` | **PASS** |
| `assertTenantScope('   ', 'org_1')` | Throws `CROSS_TENANT_VIOLATION` | Throws `CrossTenantViolationError` | **PASS** |
| `assertTenantScope('org_1', 'org_1')` | Returns void (no throw) | Returns void (no throw) | **PASS** |
| `hasOrgPermission('viewer', perm)` for all 5 perms | Returns `false` for all 5 | Returns `false` for all 5 | **PASS** |
| `hasOrgPermission('admin', 'canManageBilling')` | Returns `false` | Returns `false` | **PASS** |
| `hasOrgPermission('billing_manager', 'canManageBilling')` | Returns `true` | Returns `true` | **PASS** |
| `hasOrgPermission('billing_manager', otherPerm)` | Returns `false` | Returns `false` | **PASS** |
| `canAssignRole('admin', 'owner')` | Returns `false` | Returns `false` | **PASS** |
| `canAssignRole('admin', 'admin')` | Returns `false` | Returns `false` | **PASS** |
| Sequential token double-acceptance | Rejects with `INVITATION_ALREADY_USED` | Rejects with `INVITATION_ALREADY_USED` | **PASS** |
| Concurrent token double-acceptance | Only 1 user becomes member; 2nd rejected | Both users inserted before CAS check; 2nd user succeeds due to unchecked CAS | **FAIL** |

---

## 4. Unchallenged Areas

- Cloudflare remote D1 replication latency across edge regions: tested on local SQLite D1 mock. Remote behavior relies on Cloudflare's primary-leader write consistency, which enforces linearizability on writes.
