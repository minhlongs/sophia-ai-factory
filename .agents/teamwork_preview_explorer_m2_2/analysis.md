# Technical Architecture & Blueprint: Milestone 2 — 5-Tier RBAC Permission Matrix & Typed Predicates

**Author:** teamwork_preview_explorer_m2_2 (Teamwork Explorer)  
**Date:** 2026-09-20  
**Target Milestone:** Milestone 2: Multi-User Organizations & 5-Tier RBAC (Phase 18–19 Enterprise Scale Ready)  
**Status:** COMPLETE / ACTIONABLE BLUEPRINT  
**Target Files:**  
- `apps/sophia-ai-factory/src/seed/types/rbac-matrix.ts` (Layer: `seed`)
- `apps/sophia-ai-factory/src/tree/rbac/permissions.ts` (Layer: `tree`)
- `apps/sophia-ai-factory/src/tree/rbac/index.ts` (Layer: `tree` barrel)
- `apps/sophia-ai-factory/src/__tests__/unit/enterprise/rbac-matrix.test.ts` (Unit & Boundary Test Suite)

---

## 1. Executive Summary

Milestone 2 expands Sophia AI Factory from single-user automations into an enterprise-grade multi-tenant platform. A cornerstone of this expansion is the **5-Tier Role-Based Access Control (RBAC) System**, providing granular, strictly typed permission evaluation across five specialized organizational roles:
- `owner`: Root organization supervisor (5/5 permissions).
- `admin`: Operational administrator (4/5 permissions; strictly excluded from billing).
- `creator`: Video and creative generation staff (2/5 permissions).
- `billing_manager`: Dedicated financial controller (1/5 permissions; strictly isolated to billing).
- `viewer`: Read-only stakeholder/client observer (0/5 permissions; zero mutation rights).

This blueprint establishes:
1. **Mathematical Role Lattice Architecture**: Proving why the enterprise roles form a Directed Acyclic Graph (DAG) rather than a linear integer scale, eliminating catastrophic privilege leakage (such as admins accidentally gaining billing control).
2. **Strict 4-Layer Architecture Alignment**: Decoupling pure type declarations and permission flags in `seed/types/rbac-matrix.ts` from domain evaluation logic and assertion guards in `tree/rbac/permissions.ts`.
3. **Comprehensive Typed Helper Predicates**: Providing O(1) evaluated predicates (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`) and defensive assertion functions throwing typed `RbacPermissionError`.
4. **Exhaustive Unit & Boundary Test Suite**: Designing 25+ boundary tests verifying all 25 role-permission intersections, tamper resistance, and delegation hierarchy guards.

---

## 2. Investigation & Baseline Observations

### 2.1 E2E Test Suite Contract (`src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`)
Inspection of the canonical E2E test suite reveals the exact interface contracts expected by the enterprise testing track:
- **Lines 335–385 (F5: 5-Tier RBAC Permission Matrix Evaluation)**:
  - `F5-1`: `owner` has all 5 permissions (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`).
  - `F5-2`: `admin` has all permissions EXCEPT `canManageBilling` (`hasOrgPermission('admin', 'canManageBilling') === false`).
  - `F5-3`: `creator` has `canCreateMissions` and `canPublishVideos`, but lacks `canManageBilling`, `canInviteMembers`, and `canConfigureWebhooks`.
  - `F5-4`: `billing_manager` has ONLY `canManageBilling` and lacks the other four.
  - `F5-5`: `viewer` has strictly 0 mutation permissions across all 5 checks.
- **Lines 519–541 (P1: Cross-Feature Role Mapping)**:
  - Accepted invitation roles directly map to their RBAC permission profile upon member creation.
- **Lines 601–617 (S1: Real-World Enterprise Lifecycle)**:
  - Demonstrates multi-member enterprise staff across all 5 roles interacting under strict permission boundaries.

### 2.2 Existing E2E Harness (`src/__tests__/e2e/enterprise/enterprise-test-harness.ts`)
- **Lines 465–509**:
  - Defines `OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer'`.
  - Defines `OrgPermission = 'canCreateMissions' | 'canManageBilling' | 'canInviteMembers' | 'canPublishVideos' | 'canConfigureWebhooks'`.
  - Defines `RBAC_PERMISSIONS_MATRIX: Record<OrgRole, readonly OrgPermission[]>`.
  - Defines `hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean`.

### 2.3 Legacy RBAC in Codebase (`src/seed/auth/rbac.ts`)
- Defines legacy 4-tier roles (`owner | admin | member | viewer`) and legacy SOP permissions (`sop:create`, `org:manage`, etc.).
- Used by legacy Supabase-based `src/seed/db/org-membership.ts` and `src/seed/db/org-membership-ext.ts`.
- **Finding**: The legacy roles do not accommodate modern enterprise workflows (creators vs. billing managers) and use a flawed linear assumption (`owner > admin > member > viewer`). The new 5-tier system in `seed/types/rbac-matrix.ts` and `tree/rbac/permissions.ts` provides the clean, authoritative enterprise standard without breaking existing legacy imports.

### 2.4 Sophia 4-Layer Architecture Rules (`scripts/check-layer-boundaries.sh`)
- `seed` layer cannot import from `tree`, `forest`, or `land`.
- `tree` layer can only import from `seed`.
- `src/seed/types/rbac-matrix.ts` must contain zero runtime domain logic, zero external dependencies, and zero cross-layer imports.
- `src/tree/rbac/permissions.ts` must import types only from `@/seed/types/rbac-matrix`.

