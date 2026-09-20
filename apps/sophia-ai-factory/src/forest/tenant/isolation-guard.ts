/**
 * Strict Tenant Data Isolation Guard
 *
 * Enforces zero cross-tenant data leakage across all operations.
 * Verifies that caller's active organization context matches the target resource organization.
 * Throws CrossTenantViolationError (matching /CROSS_TENANT_VIOLATION/) on mismatch or invalid input.
 *
 * Layer: forest/tenant
 *
 * @module forest/tenant/isolation-guard
 */

import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';

export class CrossTenantViolationError extends Error {
  readonly code = 'CROSS_TENANT_VIOLATION' as const;
  readonly status = 403;
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
 * Synchronous tenant scope assertion.
 *
 * Validates that currentOrgId matches targetResourceOrgId.
 * Rejects empty strings, undefined, null, or mismatched IDs.
 *
 * @throws {CrossTenantViolationError} with code 'CROSS_TENANT_VIOLATION' on mismatch or invalid input.
 */
export function assertTenantScope(
  currentOrgId: string | null | undefined,
  targetResourceOrgId: string | null | undefined,
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
): asserts resource is T {
  if (!resource) {
    throw new CrossTenantViolationError(currentOrgId, '<NULL_RESOURCE>');
  }

  const resourceOrgId = resource.org_id ?? resource.orgId;
  assertTenantScope(currentOrgId, resourceOrgId);
}

/**
 * Executes an operation within verified tenant isolation boundaries.
 */
export async function withTenantIsolation<T>(
  currentOrgId: string,
  resourceOrgId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  assertTenantScope(currentOrgId, resourceOrgId);
  return await fn();
}

/**
 * Filters an array of tenant-scoped items to ensure only currentOrgId items are included.
 */
export function filterByTenant<T extends { org_id?: string | null; orgId?: string | null }>(
  items: T[],
  currentOrgId: string,
): T[] {
  const cleanOrg = (currentOrgId || '').trim();
  if (!cleanOrg) return [];
  return items.filter((item) => (item.org_id ?? item.orgId) === cleanOrg);
}
