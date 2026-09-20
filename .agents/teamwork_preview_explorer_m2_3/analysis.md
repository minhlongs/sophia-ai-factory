# Technical Analysis: Org Context Switcher & Tenant Isolation Guard (Milestone 2)

**Author:** `teamwork_preview_explorer_m2_3`  
**Date:** 2026-09-20  
**Status:** COMPLETE / ACTIONABLE BLUEPRINT  
**Target Modules:**  
- `apps/sophia-ai-factory/src/forest/tenant/context-switcher.ts`
- `apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`
- `apps/sophia-ai-factory/src/app/actions/org-context.ts` (Server Actions)
- `apps/sophia-ai-factory/src/forest/middleware/tenant-isolation.ts` (Middleware update)

---

## 1. Problem Boundary & Objectives

In Milestone 2 (Phase 18–19 Enterprise Scale Foundations), Sophia AI Factory expands from single-user solo workspaces into multi-user, multi-tenant organizations with 5-tier RBAC (`owner`, `admin`, `creator`, `billing_manager`, `viewer`).

A core requirement of this architecture is supporting users who belong to **multiple organizations** (e.g., an agency founder who owns Org A and is an admin in Org B). When such a user executes actions or queries data:
1. The platform must allow the user to deterministically select and switch their active organization context (`active_org_id` cookie and header).
2. The platform must strictly validate that the user is an active member of the requested target organization before granting context, preventing spoofing or privilege escalation.
3. Every resource access and mutation must pass through the **Tenant Isolation Guard** (`assertTenantScope`), which strictly verifies that the active organization context matches the resource's organization ID.
4. If an empty, undefined, or cross-tenant organization ID is encountered, the guard must immediately halt execution, log a security audit event, and throw a `CROSS_TENANT_VIOLATION` error.
5. All implementations must adhere strictly to Sophia's 4-layer architecture (`seed` → `tree` → `forest` → `land`) with zero boundary violations.

---

## 2. Codebase Grounding & Baseline Observations

### 2.1 E2E Test Suite Expectations (`src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`)
Lines 387–443 of `organizations-rbac.e2e.test.ts` define the contract for Feature 6:
- **F6-1:** `assertTenantScope('org_alpha', 'org_alpha')` must succeed silently (not throw).
- **F6-2:** `assertTenantScope('org_alpha', 'org_beta')` must throw an error whose message contains `CROSS_TENANT_VIOLATION`.
- **F6-3:** `assertTenantScope('', 'org_alpha')` and `assertTenantScope('org_alpha', '')` must throw an error containing `CROSS_TENANT_VIOLATION`.
- **F6-4:** A user belonging to multiple organizations (`orgA` as owner, `orgB` as admin) can switch their active context:
  - Context `orgA`: Accessing `orgA` resource succeeds; accessing `orgB` resource throws `CROSS_TENANT_VIOLATION`.
  - Context `orgB`: Accessing `orgB` resource succeeds; accessing `orgA` resource throws `CROSS_TENANT_VIOLATION`.
- **F6-5:** An unauthorized user cannot assert context for an organization they do not belong to.

### 2.2 Existing Workspace Access Primitive (`src/seed/auth/workspace-access.ts`)
- Contains legacy role hierarchy (`OWNER: 50, ADMIN: 40, OPERATOR: 30, MEMBER: 20, VIEWER: 10`).
- Implements `withTenantScope(options, fn)` and `requireWorkspaceAccess(workspaceId, userId)`.
- Queries table `org_members` (legacy schema). Milestone 2 introduces `organization_members` as defined in `0276`/enterprise schema.
- **Insight:** Context switcher must seamlessly support `organization_members` while gracefully falling back to `org_members` to ensure dual compatibility across test environments and production D1 databases.