---

## 3. The 5-Tier Role Lattice & Permission Matrix

### 3.1 Why a Linear Role Hierarchy Fails (The Privilege Leakage Problem)
In simple applications, roles are often modeled as a linear integer scale:
`viewer (1) < member (2) < admin (3) < owner (4)`
where `hasPermission = userLevel >= requiredLevel`.

**This linear model fails completely in Enterprise Multi-User Organizations:**
- An `admin` manages staff, webhooks, and video production, but in an enterprise with separation of duties (SOC 2, SOX compliance), operational admins must NOT be allowed to view bank payouts, update billing cards, or drain crypto wallet balances.
- Conversely, an external accountant or internal CFO (`billing_manager`) needs to manage billing, renew enterprise seats, and download invoices, but must NOT have access to trigger video generation runs, publish corporate videos to social channels, or modify webhook endpoints.

If `admin` were ranked 4 and `billing_manager` ranked 3, admins would leak into billing management. If `billing_manager` were ranked 4 and `admin` ranked 3, billing managers would leak into operations.

### 3.2 The Enterprise RBAC Lattice (DAG)
The 5 roles form a **partially ordered set (lattice / DAG)**:

```
                      ┌──────────────────────┐
                      │        owner         │  (5/5 Permissions: Superuser)
                      │ Full Org Supervision │
                      └──────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │       admin       │           │  billing_manager  │
       │  4/5 Permissions  │           │  1/5 Permissions  │
       │ Ops / Integrations│           │  Finance & Billing│
       └─────────┬─────────┘           └─────────┬─────────┘
                 │                               │
                 ▼                               │
       ┌───────────────────┐                     │
       │      creator      │                     │
       │  2/5 Permissions  │                     │
       │ Video / Missions  │                     │
       └─────────┬─────────┘                     │
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
                      ┌──────────────────────┐
                      │        viewer        │  (0/5 Permissions: Read-Only)
                      │ Strict 0 Mutations   │
                      └──────────────────────┘
```

### 3.3 The 5x5 Permission Evaluation Matrix

| Role | `canCreateMissions` | `canManageBilling` | `canInviteMembers` | `canPublishVideos` | `canConfigureWebhooks` | Total Active |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **`owner`** | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` | **5 / 5** |
| **`admin`** | ✅ `true` | ❌ `false` | ✅ `true` | ✅ `true` | ✅ `true` | **4 / 5** |
| **`creator`** | ✅ `true` | ❌ `false` | ❌ `false` | ✅ `true` | ❌ `false` | **2 / 5** |
| **`billing_manager`**| ❌ `false` | ✅ `true` | ❌ `false` | ❌ `false` | ❌ `false` | **1 / 5** |
| **`viewer`** | ❌ `false` | ❌ `false` | ❌ `false` | ❌ `false` | ❌ `false` | **0 / 5** |

### 3.4 Permission Granularity & Responsibilities

1. **`canCreateMissions`**:
   - Authorized roles: `owner`, `admin`, `creator`.
   - Actions: Initiating autonomous video generation pipelines, script synthesis, storyboard generation, AI rendering jobs.
   - Restricted roles: `billing_manager`, `viewer`.
2. **`canManageBilling`**:
   - Authorized roles: `owner`, `billing_manager`.
   - Actions: Modifying tier subscriptions, buying seat packs, configuring NOWPayments USDT wallet addresses, reviewing PayOS invoices, viewing financial transaction receipts.
   - Restricted roles: `admin`, `creator`, `viewer`.
3. **`canInviteMembers`**:
   - Authorized roles: `owner`, `admin`.
   - Actions: Issuing 256-bit cryptographic invitation links, assigning roles, revoking pending invitations, removing team members (subject to role hierarchy constraints).
   - Restricted roles: `creator`, `billing_manager`, `viewer`.
4. **`canPublishVideos`**:
   - Authorized roles: `owner`, `admin`, `creator`.
   - Actions: Exporting rendered video assets to public endpoints, publishing to connected YouTube/TikTok accounts, dispatching media to distribution channels.
   - Restricted roles: `billing_manager`, `viewer`.
5. **`canConfigureWebhooks`**:
   - Authorized roles: `owner`, `admin`.
   - Actions: Registering webhook target URLs, configuring HMAC signing secrets (`X-Sophia-Signature`), managing event subscriptions, executing manual dead-letter queue (DLQ) replays.
   - Restricted roles: `creator`, `billing_manager`, `viewer`.

---

## 4. Code Implementation Blueprints

### 4.1 Blueprint 1: `src/seed/types/rbac-matrix.ts`
**Layer:** `seed` (Foundational primitives)  
**Dependencies:** None (Zero external dependencies, zero upper layer imports)

```typescript
/**
 * 5-Tier RBAC Permission Matrix & Role Definitions.
 *
 * Layer: seed (Foundational primitives)
 * Dependencies: None
 *
 * Role hierarchy represents a directed lattice (DAG), not a linear order:
 * - owner: Full organization superuser (5/5 permissions).
 * - admin: Operations & integrations manager (4/5 permissions; NO billing).
 * - creator: Creative production specialist (2/5 permissions).
 * - billing_manager: Financial controller (1/5 permissions; ONLY billing).
 * - viewer: Read-only observer (0/5 permissions; zero mutation rights).
 *
 * @module seed/types/rbac-matrix
 */

