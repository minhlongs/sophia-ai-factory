# Handoff Report — Milestone 2: Org Context Switcher & Tenant Isolation Guard

**Module:** Milestone 2: Multi-User Organizations & 5-Tier RBAC  
**Scope:** Org Context Switcher (`src/forest/tenant/context-switcher.ts`) & Tenant Isolation Guard (`src/forest/tenant/isolation-guard.ts`)  
**Investigator:** `teamwork_preview_explorer_m2_3`  
**Date:** 2026-09-20  

---

## 1. Observation

Direct observations from inspection of the codebase and test harness:

### Observation 1.1: Feature 6 Specification & Test Assertions in `organizations-rbac.e2e.test.ts`
File: `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts` (Lines 387–443):
```typescript
387: describe('F6: Org Context Switching & Tenant Data Isolation Guard', () => {
388:   it('F6-1: assertTenantScope succeeds when context matches resource organization', () => {
389:     expect(() => assertTenantScope('org_alpha', 'org_alpha')).not.toThrow();
390:   });
391: 
392:   it('F6-2: assertTenantScope throws CROSS_TENANT_VIOLATION on organization mismatch', () => {
393:     expect(() => assertTenantScope('org_alpha', 'org_beta')).toThrow(/CROSS_TENANT_VIOLATION/);
394:   });
395: 
396:   it('F6-3: assertTenantScope throws on empty or undefined organization IDs', () => {
397:     expect(() => assertTenantScope('', 'org_alpha')).toThrow(/CROSS_TENANT_VIOLATION/);
398:     expect(() => assertTenantScope('org_alpha', '')).toThrow(/CROSS_TENANT_VIOLATION/);
399:   });
400: 
401:   it('F6-4: allows user belonging to multiple organizations to switch active context', async () => {
402:     const orgA = await createOrganization(db, { name: 'Org A', slug: 'org-a', tier: 'starter', ownerUserId });
403:     const orgB = await createOrganization(db, { name: 'Org B', slug: 'org-b', tier: 'starter', ownerUserId: 'usr_other' });
404: 
405:     // Add user to Org B as admin
406:     await db
407:       .prepare(
408:         `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
409:          VALUES ('mem_b_user', ?1, ?2, 'admin', ?3, ?3)`
410:       )
411:       .bind(orgB.orgId, ownerUserId, Date.now())
412:       .run();
413: 
414:     // User memberships
415:     const memberships = await db
416:       .prepare(`SELECT org_id, role FROM organization_members WHERE user_id = ?1`)
417:       .bind(ownerUserId)
418:       .all<{ org_id: string; role: OrgRole }>();
419: 
420:     expect(memberships.results).toHaveLength(2);
421: 
422:     // Switching context to Org A: authorized for Org A resources
423:     let currentContext = orgA.orgId;
424:     expect(() => assertTenantScope(currentContext, orgA.orgId)).not.toThrow();
425:     expect(() => assertTenantScope(currentContext, orgB.orgId)).toThrow(/CROSS_TENANT_VIOLATION/);
426: 
427:     // Switching context to Org B: authorized for Org B resources
428:     currentContext = orgB.orgId;
429:     expect(() => assertTenantScope(currentContext, orgB.orgId)).not.toThrow();
430:     expect(() => assertTenantScope(currentContext, orgA.orgId)).toThrow(/CROSS_TENANT_VIOLATION/);
431:   });
432: 
433:   it('F6-5: prevents user from asserting context for an organization they do not belong to', async () => {
434:     const orgSecret = await createOrganization(db, { name: 'Secret Org', slug: 'secret-org', tier: 'pro', ownerUserId: 'usr_stranger' });
435:     const memberships = await db
436:       .prepare(`SELECT org_id FROM organization_members WHERE user_id = ?1`)
437:       .bind('usr_unauthorized')
438:       .all<{ org_id: string }>();
439: 
440:     const isMember = (memberships.results ?? []).some((m) => m.org_id === orgSecret.orgId);
441:     expect(isMember).toBe(false);
442:   });
443: });
```

