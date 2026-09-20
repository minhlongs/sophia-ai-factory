# Handoff Report: Milestone 2 — 5-Tier RBAC Permission Matrix & Typed Helper Predicates

**Author:** teamwork_preview_explorer_m2_2 (Teamwork Explorer)  
**Date:** 2026-09-20  
**Target Milestone:** Milestone 2: Multi-User Organizations & 5-Tier RBAC (Phase 18–19 Enterprise Scale Ready)  
**Parent Orchestrator:** 78b5382f-0b81-4402-ad59-b06284d61c09  
**Status:** DESIGN COMPLETE (Ready for Implementation)  

---

## 1. Observation

Direct code inspections and baseline observations from the repository:

### 1.1 E2E Test Suite Contract (`apps/sophia-ai-factory/src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`)
- **Lines 335–385 (F5: 5-Tier RBAC Permission Matrix Evaluation)**:
  ```typescript
  describe('F5: 5-Tier RBAC Permission Matrix Evaluation', () => {
    it('F5-1: owner has all 5 permissions', () => {
      const permissions: OrgPermission[] = [
        'canCreateMissions',
        'canManageBilling',
        'canInviteMembers',
        'canPublishVideos',
        'canConfigureWebhooks',
      ];
      for (const p of permissions) {
        expect(hasOrgPermission('owner', p)).toBe(true);
      }
    });

    it('F5-2: admin has all permissions EXCEPT billing management', () => {
      expect(hasOrgPermission('admin', 'canCreateMissions')).toBe(true);
      expect(hasOrgPermission('admin', 'canInviteMembers')).toBe(true);
      expect(hasOrgPermission('admin', 'canPublishVideos')).toBe(true);
      expect(hasOrgPermission('admin', 'canConfigureWebhooks')).toBe(true);
      expect(hasOrgPermission('admin', 'canManageBilling')).toBe(false); // Admin cannot alter billing!
    });

    it('F5-3: creator can create missions and publish videos, but cannot manage members or billing', () => {
      expect(hasOrgPermission('creator', 'canCreateMissions')).toBe(true);
      expect(hasOrgPermission('creator', 'canPublishVideos')).toBe(true);
      expect(hasOrgPermission('creator', 'canManageBilling')).toBe(false);
      expect(hasOrgPermission('creator', 'canInviteMembers')).toBe(false);
      expect(hasOrgPermission('creator', 'canConfigureWebhooks')).toBe(false);
    });

    it('F5-4: billing_manager can ONLY manage billing', () => {
      expect(hasOrgPermission('billing_manager', 'canManageBilling')).toBe(true);
      expect(hasOrgPermission('billing_manager', 'canCreateMissions')).toBe(false);
      expect(hasOrgPermission('billing_manager', 'canInviteMembers')).toBe(false);
      expect(hasOrgPermission('billing_manager', 'canPublishVideos')).toBe(false);
      expect(hasOrgPermission('billing_manager', 'canConfigureWebhooks')).toBe(false);
    });

    it('F5-5: viewer has strictly 0 mutation permissions (read-only role)', () => {
      const permissions: OrgPermission[] = [
        'canCreateMissions',
        'canManageBilling',
        'canInviteMembers',
        'canPublishVideos',
        'canConfigureWebhooks',
      ];
      for (const p of permissions) {
        expect(hasOrgPermission('viewer', p)).toBe(false);
      }
    });
  });
  ```
- **Lines 519–541 (P1: Cross-Feature Role Mapping)**:
  Verifies that upon invitation acceptance, roles `admin`, `creator`, and `billing_manager` are directly mapped to their respective RBAC permission sets.
- **Lines 601–617 (S1: Real-World Multi-Role Scenario)**:
  Verifies that CTO (`admin`) can invite members but cannot manage billing; Lead Artist (`creator`) can create missions but cannot invite staff; CFO (`billing_manager`) manages billing but cannot publish videos; and Investor (`viewer`) is strictly read-only.

### 1.2 Existing E2E Test Harness (`apps/sophia-ai-factory/src/__tests__/e2e/enterprise/enterprise-test-harness.ts`)
- **Lines 465–509**:
  ```typescript
  export type OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer';

  export type OrgPermission =
    | 'canCreateMissions'
    | 'canManageBilling'
    | 'canInviteMembers'
    | 'canPublishVideos'
    | 'canConfigureWebhooks';

  export const RBAC_PERMISSIONS_MATRIX: Record<OrgRole, readonly OrgPermission[]> = {
    owner: [
      'canCreateMissions',
      'canManageBilling',
      'canInviteMembers',
      'canPublishVideos',
      'canConfigureWebhooks',
    ],
    admin: [
      'canCreateMissions',
      'canInviteMembers',
      'canPublishVideos',
      'canConfigureWebhooks',
    ],
    creator: [
      'canCreateMissions',
      'canPublishVideos',
    ],
    billing_manager: [
      'canManageBilling',
    ],
    viewer: [],
  };

  export function hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean {
    const perms = RBAC_PERMISSIONS_MATRIX[role];
    return perms ? perms.includes(permission) : false;
  }
  ```