/** Canonical 5-tier organization roles */
export type OrgRole =
  | 'owner'
  | 'admin'
  | 'creator'
  | 'billing_manager'
  | 'viewer';

/** Canonical organization-level typed mutation permissions */
export type OrgPermission =
  | 'canCreateMissions'
  | 'canManageBilling'
  | 'canInviteMembers'
  | 'canPublishVideos'
  | 'canConfigureWebhooks';

/** Immutable list of all 5 organization roles */
export const ALL_ORG_ROLES: readonly OrgRole[] = [
  'owner',
  'admin',
  'creator',
  'billing_manager',
  'viewer',
] as const;

/** Immutable list of all 5 organization permissions */
export const ALL_ORG_PERMISSIONS: readonly OrgPermission[] = [
  'canCreateMissions',
  'canManageBilling',
  'canInviteMembers',
  'canPublishVideos',
  'canConfigureWebhooks',
] as const;

/**
 * Explicit permission mapping per role.
 * Matches canonical E2E test harness expectations.
 */
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
} as const;

/**
 * Precomputed O(1) Boolean flag lookup table.
 * Guarantees zero-allocation, instant evaluation without array scans.
 */
export const ROLE_PERMISSION_FLAGS: Record<OrgRole, Record<OrgPermission, boolean>> = {
  owner: {
    canCreateMissions: true,
    canManageBilling: true,
    canInviteMembers: true,
    canPublishVideos: true,
    canConfigureWebhooks: true,
  },
  admin: {
    canCreateMissions: true,
    canManageBilling: false,
    canInviteMembers: true,
    canPublishVideos: true,
    canConfigureWebhooks: true,
  },
  creator: {
    canCreateMissions: true,
    canManageBilling: false,
    canInviteMembers: false,
    canPublishVideos: true,
    canConfigureWebhooks: false,
  },
  billing_manager: {
    canCreateMissions: false,
    canManageBilling: true,
    canInviteMembers: false,
    canPublishVideos: false,
    canConfigureWebhooks: false,
  },
  viewer: {
    canCreateMissions: false,
    canManageBilling: false,
    canInviteMembers: false,
    canPublishVideos: false,
    canConfigureWebhooks: false,
  },
} as const;

/** Bilingual role metadata descriptor for UI presentation and audit logging */
export interface OrgRoleMetadata {
  role: OrgRole;
  displayNameEn: string;
  displayNameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  isImmutable: boolean;
  canBeAssignedByAdmin: boolean;
  category: 'executive' | 'operations' | 'creative' | 'finance' | 'observer';
}

/** Authoritative bilingual metadata registry complying with Constitution rules */
export const ROLE_METADATA: Record<OrgRole, OrgRoleMetadata> = {
  owner: {
    role: 'owner',
    displayNameEn: 'Owner',
    displayNameVi: 'Chủ sở hữu',
    descriptionEn: 'Full control over all organization settings, billing, team, and content.',
    descriptionVi: 'Toàn quyền kiểm soát cài đặt, thanh toán, đội ngũ và nội dung tổ chức.',
    isImmutable: true,
    canBeAssignedByAdmin: false,
    category: 'executive',
  },
  admin: {
    role: 'admin',
    displayNameEn: 'Administrator',
    displayNameVi: 'Quản trị viên',
    descriptionEn: 'Manages team members, video workflows, and webhooks. Excluded from billing.',
    descriptionVi: 'Quản lý thành viên, quy trình video và webhook. Không có quyền thanh toán.',
    isImmutable: false,
    canBeAssignedByAdmin: false,
    category: 'operations',
  },
  creator: {
    role: 'creator',
    displayNameEn: 'Creator',
    displayNameVi: 'Sáng tạo nội dung',
    descriptionEn: 'Generates creative missions and publishes rendered video assets.',
    descriptionVi: 'Tạo nhiệm vụ sáng tạo và xuất bản các video hoàn thiện.',
    isImmutable: false,
    canBeAssignedByAdmin: true,
    category: 'creative',
  },
  billing_manager: {
    role: 'billing_manager',
    displayNameEn: 'Billing Manager',
    displayNameVi: 'Quản lý thanh toán',
    descriptionEn: 'Manages subscriptions, payment methods, and invoices. Zero content access.',
    descriptionVi: 'Quản lý gói đăng ký, cổng thanh toán và hóa đơn. Không truy cập nội dung.',
    isImmutable: false,
    canBeAssignedByAdmin: true,
    category: 'finance',
  },
  viewer: {
    role: 'viewer',
    displayNameEn: 'Viewer',
    displayNameVi: 'Người xem',
    descriptionEn: 'Read-only access to organization dashboards, analytics, and reports.',
    descriptionVi: 'Quyền xem dữ liệu báo cáo, phân tích và bảng điều khiển tổ chức.',
    isImmutable: false,
    canBeAssignedByAdmin: true,
    category: 'observer',
  },
} as const;

/** Type guard for OrgRole */
export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && ALL_ORG_ROLES.includes(value as OrgRole);
}

/** Type guard for OrgPermission */
export function isOrgPermission(value: unknown): value is OrgPermission {
  return typeof value === 'string' && ALL_ORG_PERMISSIONS.includes(value as OrgPermission);
}
```

---

### 4.2 Blueprint 2: `src/tree/rbac/permissions.ts`
**Layer:** `tree` (Pure domain logic)  
**Dependencies:** `@/seed/types/rbac-matrix` (Strict 4-layer rule)

```typescript
/**
 * 5-Tier RBAC Permission Evaluation & Assertion Engine.
 *
 * Layer: tree (Pure domain logic)
 * Dependencies: seed/types/rbac-matrix
 *
 * Implements high-performance O(1) permission evaluation, typed helper predicates,
 * role delegation rules, and fail-closed assertion guards.
 *
 * @module tree/rbac/permissions
 */