### 2.3 Existing Tenant Isolation Middleware (`src/forest/middleware/tenant-isolation.ts`)
- Currently validates agency-specific access on API routes (`/api/*`) via `extractAgencyId(request)`.
- Uses `logValidationWithReceipt` for audit logging.
- Does not yet check `active_org_id` cookie or header for multi-tenant organizations.
- Needs to integrate `assertTenantScope` and `getActiveOrgContext` to protect both Edge API routes and Server Actions.

### 2.4 4-Layer Architecture Constraints (`scripts/check-layer-boundaries.sh`)
- `seed`: Can be imported by any layer; cannot import `tree`, `forest`, or `land`.
- `tree`: Can import `seed`; cannot import `forest` or `land`.
- `forest`: Can import `seed` and `tree`. Cannot import `land`.
- `land`: Can import `seed` and `tree`. **Cannot import `forest`** (enforced by `check-layer-boundaries.sh` line 36).
- `src/app/` (Next.js App Router): Can import from `seed`, `tree`, `forest`, and `land`.
- **Architectural Decision:**
  - `src/forest/tenant/context-switcher.ts` and `src/forest/tenant/isolation-guard.ts` reside in the `forest` layer because they coordinate database queries, audit logging, telemetry, and request cookies/headers.
  - Server Actions that expose context switching to the UI should reside in `src/app/actions/org-context.ts` or Server Components, which are allowed to import from `forest`.
  - To allow pure functions in `tree` or `land` to assert tenant scope without violating layer rules, we also provide a pure assertion primitive in `seed/auth/workspace-access.ts` or `tree/rbac/`, which `forest/tenant/isolation-guard.ts` re-exports and augments with telemetry and audit logging.

---

## 3. Detailed Technical Design: Org Context Switcher (`src/forest/tenant/context-switcher.ts`)

### 3.1 Interface Contracts & Data Types