### 1.3 Legacy RBAC in Codebase (`apps/sophia-ai-factory/src/seed/auth/rbac.ts`)
- **Lines 14–27**: Defines `OrgRole = 'owner' | 'admin' | 'member' | 'viewer'` and SOP permissions (`'org:manage'`, `'sop:create'`, etc.).
- **Lines 32–68**: Assumes a linear 4-tier hierarchy: `owner > admin > member > viewer`.
- **Finding**: Does not support modern enterprise roles (`creator`, `billing_manager`) and cannot enforce separation of duties between operations and billing.

### 1.4 Architecture & Project Contracts (`PROJECT.md` & `ORIGINAL_REQUEST.md`)
- `PROJECT.md` (lines 79–81, 120, 136):
  - Interface: `hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean`
  - Code layout: `src/seed/types/rbac-matrix.ts` and `src/tree/rbac/permissions.ts`.
- `ORIGINAL_REQUEST.md` (§R2, lines 737, 767):
  - "5-tier RBAC system (`owner`, `admin`, `creator`, `billing_manager`, `viewer`) with typed permission matrix (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`)."
  - "RBAC guard enforces permissions accurately across all 5 roles with 0 privilege leakage."

### 1.5 4-Layer Boundary Verification (`scripts/check-layer-boundaries.sh`)
- Boundary script asserts:
  - `seed` cannot import from `tree`, `forest`, or `land`.
  - `tree` can only import from `seed`.

---

## 2. Logic Chain

1. **Role Model is a DAG/Lattice, not a Linear Order** (Refs: Obs 1.1, Obs 1.2):
   - Observations prove that `admin` has `canInviteMembers` and `canConfigureWebhooks`, but NOT `canManageBilling`.
   - `billing_manager` has `canManageBilling`, but NOT `canInviteMembers` or `canConfigureWebhooks`.
   - Neither role's permission set is a subset of the other ($P(\text{admin}) \not\subseteq P(\text{billing\_manager})$ and $P(\text{billing\_manager}) \not\subseteq P(\text{admin})$).
   - Therefore, modeling roles as integer levels (e.g., `roleLevel >= requiredLevel`) causes catastrophic privilege leakage: either admins gain unauthorized billing control, or billing managers gain unauthorized operations/webhook control.
   - The roles form a partially ordered lattice (DAG) diverging under `owner`:
     ```
                [ owner ] (5/5)
               /         \
        [ admin ]     [ billing_manager ]
         (4/5)              (1/5)
           |
      [ creator ]
         (2/5)
           \         /
           [ viewer ] (0/5)
     ```