import {
  type OrgRole,
  type OrgPermission,
  ALL_ORG_ROLES,
  ALL_ORG_PERMISSIONS,
  RBAC_PERMISSIONS_MATRIX,
  ROLE_PERMISSION_FLAGS,
  isOrgRole,
  isOrgPermission,
} from '@/seed/types/rbac-matrix';

/**
 * Standardized security exception thrown when an actor lacks an expected permission.
 * Includes HTTP 403 status code and security audit properties.
 */
export class RbacPermissionError extends Error {
  public readonly code = 'PERMISSION_DENIED';
  public readonly statusCode = 403;
  public readonly role: string;
  public readonly permission: string;
  public readonly context?: string;

  constructor(role: string, permission: string, context?: string) {
    const detail = context ? ` during ${context}` : '';
    super(`PERMISSION_DENIED: Role '${role}' lacks permission '${permission}'${detail}`);
    this.name = 'RbacPermissionError';
    this.role = role;
    this.permission = permission;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RbacPermissionError);
    }
  }
}

/**
 * Core matrix evaluation function: checks if a role holds a specific permission.
 * Fails closed (returns false) if role or permission is unknown.
 *
 * @example
 * hasOrgPermission('owner', 'canManageBilling') // true
 * hasOrgPermission('admin', 'canManageBilling') // false
 * hasOrgPermission('viewer', 'canCreateMissions') // false
 */