```typescript
export type OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer';

export interface ActiveOrgContext {
  readonly orgId: string;
  readonly orgName: string;
  readonly slug: string;
  readonly role: OrgRole;
  readonly tier: string;
  readonly userId: string;
  readonly userEmail?: string;
}

export interface UserOrgMembership {
  readonly orgId: string;
  readonly orgName: string;
  readonly slug: string;
  readonly role: OrgRole;
  readonly tier: string;
  readonly maxSeats: number;
  readonly isOwner: boolean;
  readonly isActiveContext: boolean;
  readonly joinedAt: number;
}

export type OrgContextErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_ORG_ID'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'ORGANIZATION_NOT_FOUND'
  | 'DB_UNAVAILABLE';

export class OrgContextError extends Error {
  readonly code: OrgContextErrorCode;
  readonly orgId?: string;
  readonly userId?: string;

  constructor(message: string, code: OrgContextErrorCode, orgId?: string, userId?: string) {
    super(message);
    this.name = 'OrgContextError';
    this.code = code;
    this.orgId = orgId;
    this.userId = userId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

### 3.2 Cookie & Header Conventions

- **Cookie Name:** `active_org_id`
  - Attributes: `HttpOnly: true`, `Secure: true` (in production), `SameSite: Lax`, `Path: /`, `Max-Age: 2,592,000` (30 days).
- **HTTP Headers:**
  - `x-active-org-id`: Primary header for API clients / background tasks.
  - `x-org-id`: Secondary fallback header for backward compatibility.
- **Precedence Hierarchy:**
  1. Explicit argument (`targetOrgId`) passed to function.
  2. Request Header (`x-active-org-id` or `x-org-id`).
  3. Request Cookie (`active_org_id`).
  4. Custom Domain hostname mapping (via `resolveTenantFromHostname`).
  5. Fallback: User's earliest joined organization (`created_at ASC`).

### 3.3 Core Operations

1. **`validateOrgMembership(db, userId, orgId)`**:
   - Queries `organization_members` joining `organizations`.
   - Fallback: queries `org_members` joining `organizations`.
   - Checks:
     - Record exists with `user_id = ?` and `org_id = ?`.
     - `organizations.status === 'active'`.
   - Returns `{ isMember: boolean, role: OrgRole | null, org: OrgMetadata | null }`.

2. **`switchActiveOrg(userId, targetOrgId, options)`**:
   - Defensive validation: `targetOrgId` and `userId` must be non-empty strings.
   - Executes `validateOrgMembership`.
   - **Security Gate:** If `!isMember`:
     - Emits structured security warning `logger.warn('[security] unauthorized_org_context_assertion', { userId, targetOrgId })`.
     - Calls `logAuditEvent({ action: 'UNAUTHORIZED_ORG_CONTEXT_ASSERTION', userId, metadata: { targetOrgId } })`.
     - Throws `new OrgContextError('User is not a member of the requested organization', 'MEMBERSHIP_NOT_FOUND', targetOrgId, userId)`.
   - If member:
     - Sets cookie `active_org_id` (when running within Server Action / Route Handler context).
     - Returns populated `ActiveOrgContext`.

3. **`getActiveOrgContext(options)`**:
   - Resolves current authenticated `user.id`.
   - Extracts candidate `orgId` from header, cookie, or hostname.
   - If candidate exists:
     - Validates membership using `validateOrgMembership`.
     - If valid: returns `ActiveOrgContext`.
     - If invalid: candidate is treated as untrusted/stale/spoofed. Clears cookie if possible and falls back to primary org.
   - If no candidate exists or candidate was invalid:
     - Looks up user's organizations ordered by `created_at ASC`.
     - Returns context for the earliest active organization.
     - If user belongs to 0 organizations, returns `null`.

4. **`listUserOrganizations(userId, activeOrgId?, db?)`**:
   - Retrieves all organizations where user has active membership.
   - Annotates each with `isActiveContext: org.id === activeOrgId`.
   - Returns array for UI Org Switcher selector component.

---

## 4. Detailed Technical Design: Tenant Isolation Guard (`src/forest/tenant/isolation-guard.ts`)

### 4.1 Function Signature & Behavior

```typescript
export function assertTenantScope(
  currentOrgId: string | null | undefined,
  resourceOrgId: string | null | undefined
): void
```

### 4.2 Invariant Validation Rules

The guard strictly enforces:
1. `currentOrgId` must be a non-empty, trimmed string.
2. `resourceOrgId` must be a non-empty, trimmed string.
3. `currentOrgId.trim() === resourceOrgId.trim()`.

If any condition fails:
- Immediately generates a security log entry:
  ```typescript
  logger.error('[security] cross_tenant_violation', {
    currentOrgId: currentOrgId || '<EMPTY>',
    resourceOrgId: resourceOrgId || '<EMPTY>',
    timestamp: new Date().toISOString(),
  });
  ```
- Dispatches security audit receipt asynchronously (fail-safe without blocking synchronous signature):
  ```typescript
  logAuditEvent({
    action: 'CROSS_TENANT_VIOLATION_DETECTED',
    userId: currentOrgId || 'unknown',
    metadata: { currentOrgId, resourceOrgId, timestamp: Date.now() },
  }).catch(() => {});
  ```
- Throws `CrossTenantViolationError`:
  ```
  CROSS_TENANT_VIOLATION: Current org context '<currentOrgId>' is not authorized to access resource in org '<resourceOrgId>'
  ```

### 4.3 Error Class Definition

```typescript
export class CrossTenantViolationError extends Error {
  readonly code = 'CROSS_TENANT_VIOLATION' as const;
  readonly currentOrgId: string;
  readonly resourceOrgId: string;
  readonly timestamp: number;