2. **4-Layer Decoupling Architecture** (Refs: Obs 1.4, Obs 1.5):
   - Types (`OrgRole`, `OrgPermission`, `OrgRoleMetadata`), constants (`ALL_ORG_ROLES`, `ALL_ORG_PERMISSIONS`, `RBAC_PERMISSIONS_MATRIX`), and precomputed boolean flags (`ROLE_PERMISSION_FLAGS`) must reside in `src/seed/types/rbac-matrix.ts` (Layer 1: Foundational primitives; 0 dependencies).
   - Runtime evaluation functions (`hasOrgPermission`), individual typed predicates (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`), exception classes (`RbacPermissionError`), fail-closed assertion guards (`assertOrgPermission`), and privilege escalation guards (`canAssignRole`, `canManageMember`) must reside in `src/tree/rbac/permissions.ts` (Layer 2: Pure domain logic; only imports `seed`).

3. **High-Performance O(1) Matrix Evaluation**:
   - In hot paths (Edge middleware, Server Actions, API route handlers), iterating through array strings is suboptimal.
   - Precomputing `ROLE_PERMISSION_FLAGS: Record<OrgRole, Record<OrgPermission, boolean>>` provides instant O(1) property access with zero memory allocation:
     `return ROLE_PERMISSION_FLAGS[role]?.[permission] ?? false;`
   - Failing closed on any invalid, undefined, or prototype-polluted role/permission ensures 100% defense-in-depth.

4. **Defensive Role Delegation & Privilege Escalation Prevention**:
   - In multi-user organizations, role assignment must prevent privilege escalation:
     - `owner` can assign `admin`, `creator`, `billing_manager`, `viewer` (owner transfer is a separate protected flow).
     - `admin` can assign `creator`, `billing_manager`, `viewer`, but CANNOT assign `owner` or another `admin`.
     - `creator`, `billing_manager`, `viewer` cannot assign any roles.
     - Nobody can demote or delete the `owner`.
   - This logic is codified in `canAssignRole` and `canManageMember`.

---

## 3. Caveats

1. **Legacy Compatibility with `src/seed/auth/rbac.ts`**:
   - `src/seed/auth/rbac.ts` remains in place for legacy code paths (e.g. `seed/db/org-membership-ext.ts`).
   - The new enterprise system does not overwrite `seed/auth/rbac.ts`; instead, it introduces canonical modules `src/seed/types/rbac-matrix.ts` and `src/tree/rbac/permissions.ts`. Future refactoring can migrate legacy references cleanly.
2. **D1 Database Column Constraints**:
   - The `role` column in `organization_members` (defined in schema `0276`) must store strings `'owner'`, `'admin'`, `'creator'`, `'billing_manager'`, `'viewer'`. Implementers must ensure no legacy SQLite CHECK constraint restricts roles to `('owner', 'admin', 'member', 'viewer')`.
3. **No External Network / Zero Node.js Built-ins**:
   - All code in `seed/types/rbac-matrix.ts` and `tree/rbac/permissions.ts` uses 100% standard TypeScript/JavaScript. No Node.js built-ins (`node:crypto`, `fs`) are used, ensuring seamless execution on Cloudflare Workers edge runtime.

---

## 4. Conclusion

The 5-Tier RBAC system is fully investigated, mathematically modeled, and blueprinted with production-ready implementations:

1. **`src/seed/types/rbac-matrix.ts`**:
   - Types: `OrgRole`, `OrgPermission`, `OrgRoleMetadata`.
   - Constants: `ALL_ORG_ROLES`, `ALL_ORG_PERMISSIONS`, `RBAC_PERMISSIONS_MATRIX`, `ROLE_PERMISSION_FLAGS`.
   - Bilingual metadata registry (`ROLE_METADATA`) adhering to Constitution rules (Vietnamese + English).
   - Type guards: `isOrgRole`, `isOrgPermission`.
2. **`src/tree/rbac/permissions.ts`**:
   - Core evaluator: `hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean`.
   - 5 Typed predicates: `canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`.
   - Assertion guards: `assertOrgPermission`, `assertCanManageBilling`, etc., throwing `RbacPermissionError` (HTTP 403).
   - Privilege escalation guards: `canAssignRole`, `canManageMember`.
3. **`src/tree/rbac/index.ts`**:
   - Clean domain barrel export.
4. **`src/__tests__/unit/enterprise/rbac-matrix.test.ts`**:
   - 25+ boundary tests verifying all 25 matrix intersections, zero-mutation viewer invariants, single-purpose billing manager isolation, operational admin boundaries, and tamper resistance.

Full code specifications are documented in:
`/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/analysis.md`.

---

## 5. Verification Method

To independently verify the implementation once written:

1. **Run Enterprise RBAC E2E Test Suite**:
   ```bash
   npx vitest run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts
   ```
   *Expected outcome:* All 5 tests in `F5: 5-Tier RBAC Permission Matrix Evaluation` pass (F5-1 through F5-5), cross-feature P1 passes, and real-world S1 passes.
2. **Run New RBAC Unit & Boundary Test Suite**:
   ```bash
   npx vitest run src/__tests__/unit/enterprise/rbac-matrix.test.ts
   ```
   *Expected outcome:* 100% pass across all 25 matrix tests, typed predicates, assertion errors, and escalation guards.
3. **Verify 4-Layer Architecture Compliance**:
   ```bash
   bash scripts/check-layer-boundaries.sh
   ```
   *Expected outcome:* `✅ All layer boundaries clean` with 0 violations.
4. **TypeScript Typecheck**:
   ```bash
   npm run type-check
   ```
   *Expected outcome:* 0 compilation errors.

### Invalidation Conditions
The design is invalidated if:
- `hasOrgPermission('admin', 'canManageBilling')` returns `true`.
- `hasOrgPermission('viewer', permission)` returns `true` for any permission.
- `hasOrgPermission('billing_manager', permission)` returns `true` for any permission other than `canManageBilling`.
- Any upper layer (`tree`, `forest`, `land`) is imported inside `src/seed/types/rbac-matrix.ts`.