export function hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean {
  if (!isOrgRole(role) || !isOrgPermission(permission)) {
    return false;
  }
  return ROLE_PERMISSION_FLAGS[role]?.[permission] ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Helper Predicates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Predicate: checks if role can initiate AI video generation DAG missions.
 * True for: owner, admin, creator.
 */
export function canCreateMissions(role: OrgRole): boolean {
  return hasOrgPermission(role, 'canCreateMissions');
}

/**
 * Predicate: checks if role can alter subscriptions, payment gateways, or invoices.
 * True for: owner, billing_manager. (Strictly FALSE for admin, creator, viewer).
 */
export function canManageBilling(role: OrgRole): boolean {
  return hasOrgPermission(role, 'canManageBilling');
}

/**
 * Predicate: checks if role can issue invitations or manage member seats.
 * True for: owner, admin.
 */
export function canInviteMembers(role: OrgRole): boolean {
  return hasOrgPermission(role, 'canInviteMembers');
}

/**
 * Predicate: checks if role can publish rendered video artifacts to external channels.
 * True for: owner, admin, creator.
 */
export function canPublishVideos(role: OrgRole): boolean {
  return hasOrgPermission(role, 'canPublishVideos');
}

/**
 * Predicate: checks if role can configure webhook endpoints and signing keys.
 * True for: owner, admin.
 */
export function canConfigureWebhooks(role: OrgRole): boolean {
  return hasOrgPermission(role, 'canConfigureWebhooks');
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix Query & Aggregation Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the full list of permissions assigned to a given role.
 */
export function getRolePermissions(role: OrgRole): readonly OrgPermission[] {
  if (!isOrgRole(role)) return [];
  return RBAC_PERMISSIONS_MATRIX[role] ?? [];
}

/**
 * Retrieves all roles that hold a specific permission.
 */
export function getRolesForPermission(permission: OrgPermission): OrgRole[] {
  if (!isOrgPermission(permission)) return [];
  return ALL_ORG_ROLES.filter((r) => hasOrgPermission(r, permission));
}

/**
 * Checks if a role satisfies ALL requested permissions.
 */
export function hasAllOrgPermissions(
  role: OrgRole,
  permissions: readonly OrgPermission[],
): boolean {
  if (!permissions.length) return true;
  return permissions.every((p) => hasOrgPermission(role, p));
}

/**
 * Checks if a role satisfies AT LEAST ONE requested permission.
 */
export function hasAnyOrgPermission(
  role: OrgRole,
  permissions: readonly OrgPermission[],
): boolean {
  if (!permissions.length) return false;
  return permissions.some((p) => hasOrgPermission(role, p));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fail-Closed Assertion Guards (For Server Actions & API Handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that the specified role holds the required permission.
 * Throws RbacPermissionError on failure.
 */
export function assertOrgPermission(
  role: OrgRole,
  permission: OrgPermission,
  context?: string,
): void {
  if (!hasOrgPermission(role, permission)) {
    throw new RbacPermissionError(role, permission, context);
  }
}

/** Asserts permission to create missions */
export function assertCanCreateMissions(role: OrgRole, context?: string): void {
  assertOrgPermission(role, 'canCreateMissions', context);
}

/** Asserts permission to manage billing */
export function assertCanManageBilling(role: OrgRole, context?: string): void {
  assertOrgPermission(role, 'canManageBilling', context);
}

/** Asserts permission to invite members */
export function assertCanInviteMembers(role: OrgRole, context?: string): void {
  assertOrgPermission(role, 'canInviteMembers', context);
}

/** Asserts permission to publish videos */
export function assertCanPublishVideos(role: OrgRole, context?: string): void {
  assertOrgPermission(role, 'canPublishVideos', context);
}

/** Asserts permission to configure webhooks */
export function assertCanConfigureWebhooks(role: OrgRole, context?: string): void {
  assertOrgPermission(role, 'canConfigureWebhooks', context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Delegation & Management Rules (Privilege Escalation Prevention)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates whether an actor with `actorRole` is authorized to assign `targetRole`
 * to a new invitee or existing member.
 *
 * Rules:
 * 1. Owner can assign any role EXCEPT owner (owner is singular / transferred via transfer flow).
 * 2. Admin can assign `creator`, `billing_manager`, `viewer`.
 * 3. Admin CANNOT assign `owner` or `admin` (prevents horizontal/vertical privilege escalation).
 * 4. Creator, billing_manager, viewer cannot assign any roles.
 */
export function canAssignRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (!canInviteMembers(actorRole)) return false;

  if (actorRole === 'owner') {
    return targetRole !== 'owner';
  }

  if (actorRole === 'admin') {
    return targetRole === 'creator' || targetRole === 'billing_manager' || targetRole === 'viewer';
  }

  return false;
}

/**
 * Evaluates whether an actor with `actorRole` is authorized to modify or remove
 * a member with `targetMemberRole`.
 *
 * Rules:
 * 1. Nobody can remove or demote the `owner`.
 * 2. Owner can manage all other roles (`admin`, `creator`, `billing_manager`, `viewer`).
 * 3. Admin can manage `creator`, `billing_manager`, `viewer`.
 * 4. Admin CANNOT manage another `admin` or the `owner`.
 * 5. Other roles cannot manage any members.
 */
export function canManageMember(actorRole: OrgRole, targetMemberRole: OrgRole): boolean {
  if (targetMemberRole === 'owner') return false; // Owner is immutable
  if (!canInviteMembers(actorRole)) return false;

  if (actorRole === 'owner') return true;

  if (actorRole === 'admin') {
    return targetMemberRole !== 'admin' && targetMemberRole !== 'owner';
  }

  return false;
}
```

---

### 4.3 Blueprint 3: `src/tree/rbac/index.ts`
**Layer:** `tree` (Domain Barrel)

```typescript
/**
 * Public API for Organization Role-Based Access Control.
 *
 * Layer: tree (Domain barrel)
 *
 * @module tree/rbac
 */

// Re-export seed types and constants
export {
  type OrgRole,
  type OrgPermission,
  type OrgRoleMetadata,
  ALL_ORG_ROLES,
  ALL_ORG_PERMISSIONS,
  RBAC_PERMISSIONS_MATRIX,
  ROLE_PERMISSION_FLAGS,
  ROLE_METADATA,
  isOrgRole,
  isOrgPermission,
} from '@/seed/types/rbac-matrix';

// Re-export domain logic, predicates, assertions, and errors
export {
  RbacPermissionError,
  hasOrgPermission,
  canCreateMissions,
  canManageBilling,
  canInviteMembers,
  canPublishVideos,
  canConfigureWebhooks,
  getRolePermissions,
  getRolesForPermission,
  hasAllOrgPermissions,
  hasAnyOrgPermission,
  assertOrgPermission,
  assertCanCreateMissions,
  assertCanManageBilling,
  assertCanInviteMembers,
  assertCanPublishVideos,
  assertCanConfigureWebhooks,
  canAssignRole,
  canManageMember,
} from '@/tree/rbac/permissions';
```

---

### 4.4 Blueprint 4: `src/__tests__/unit/enterprise/rbac-matrix.test.ts`
**Target:** `apps/sophia-ai-factory/src/__tests__/unit/enterprise/rbac-matrix.test.ts`  
Comprehensive Vitest test suite executing in milliseconds without DB or network dependencies.

```typescript
/**
 * Unit & Boundary Tests for Enterprise 5-Tier RBAC System.
 *
 * Validates:
 * 1. Complete 5x5 Permission Matrix Truth Table
 * 2. Typed helper predicates (`canCreateMissions`, `canManageBilling`, etc.)
 * 3. Viewer zero-mutation invariant (0/5 permissions)
 * 4. Billing Manager single-purpose isolation (1/5 permissions, ONLY billing)
 * 5. Admin operational privilege boundary (4/5 permissions, EXCLUDED from billing)
 * 6. Creator creative workflow boundary (2/5 permissions)
 * 7. Owner supervisory completeness (5/5 permissions)
 * 8. Assertion functions and `RbacPermissionError` throwing semantics
 * 9. Privilege escalation guards (`canAssignRole`, `canManageMember`)
 * 10. Defensive edge cases (null, undefined, invalid roles, prototype tampering)
 *
 * @module __tests__/unit/enterprise/rbac-matrix.test
 */

import { describe, it, expect } from 'vitest';
import {
  type OrgRole,
  type OrgPermission,
  ALL_ORG_ROLES,
  ALL_ORG_PERMISSIONS,
  RBAC_PERMISSIONS_MATRIX,
  ROLE_METADATA,
  isOrgRole,
  isOrgPermission,
} from '@/seed/types/rbac-matrix';
import {
  RbacPermissionError,
  hasOrgPermission,
  canCreateMissions,
  canManageBilling,
  canInviteMembers,
  canPublishVideos,
  canConfigureWebhooks,
  getRolePermissions,
  getRolesForPermission,
  hasAllOrgPermissions,
  hasAnyOrgPermission,
  assertOrgPermission,
  assertCanCreateMissions,
  assertCanManageBilling,
  assertCanInviteMembers,
  assertCanPublishVideos,
  assertCanConfigureWebhooks,
  canAssignRole,
  canManageMember,
} from '@/tree/rbac/permissions';

describe('Enterprise 5-Tier RBAC System Unit & Boundary Tests', () => {
  // ─── 1. 5x5 Matrix Truth Table ───────────────────────────────────────────────
  describe('1. 5x5 Matrix Truth Table Verification', () => {
    const expectedMatrix: Record<OrgRole, Record<OrgPermission, boolean>> = {
      owner: {
        canCreateMissions: true,
        canManageBilling: true,
        canInviteMembers: true,
        canPublishVideos: true,
        canConfigureWebhooks: true,
      },
      admin: {
        canCreateMissions: true,
        canManageBilling: false, // Strict boundary
        canInviteMembers: true,
        canPublishVideos: true,
        canConfigureWebhooks: true,
      },
      creator: {
        canCreateMissions: true,
        canManageBilling: false,
        canInviteMembers: false,
        canPublishVideos: true,
        canConfigureWebhooks: false,
      },
      billing_manager: {
        canCreateMissions: false,
        canManageBilling: true, // Only permission
        canInviteMembers: false,
        canPublishVideos: false,
        canConfigureWebhooks: false,
      },
      viewer: {
        canCreateMissions: false,
        canManageBilling: false,
        canInviteMembers: false,
        canPublishVideos: false,
        canConfigureWebhooks: false,
      },
    };

    for (const role of ALL_ORG_ROLES) {
      for (const permission of ALL_ORG_PERMISSIONS) {
        const expected = expectedMatrix[role][permission];
        it(`evaluates ${role} -> ${permission} as ${expected}`, () => {
          expect(hasOrgPermission(role, permission)).toBe(expected);
        });
      }
    }
  });

  // ─── 2. Typed Helper Predicates ──────────────────────────────────────────────
  describe('2. Typed Helper Predicates', () => {
    it('canCreateMissions returns true only for owner, admin, creator', () => {
      expect(canCreateMissions('owner')).toBe(true);
      expect(canCreateMissions('admin')).toBe(true);
      expect(canCreateMissions('creator')).toBe(true);
      expect(canCreateMissions('billing_manager')).toBe(false);
      expect(canCreateMissions('viewer')).toBe(false);
    });

    it('canManageBilling returns true strictly for owner and billing_manager', () => {
      expect(canManageBilling('owner')).toBe(true);
      expect(canManageBilling('billing_manager')).toBe(true);
      expect(canManageBilling('admin')).toBe(false);
      expect(canManageBilling('creator')).toBe(false);
      expect(canManageBilling('viewer')).toBe(false);
    });

    it('canInviteMembers returns true only for owner and admin', () => {
      expect(canInviteMembers('owner')).toBe(true);
      expect(canInviteMembers('admin')).toBe(true);
      expect(canInviteMembers('creator')).toBe(false);
      expect(canInviteMembers('billing_manager')).toBe(false);
      expect(canInviteMembers('viewer')).toBe(false);
    });

    it('canPublishVideos returns true only for owner, admin, creator', () => {
      expect(canPublishVideos('owner')).toBe(true);
      expect(canPublishVideos('admin')).toBe(true);
      expect(canPublishVideos('creator')).toBe(true);
      expect(canPublishVideos('billing_manager')).toBe(false);
      expect(canPublishVideos('viewer')).toBe(false);
    });

    it('canConfigureWebhooks returns true only for owner and admin', () => {
      expect(canConfigureWebhooks('owner')).toBe(true);
      expect(canConfigureWebhooks('admin')).toBe(true);
      expect(canConfigureWebhooks('creator')).toBe(false);
      expect(canConfigureWebhooks('billing_manager')).toBe(false);
      expect(canConfigureWebhooks('viewer')).toBe(false);
    });
  });

  // ─── 3. Invariants & Boundary Proofs ─────────────────────────────────────────
  describe('3. Invariants & Boundary Proofs', () => {
    it('INVARIANT 1: Viewer has strictly 0 mutation permissions', () => {
      const perms = getRolePermissions('viewer');
      expect(perms).toHaveLength(0);

      for (const p of ALL_ORG_PERMISSIONS) {
        expect(hasOrgPermission('viewer', p)).toBe(false);
      }
    });

    it('INVARIANT 2: Only owner and billing_manager can manage billing', () => {
      const billingRoles = getRolesForPermission('canManageBilling');
      expect(billingRoles).toEqual(['owner', 'billing_manager']);

      // Explicitly check admin cannot manage billing
      expect(hasOrgPermission('admin', 'canManageBilling')).toBe(false);
    });

    it('INVARIANT 3: Owner possesses all 5 permissions without exception', () => {
      const perms = getRolePermissions('owner');
      expect(perms).toHaveLength(5);
      expect(hasAllOrgPermissions('owner', ALL_ORG_PERMISSIONS)).toBe(true);
    });

    it('INVARIANT 4: Billing manager has exactly 1 permission', () => {
      const perms = getRolePermissions('billing_manager');
      expect(perms).toEqual(['canManageBilling']);
    });

    it('INVARIANT 5: Creator has exactly 2 permissions', () => {
      const perms = getRolePermissions('creator');
      expect(perms).toEqual(['canCreateMissions', 'canPublishVideos']);
    });
  });

  // ─── 4. Aggregation & Multi-Permission Queries ───────────────────────────────
  describe('4. Aggregation & Multi-Permission Queries', () => {
    it('hasAllOrgPermissions returns true if all permissions are held', () => {
      expect(hasAllOrgPermissions('owner', ['canCreateMissions', 'canManageBilling'])).toBe(true);
      expect(hasAllOrgPermissions('admin', ['canCreateMissions', 'canPublishVideos'])).toBe(true);
      expect(hasAllOrgPermissions('admin', ['canCreateMissions', 'canManageBilling'])).toBe(false);
      expect(hasAllOrgPermissions('viewer', [])).toBe(true);
    });

    it('hasAnyOrgPermission returns true if at least one permission is held', () => {
      expect(hasAnyOrgPermission('creator', ['canManageBilling', 'canCreateMissions'])).toBe(true);
      expect(hasAnyOrgPermission('creator', ['canManageBilling', 'canInviteMembers'])).toBe(false);
      expect(hasAnyOrgPermission('viewer', ALL_ORG_PERMISSIONS)).toBe(false);
    });
  });

  // ─── 5. Fail-Closed Assertions & RbacPermissionError ──────────────────────────
  describe('5. Fail-Closed Assertions', () => {
    it('assertOrgPermission does not throw when permission is held', () => {
      expect(() => assertOrgPermission('owner', 'canManageBilling')).not.toThrow();
      expect(() => assertOrgPermission('admin', 'canConfigureWebhooks')).not.toThrow();
      expect(() => assertOrgPermission('creator', 'canCreateMissions')).not.toThrow();
    });

    it('assertOrgPermission throws RbacPermissionError with 403 status code when denied', () => {
      expect(() => assertOrgPermission('admin', 'canManageBilling', 'Stripe checkout')).toThrow(
        RbacPermissionError,
      );

      try {
        assertOrgPermission('viewer', 'canPublishVideos', 'YouTube Dispatch');
      } catch (err) {
        expect(err).toBeInstanceOf(RbacPermissionError);
        const rbacErr = err as RbacPermissionError;
        expect(rbacErr.code).toBe('PERMISSION_DENIED');
        expect(rbacErr.statusCode).toBe(403);
        expect(rbacErr.role).toBe('viewer');
        expect(rbacErr.permission).toBe('canPublishVideos');
        expect(rbacErr.context).toBe('YouTube Dispatch');
        expect(rbacErr.message).toContain('PERMISSION_DENIED');
      }
    });

    it('individual assert helpers throw appropriately', () => {
      expect(() => assertCanManageBilling('admin')).toThrow(/canManageBilling/);
      expect(() => assertCanCreateMissions('viewer')).toThrow(/canCreateMissions/);
      expect(() => assertCanInviteMembers('creator')).toThrow(/canInviteMembers/);
      expect(() => assertCanPublishVideos('billing_manager')).toThrow(/canPublishVideos/);
      expect(() => assertCanConfigureWebhooks('creator')).toThrow(/canConfigureWebhooks/);
    });
  });

  // ─── 6. Privilege Escalation & Role Delegation Guards ─────────────────────────
  describe('6. Privilege Escalation & Role Delegation Guards', () => {
    it('owner can assign admin, creator, billing_manager, viewer, but not owner', () => {
      expect(canAssignRole('owner', 'admin')).toBe(true);
      expect(canAssignRole('owner', 'creator')).toBe(true);
      expect(canAssignRole('owner', 'billing_manager')).toBe(true);
      expect(canAssignRole('owner', 'viewer')).toBe(true);
      expect(canAssignRole('owner', 'owner')).toBe(false); // Immutable owner invariant
    });

    it('admin can assign creator, billing_manager, viewer, but CANNOT assign admin or owner', () => {
      expect(canAssignRole('admin', 'creator')).toBe(true);
      expect(canAssignRole('admin', 'billing_manager')).toBe(true);
      expect(canAssignRole('admin', 'viewer')).toBe(true);
      expect(canAssignRole('admin', 'admin')).toBe(false); // Privilege escalation guard
      expect(canAssignRole('admin', 'owner')).toBe(false);
    });

    it('creator, billing_manager, viewer cannot assign any roles', () => {
      for (const actor of ['creator', 'billing_manager', 'viewer'] as OrgRole[]) {
        for (const target of ALL_ORG_ROLES) {
          expect(canAssignRole(actor, target)).toBe(false);
        }
      }
    });

    it('canManageMember prevents modifying or removing the owner', () => {
      expect(canManageMember('owner', 'owner')).toBe(false);
      expect(canManageMember('admin', 'owner')).toBe(false);
      expect(canManageMember('creator', 'owner')).toBe(false);
    });

    it('owner can manage admins, creators, billing managers, and viewers', () => {
      expect(canManageMember('owner', 'admin')).toBe(true);
      expect(canManageMember('owner', 'creator')).toBe(true);
      expect(canManageMember('owner', 'billing_manager')).toBe(true);
      expect(canManageMember('owner', 'viewer')).toBe(true);
    });

    it('admin cannot manage other admins or owner, but can manage creators, billing managers, viewers', () => {
      expect(canManageMember('admin', 'admin')).toBe(false);
      expect(canManageMember('admin', 'creator')).toBe(true);
      expect(canManageMember('admin', 'billing_manager')).toBe(true);
      expect(canManageMember('admin', 'viewer')).toBe(true);
    });
  });

  // ─── 7. Defensive Typing & Tamper Resistance ──────────────────────────────────
  describe('7. Defensive Typing & Tamper Resistance', () => {
    it('isOrgRole identifies valid roles and rejects invalid inputs', () => {
      expect(isOrgRole('owner')).toBe(true);
      expect(isOrgRole('admin')).toBe(true);
      expect(isOrgRole('creator')).toBe(true);
      expect(isOrgRole('billing_manager')).toBe(true);
      expect(isOrgRole('viewer')).toBe(true);

      expect(isOrgRole('superadmin')).toBe(false);
      expect(isOrgRole('member')).toBe(false);
      expect(isOrgRole('')).toBe(false);
      expect(isOrgRole(null)).toBe(false);
      expect(isOrgRole(undefined)).toBe(false);
      expect(isOrgRole(123)).toBe(false);
      expect(isOrgRole({})).toBe(false);
    });

    it('isOrgPermission identifies valid permissions and rejects invalid inputs', () => {
      expect(isOrgPermission('canCreateMissions')).toBe(true);
      expect(isOrgPermission('canManageBilling')).toBe(true);
      expect(isOrgPermission('canInviteMembers')).toBe(true);
      expect(isOrgPermission('canPublishVideos')).toBe(true);
      expect(isOrgPermission('canConfigureWebhooks')).toBe(true);

      expect(isOrgPermission('canDeleteOrg')).toBe(false);
      expect(isOrgPermission('')).toBe(false);
      expect(isOrgPermission(null)).toBe(false);
      expect(isOrgPermission(undefined)).toBe(false);
    });

    it('hasOrgPermission fails closed (returns false) on malicious/unknown roles', () => {
      expect(hasOrgPermission('superadmin' as OrgRole, 'canManageBilling')).toBe(false);
      expect(hasOrgPermission(null as unknown as OrgRole, 'canCreateMissions')).toBe(false);
      expect(hasOrgPermission('__proto__' as OrgRole, 'canConfigureWebhooks')).toBe(false);
    });

    it('metadata registry covers all 5 roles with bilingual strings', () => {
      for (const role of ALL_ORG_ROLES) {
        const meta = ROLE_METADATA[role];
        expect(meta).toBeDefined();
        expect(meta.displayNameEn).toBeTruthy();
        expect(meta.displayNameVi).toBeTruthy();
        expect(meta.descriptionEn).toBeTruthy();
        expect(meta.descriptionVi).toBeTruthy();
      }
    });
  });
});
```

---

## 5. Integration Architecture with Server Actions & Middleware

### 5.1 Integration with `src/forest/tenant/isolation-guard.ts` (Explorer M2_3)
When an enterprise request arrives at an Edge API route or Server Action:
1. **Tenant Isolation Guard** verifies `assertTenantScope(activeOrgId, targetResourceOrgId)` to prevent cross-tenant data leakage.
2. **RBAC Guard** verifies `assertOrgPermission(memberRole, requiredPermission)` to enforce intra-tenant role authorization.

Example composition pattern:
```typescript
import { assertTenantScope } from '@/forest/tenant/isolation-guard';
import { assertOrgPermission } from '@/tree/rbac/permissions';
import type { OrgRole } from '@/seed/types/rbac-matrix';

export async function mutateBillingSettings(
  activeOrgId: string,
  targetOrgId: string,
  userRole: OrgRole,
  billingPayload: unknown
) {
  // Step 1: Inter-tenant isolation check
  assertTenantScope(activeOrgId, targetOrgId);

  // Step 2: Intra-tenant RBAC permission check
  assertOrgPermission(userRole, 'canManageBilling', 'Update Billing Settings');

  // Step 3: Execute mutation...
}
```

### 5.2 Integration with `src/land/admin/org-manager.ts` (Explorer M2_1)
In the invitation creation and role update Server Actions:
1. When an inviter sends an invite:
   ```typescript
   assertCanInviteMembers(inviterRole, 'Invite Team Member');
   if (!canAssignRole(inviterRole, requestedRole)) {
     throw new Error(`FORBIDDEN: Role '${inviterRole}' is not allowed to assign role '${requestedRole}'`);
   }
   ```
2. When removing or demoting a member:
   ```typescript
   if (!canManageMember(actorRole, targetMemberRole)) {
     throw new Error(`FORBIDDEN: Role '${actorRole}' is not authorized to manage member with role '${targetMemberRole}'`);
   }
   ```

---

## 6. Verification and Risk Analysis

### 6.1 Risk Assessment
| Risk | Severity | Mitigation |
|---|---|---|
| Admin gaining billing access | High | Strict unit and E2E assertions proving `hasOrgPermission('admin', 'canManageBilling') === false`. |
| Privilege escalation via invite | High | `canAssignRole` guard restricts admins to assigning only creator, billing_manager, and viewer roles. |
| Viewer mutation leakage | High | Hardened zero-permission invariant: `viewer` has 0 array elements in `RBAC_PERMISSIONS_MATRIX` and all `false` in `ROLE_PERMISSION_FLAGS`. |
| 4-Layer architectural violation | Critical | `seed/types/rbac-matrix.ts` has zero imports. `tree/rbac/permissions.ts` only imports from `seed`. Verified by `scripts/check-layer-boundaries.sh`. |

### 6.2 Verification Commands
1. Run E2E test suite:
   ```bash
   npx vitest run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts
   ```
2. Run newly designed unit tests:
   ```bash
   npx vitest run src/__tests__/unit/enterprise/rbac-matrix.test.ts
   ```
3. Check 4-layer architecture boundaries:
   ```bash
   bash scripts/check-layer-boundaries.sh
   ```
4. Check TypeScript compilation:
   ```bash
   npm run type-check
   ```