  constructor(currentOrgId?: string | null, resourceOrgId?: string | null) {
    const curr = currentOrgId && currentOrgId.trim() !== '' ? currentOrgId.trim() : '<EMPTY_CURRENT_ORG>';
    const res = resourceOrgId && resourceOrgId.trim() !== '' ? resourceOrgId.trim() : '<EMPTY_RESOURCE_ORG>';
    super(`CROSS_TENANT_VIOLATION: Current org context '${curr}' is not authorized to access resource in org '${res}'`);
    this.name = 'CrossTenantViolationError';
    this.currentOrgId = curr;
    this.resourceOrgId = res;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

### 4.4 Higher-Order Utility Guards

- **`assertResourceScope<T extends { org_id?: string; orgId?: string }>(currentOrgId: string, resource: T | null | undefined, resourceType?: string): asserts resource is T`**
  - Asserts resource is not null/undefined.
  - Extracts `resource.org_id ?? resource.orgId`.
  - Executes `assertTenantScope(currentOrgId, resourceOrgId)`.
- **`withTenantIsolation<T>(currentOrgId: string, resourceOrgId: string, fn: () => T | Promise<T>): Promise<T>`**
  - Asserts tenant scope before executing callback `fn`.
- **`filterByTenant<T extends { org_id?: string; orgId?: string }>(items: T[], currentOrgId: string): T[]`**
  - Defense-in-depth sanitization of query results.

---

## 5. End-to-End Integration Architecture: 0 Cross-Tenant Leakage

### 5.1 Next.js Edge Middleware Integration (`middleware/api-pipeline.ts` & `forest/middleware/tenant-isolation.ts`)

1. In `forest/middleware/tenant-isolation.ts`:
   - Inspects `request.headers.get('x-active-org-id')` or `request.cookies.get('active_org_id')`.
   - Inspects URL path parameters (e.g., `/api/v1/orgs/:orgId/*`, `/api/v1/quota/:tenantId`).
   - If URL specifies a tenant ID:
     - Ensures caller's active context matches the target: `assertTenantScope(activeOrgId, targetTenantId)`.
     - On mismatch: Returns `403 Forbidden` with header `X-Tenant-Isolation-Reason: CROSS_TENANT_VIOLATION`.
2. In `middleware/dashboard-pipeline.ts`:
   - On incoming requests to `/dashboard/*`:
     - Reads `active_org_id` cookie.
     - Injects `x-active-org-id` into downstream request headers.
     - Downstream Server Components receive validated tenant context via headers.

### 5.2 Server Action Integration Pattern (`src/app/actions/org-context.ts`)

```typescript
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { switchActiveOrg, listUserOrganizations } from '@/forest/tenant/context-switcher';
import { success, failure, type Result } from '@/seed/types/result';

export async function switchActiveOrgAction(targetOrgId: string) {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });

  try {
    const context = await switchActiveOrg(user.id, targetOrgId);
    
    // Set HTTP cookie in Next.js Server Action
    const cookieStore = await cookies();
    cookieStore.set('active_org_id', context.orgId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    revalidatePath('/dashboard', 'layout');
    return success(context);
  } catch (err) {
    return failure({ code: 'SWITCH_FAILED', message: err instanceof Error ? err.message : 'Context switch denied' });
  }
}
```

### 5.3 Data Mutation Defense-in-Depth Pattern

Every database mutation in Server Actions follows this 4-step checklist:
1. **Context Resolution:** `const ctx = await getActiveOrgContext();`
2. **Resource Fetch:** Fetch the existing record (`SELECT org_id FROM ... WHERE id = ?`).
3. **Tenant Scope Assertion:** `assertTenantScope(ctx.orgId, record.org_id);`
4. **Scoped Execution:** Perform mutation with `WHERE id = ? AND org_id = ?` binding `ctx.orgId`.
On create/insert: The `org_id` column is **always** populated from `ctx.orgId`, strictly ignoring any client payload `org_id`.

---

## 6. Verification and Regression Defense

1. **E2E RBAC Suite:**
   `npx vitest run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`
   Must pass all tests in `F6: Org Context Switching & Tenant Data Isolation Guard` (F6-1 through F6-5) and boundary case B5.
2. **Layer Boundary Check:**
   `bash scripts/check-layer-boundaries.sh`
   Must exit with code 0 (zero violations across seed, tree, forest, land).
3. **TypeScript Zero-Error Gate:**
   `npm run type-check`
   Must pass cleanly with 0 type errors.
