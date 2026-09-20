/**
 * Multi-Tenant Organization Context Switcher
 *
 * Manages active organization context for users belonging to multiple organizations.
 * Validates active membership before granting context and persists selection via
 * `active_org_id` cookie and headers.
 *
 * Layer: forest/tenant (Can import from @/seed and @/tree)
 *
 * @module forest/tenant/context-switcher
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
  dbClient?: D1Database | null,
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
  dbClient?: D1Database | null,
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
      userId,
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
  dbClient?: D1Database | null,
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