### Observation 1.2: Implementation in Test Harness
File: `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/enterprise-test-harness.ts` (Lines 511–517):
```typescript
export function assertTenantScope(currentOrgId: string, targetResourceOrgId: string): void {
  if (!currentOrgId || !targetResourceOrgId || currentOrgId !== targetResourceOrgId) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Current org context '${currentOrgId}' is not authorized to access resource in org '${targetResourceOrgId}'`
    );
  }
}
```

### Observation 1.3: 4-Layer Architecture Enforcement
File: `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` (Lines 35–41):
```bash
# land→forest (forbidden — circular)
LAND_FOREST=$(grep -rn "from ['\"]@/forest" src/land/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." || true)
if [ -n "$LAND_FOREST" ]; then
  echo "❌ land→forest violations:"
  echo "$LAND_FOREST"
  ERRORS=$((ERRORS+1))
fi
```
`src/land/` cannot import from `src/forest/`. UI Server Actions can reside in `src/app/actions/org-context.ts` (which is part of the Next.js App layer and allowed to import from `@/forest/*`), while any pure tenant scope assertions needed in `land/` or `tree/` can be provided via `@/seed/auth/workspace-access` or re-exported cleanly without circularity.

### Observation 1.4: Existing Tenant Context Resolver
File: `apps/sophia-ai-factory/src/seed/auth/get-tenant-context.ts` (Lines 41–53):
```typescript
const row = await d1
  .prepare(
    `SELECT m.org_id   AS org_id,
            s.plan     AS plan
     FROM   org_members m
     LEFT JOIN subscriptions s
       ON   s.org_id = m.org_id
       AND  s.status = 'active'
     WHERE  m.user_id = ?
     LIMIT  1`,
  )
  .bind(userId)
  .first<JoinRow>()
```
The legacy resolver assumes 1 organization per user (`LIMIT 1`). For multi-org enterprise scale, users have multiple memberships, requiring the Org Context Switcher to allow dynamic selection and persistence of `active_org_id`.

---

## 2. Logic Chain

1. **Multi-Org Context Need:** A user can be a member of $N \ge 1$ organizations (**Observation 1.1 F6-4**). A static query with `LIMIT 1` (**Observation 1.4**) binds the user to whichever organization was created first, preventing multi-tenant collaboration.
2. **Context Selection & Verification Invariant:** When a user asserts a target organization context via header `x-active-org-id` or cookie `active_org_id`, the system must verify that the user exists in `organization_members` for that specific `org_id` before granting context (**Observation 1.1 F6-5**). If the user is not a verified member, the assertion must be rejected and flagged as a security event.
3. **Synchronous Scope Guard Requirement:** The test contract for `assertTenantScope` requires a synchronous function signature `(currentOrgId: string, resourceOrgId: string): void` (**Observation 1.1 F6-1 to F6-3, Observation 1.2**). It must validate that neither ID is empty/undefined, that they match identically, and throw an error matching `/CROSS_TENANT_VIOLATION/` on any mismatch.
4. **Defense-in-Depth Audit Logging:** To satisfy enterprise auditability without violating the synchronous test signature, `assertTenantScope` must log synchronously to structured logger (`logger.error('[security] cross_tenant_violation', ...)`) and trigger non-blocking audit event dispatching (`logAuditEvent`) to record the incident in the audit trail.
5. **Layer Architecture Compliance:** Because `land → forest` is forbidden by `check-layer-boundaries.sh` (**Observation 1.3**), `context-switcher.ts` and `isolation-guard.ts` are placed in `src/forest/tenant/`, while client-facing Server Actions are located in `src/app/actions/org-context.ts`.

---

## 3. Caveats

- **Dual-Table Schema Parity:** Legacy migrations utilized `org_members`, whereas enterprise E2E tests and Phase 18 schema (`0276`) utilize `organization_members`. The context switcher implementation queries `organization_members` first and falls back to `org_members` to ensure 100% test and production runtime compatibility.
- **Cookie Access Boundaries:** In Next.js App Router, `cookies()` from `next/headers` can only write cookies inside Server Actions or Route Handlers, not during Server Component rendering. Context switching mutations are therefore exposed as Server Actions (`switchActiveOrgAction`).

---

## 4. Conclusion & Concrete Implementation Blueprint

The solution consists of three primary modules:
1. `apps/sophia-ai-factory/src/forest/tenant/context-switcher.ts`
2. `apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`
3. `apps/sophia-ai-factory/src/app/actions/org-context.ts`

### 4.1 Production Implementation: `src/forest/tenant/context-switcher.ts`

```typescript
/**
 * Multi-Tenant Organization Context Switcher
 *
 * Manages active organization context for users belonging to multiple organizations.
 * Validates active membership before granting context and persists selection via
 * `active_org_id` cookie and headers.
 *
 * Layer: forest/tenant
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import type { OrgRole } from '@/seed/types/rbac-matrix';

export const ACTIVE_ORG_COOKIE = 'active_org_id';
export const ACTIVE_ORG_HEADER = 'x-active-org-id';
export const FALLBACK_ORG_HEADER = 'x-org-id';

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

export type ContextSwitchErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_ORG_ID'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'ORGANIZATION_NOT_FOUND'
  | 'DB_UNAVAILABLE';

export class OrgContextError extends Error {
  readonly code: ContextSwitchErrorCode;
  readonly orgId?: string;
  readonly userId?: string;

  constructor(message: string, code: ContextSwitchErrorCode, orgId?: string, userId?: string) {
    super(message);
    this.name = 'OrgContextError';
    this.code = code;
    this.orgId = orgId;
    this.userId = userId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates whether a user is an active member of the specified organization.
 * Checks both `organization_members` and legacy `org_members` tables.
 */
export async function validateOrgMembership(
  userId: string,
  targetOrgId: string,
  dbClient?: D1Database | null
): Promise<{
  isMember: boolean;
  role: OrgRole | null;
  org: { name: string; slug: string; tier: string; status: string; maxSeats: number } | null;
}> {
  if (!userId || !targetOrgId || targetOrgId.trim() === '') {
    return { isMember: false, role: null, org: null };
  }

  const d1 = dbClient ?? (await getD1());
  if (!d1) {
    logger.error('[OrgContext] D1 database unavailable for membership validation');
    return { isMember: false, role: null, org: null };
  }

  try {
    // 1. Primary enterprise check: organization_members
    const memberRow = await d1
      .prepare(
        `SELECT m.role, o.name, o.slug, o.tier, o.status, o.max_seats
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND m.org_id = ?2
         LIMIT 1`
      )
      .bind(userId, targetOrgId)
      .first<{
        role: string;
        name: string;
        slug: string;
        tier: string;
        status: string;
        max_seats: number;
      }>();

    if (memberRow) {
      const isStatusActive = memberRow.status === 'active';
      return {
        isMember: isStatusActive,
        role: memberRow.role as OrgRole,
        org: {
          name: memberRow.name,
          slug: memberRow.slug,
          tier: memberRow.tier,
          status: memberRow.status,
          maxSeats: memberRow.max_seats ?? 1,
        },
      };
    }
  } catch {
    // Fall back to legacy schema if organization_members does not exist
  }

  try {
    // 2. Fallback legacy check: org_members
    const legacyRow = await d1
      .prepare(
        `SELECT m.role, o.name, o.slug, o.tier, o.status, o.max_seats
         FROM org_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND m.org_id = ?2
         LIMIT 1`
      )
      .bind(userId, targetOrgId)
      .first<{
        role: string;
        name: string;
        slug: string;
        tier: string;
        status: string;
        max_seats?: number;
      }>();

    if (legacyRow) {
      const isStatusActive = !legacyRow.status || legacyRow.status === 'active';
      return {
        isMember: isStatusActive,
        role: (legacyRow.role || 'member') as OrgRole,
        org: {
          name: legacyRow.name,
          slug: legacyRow.slug,
          tier: legacyRow.tier || 'free',
          status: legacyRow.status || 'active',
          maxSeats: legacyRow.max_seats ?? 1,
        },
      };
    }
  } catch (err) {
    logger.warn('[OrgContext] Legacy membership fallback query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { isMember: false, role: null, org: null };
}

/**
 * Switches the active organization context for a user.
 * Validates membership; throws OrgContextError with audit logging on unauthorized assertion.
 */
export async function switchActiveOrg(
  userId: string,
  targetOrgId: string,
  dbClient?: D1Database | null
): Promise<ActiveOrgContext> {
  if (!userId) {
    throw new OrgContextError('Authentication required to switch organization', 'UNAUTHENTICATED');
  }

  const cleanOrgId = (targetOrgId || '').trim();
  if (!cleanOrgId) {
    throw new OrgContextError('Invalid organization identifier provided', 'INVALID_ORG_ID');
  }

  const d1 = dbClient ?? (await getD1());
  const validation = await validateOrgMembership(userId, cleanOrgId, d1);

  if (!validation.isMember || !validation.org) {
    // Security violation: user attempting to assert an organization they do not belong to
    logger.warn('[security] unauthorized_org_context_assertion', {
      userId,
      targetOrgId: cleanOrgId,
      reason: 'not_a_member_or_inactive',
      timestamp: new Date().toISOString(),
    });

    logAuditEvent({
      action: 'UNAUTHORIZED_ORG_CONTEXT_ASSERTION',
      userId,
      metadata: { targetOrgId: cleanOrgId, timestamp: Date.now() },
    }).catch(() => {});

    throw new OrgContextError(
      `User '${userId}' is not an active member of organization '${cleanOrgId}'`,
      'MEMBERSHIP_NOT_FOUND',
      cleanOrgId,
      userId
    );
  }

  const context: ActiveOrgContext = {
    orgId: cleanOrgId,
    orgName: validation.org.name,
    slug: validation.org.slug,
    role: validation.role || 'viewer',
    tier: validation.org.tier || 'free',
    userId,
  };

  logger.info('[OrgContext] Active organization switched successfully', {
    userId,
    orgId: cleanOrgId,
    role: context.role,
  });

  return context;
}

/**
 * Retrieves the currently active organization context for the authenticated caller.
 * Order of precedence:
 * 1. Request header (x-active-org-id or x-org-id)
 * 2. Request cookie (active_org_id)
 * 3. Default fallback: user's earliest joined active organization
 */
export async function getActiveOrgContext(options?: {
  reqHeaders?: Headers | null;
  activeCookie?: string | null;
  explicitUserId?: string | null;
  dbClient?: D1Database | null;
}): Promise<ActiveOrgContext | null> {
  const d1 = options?.dbClient ?? (await getD1());
  let userId = options?.explicitUserId;

  if (!userId) {
    const user = await getCurrentUser();
    if (!user) return null;
    userId = user.id;
  }

  // 1. Check candidate from header
  let candidateOrgId = options?.reqHeaders?.get(ACTIVE_ORG_HEADER) || options?.reqHeaders?.get(FALLBACK_ORG_HEADER);

  // 2. Check candidate from cookie
  if (!candidateOrgId && options?.activeCookie) {
    candidateOrgId = options.activeCookie;
  }

  if (!candidateOrgId) {
    try {
      const { cookies } = await import('next/headers');
      const store = await cookies();
      candidateOrgId = store.get(ACTIVE_ORG_COOKIE)?.value;
    } catch {
      // In environments where next/headers is not available
    }
  }

  // If candidate orgId is asserted, validate that user actually belongs to it
  if (candidateOrgId && candidateOrgId.trim() !== '') {
    const val = await validateOrgMembership(userId, candidateOrgId.trim(), d1);
    if (val.isMember && val.org) {
      return {
        orgId: candidateOrgId.trim(),
        orgName: val.org.name,
        slug: val.org.slug,
        role: val.role || 'viewer',
        tier: val.org.tier || 'free',
        userId,
      };
    }
    // Candidate was stale or unauthorized; ignore and fall back to primary
    logger.warn('[OrgContext] Stale or invalid active_org_id candidate ignored', {
      userId,
      candidateOrgId,
    });
  }

  // 3. Fallback: select user's primary/earliest joined active organization
  if (!d1) return null;

  try {
    const primaryRow = await d1
      .prepare(
        `SELECT m.org_id, m.role, o.name, o.slug, o.tier, o.status
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND o.status = 'active'
         ORDER BY m.created_at ASC
         LIMIT 1`
      )
      .bind(userId)
      .first<{
        org_id: string;
        role: string;
        name: string;
        slug: string;
        tier: string;
      }>();

    if (primaryRow) {
      return {
        orgId: primaryRow.org_id,
        orgName: primaryRow.name,
        slug: primaryRow.slug,
        role: primaryRow.role as OrgRole,
        tier: primaryRow.tier,
        userId,
      };
    }
  } catch {
    // Try legacy fallback
  }

  try {
    const legacyRow = await d1
      .prepare(
        `SELECT m.org_id, m.role, o.name, o.slug, o.tier
         FROM org_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1
         ORDER BY m.created_at ASC
         LIMIT 1`
      )
      .bind(userId)
      .first<{
        org_id: string;
        role: string;
        name: string;
        slug: string;
        tier: string;
      }>();

    if (legacyRow) {
      return {
        orgId: legacyRow.org_id,
        orgName: legacyRow.name,
        slug: legacyRow.slug,
        role: (legacyRow.role || 'member') as OrgRole,
        tier: legacyRow.tier || 'free',
        userId,
      };
    }
  } catch {
    // No orgs found
  }

  return null;
}

/**
 * Lists all organizations for the given user, annotated with active status.
 */
export async function listUserOrganizations(
  userId: string,
  activeOrgId?: string | null,
  dbClient?: D1Database | null
): Promise<UserOrgMembership[]> {
  if (!userId) return [];
  const d1 = dbClient ?? (await getD1());
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare(
        `SELECT
           m.org_id,
           m.role,
           m.created_at as joined_at,
           o.name,
           o.slug,
           o.tier,
           o.max_seats
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND o.status = 'active'
         ORDER BY m.created_at ASC`
      )
      .bind(userId)
      .all<{
        org_id: string;
        role: string;
        joined_at: number;
        name: string;
        slug: string;
        tier: string;
        max_seats: number;
      }>();

    if (results && results.length > 0) {
      return results.map((r) => ({
        orgId: r.org_id,
        orgName: r.name,
        slug: r.slug,
        role: r.role as OrgRole,
        tier: r.tier || 'free',
        maxSeats: r.max_seats ?? 1,
        isOwner: r.role === 'owner',
        isActiveContext: r.org_id === activeOrgId,
        joinedAt: r.joined_at,
      }));
    }
  } catch {
    // Fallback to legacy schema
  }

  try {
    const { results: legacyResults } = await d1
      .prepare(
        `SELECT
           m.org_id,
           m.role,
           o.name,
           o.slug,
           o.tier
         FROM org_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1
         ORDER BY m.created_at ASC`
      )
      .bind(userId)
      .all<{
        org_id: string;
        role: string;
        name: string;
        slug: string;
        tier: string;
      }>();

    return (legacyResults || []).map((r) => ({
      orgId: r.org_id,
      orgName: r.name,
      slug: r.slug,
      role: (r.role || 'member') as OrgRole,
      tier: r.tier || 'free',
      maxSeats: 1,
      isOwner: r.role === 'owner',
      isActiveContext: r.org_id === activeOrgId,
      joinedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}
```

---

### 4.2 Production Implementation: `src/forest/tenant/isolation-guard.ts`

```typescript
/**
 * Strict Tenant Data Isolation Guard
 *
 * Enforces zero cross-tenant data leakage across all queries, mutations, and route handlers.
 * Verifies that the caller's active organization context matches the target resource organization.
 * Throws CROSS_TENANT_VIOLATION with audit logging on any mismatch or invalid identifier.
 *
 * Layer: forest/tenant
 */

import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';

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

/**
 * Synchronous tenant scope guard.
 *
 * Asserts that currentOrgId matches targetResourceOrgId.
 * Rejects empty strings, undefined, null, or mismatched IDs.
 *
 * @throws {CrossTenantViolationError} with code 'CROSS_TENANT_VIOLATION' on mismatch or invalid input.
 */
export function assertTenantScope(
  currentOrgId: string | null | undefined,
  targetResourceOrgId: string | null | undefined
): void {
  const cleanCurrent = (currentOrgId || '').trim();
  const cleanResource = (targetResourceOrgId || '').trim();

  if (!cleanCurrent || !cleanResource || cleanCurrent !== cleanResource) {
    logger.error('[security] cross_tenant_violation', {
      currentOrgId: cleanCurrent || '<EMPTY>',
      resourceOrgId: cleanResource || '<EMPTY>',
      reason: !cleanCurrent || !cleanResource ? 'missing_org_id' : 'org_mismatch',
      timestamp: new Date().toISOString(),
    });

    // Fire non-blocking security audit event
    logAuditEvent({
      action: 'CROSS_TENANT_VIOLATION',
      userId: cleanCurrent || 'unknown',
      metadata: {
        currentOrgId: cleanCurrent,
        resourceOrgId: cleanResource,
        timestamp: Date.now(),
      },
    }).catch(() => {});

    throw new CrossTenantViolationError(cleanCurrent, cleanResource);
  }
}

/**
 * Asserts that a target resource belongs to the current tenant scope.
 */
export function assertResourceScope<T extends { org_id?: string | null; orgId?: string | null }>(
  currentOrgId: string,
  resource: T | null | undefined,
  resourceType: string = 'Resource'
): asserts resource is T {
  if (!resource) {
    throw new CrossTenantViolationError(currentOrgId, '<NULL_RESOURCE>');
  }

  const resourceOrgId = resource.org_id ?? resource.orgId;
  assertTenantScope(currentOrgId, resourceOrgId);
}

/**
 * Executes a callback within verified tenant isolation boundaries.
 */
export async function withTenantIsolation<T>(
  currentOrgId: string,
  resourceOrgId: string,
  fn: () => T | Promise<T>
): Promise<T> {
  assertTenantScope(currentOrgId, resourceOrgId);
  return await fn();
}

/**
 * Sanitizes an array of records to ensure 0 cross-tenant data leakage in lists.
 */
export function filterByTenant<T extends { org_id?: string | null; orgId?: string | null }>(
  items: T[],
  currentOrgId: string
): T[] {
  const cleanOrg = (currentOrgId || '').trim();
  if (!cleanOrg) return [];
  return items.filter((item) => (item.org_id ?? item.orgId) === cleanOrg);
}
```

---

### 4.3 Production Implementation: `src/app/actions/org-context.ts`

```typescript
/**
 * Server Actions for Organization Context Switching
 *
 * Allows users to switch active organization context and lists accessible organizations.
 *
 * Layer: app/actions
 */

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  switchActiveOrg,
  listUserOrganizations,
  getActiveOrgContext,
  ACTIVE_ORG_COOKIE,
  type ActiveOrgContext,
  type UserOrgMembership,
} from '@/forest/tenant/context-switcher';
import { success, failure, type Result } from '@/seed/types/result';

export async function switchOrgAction(
  targetOrgId: string
): Promise<Result<ActiveOrgContext, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const context = await switchActiveOrg(user.id, targetOrgId);

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, context.orgId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    revalidatePath('/dashboard', 'layout');
    return success(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Context switch failed';
    return failure({ code: 'SWITCH_FAILED', message });
  }
}

export async function getUserOrgsAction(): Promise<
  Result<{ organizations: UserOrgMembership[]; activeOrgId: string | null }, { code: string; message: string }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const currentContext = await getActiveOrgContext({ explicitUserId: user.id });
    const organizations = await listUserOrganizations(user.id, currentContext?.orgId);

    return success({
      organizations,
      activeOrgId: currentContext?.orgId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve organizations';
    return failure({ code: 'LOOKUP_FAILED', message });
  }
}
```

---

## 5. Verification Method

To independently verify the implementation:

1. **E2E RBAC Test Suite:**
   Run:
   ```bash
   cd apps/sophia-ai-factory
   npx vitest run src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts
   ```
   **Expected Result:** All tests in `F6: Org Context Switching & Tenant Data Isolation Guard` (`F6-1` through `F6-5`) and boundary test `B5` pass with 100% green status.

2. **Layer Architecture Enforcement:**
   Run:
   ```bash
   cd apps/sophia-ai-factory
   bash scripts/check-layer-boundaries.sh
   ```
   **Expected Result:** Zero layer boundary violations (`seed`, `tree`, `forest`, `land` clean).

3. **TypeScript Zero-Error Gate:**
   Run:
   ```bash
   cd apps/sophia-ai-factory
   npm run type-check
   ```
   **Expected Result:** Clean compile with 0 TypeScript errors.

4. **Invalidation Conditions:**
   - If `assertTenantScope('', 'org_a')` does not throw an error matching `/CROSS_TENANT_VIOLATION/`, the guard has failed closed.
   - If an unauthorized user is able to obtain an `active_org_id` cookie for an organization where they have no row in `organization_members`, the context switcher has failed.
