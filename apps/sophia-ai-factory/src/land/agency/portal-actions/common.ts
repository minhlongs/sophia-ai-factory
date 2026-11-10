/**
 * Common Types and Helpers for Agency Portal Server Actions
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/common
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { getD1Sync } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AgencyPortalAuthResult {
  authorized: boolean;
  userId?: string;
  isPlatformAdmin?: boolean;
  error?: 'UNAUTHORIZED' | 'FORBIDDEN' | 'FEATURE_LOCKED';
}

/**
 * Resolves active D1 database binding; honors dbOverride strictly in test environments.
 */
export function resolveDb(dbOverride?: unknown): D1Database {
  const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  if (isTestEnv && dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    return dbOverride as D1Database;
  }
  return getD1Sync();
}

/**
 * Authenticates the caller and enforces white_label_agency_portal commercial entitlement.
 */
export async function authenticateAgencyPortalUser(options?: {
  requireCustomDomain?: boolean;
}): Promise<AgencyPortalAuthResult> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return { authorized: false, error: 'UNAUTHORIZED' };
  }

  const isPlatformAdmin = user.role === 'admin' || (await isUserAdmin(user));
  const tierOpts = isPlatformAdmin ? ({ resolvedTier: 'ENTERPRISE' } as const) : undefined;

  const portalGate = await enforceCommercialFeatureForUser(
    user.id,
    'white_label_agency_portal',
    tierOpts,
  );
  if (!portalGate.ok) {
    return { authorized: false, error: 'FEATURE_LOCKED' };
  }

  if (options?.requireCustomDomain) {
    const domainGate = await enforceCommercialFeatureForUser(
      user.id,
      'custom_domain_provisioning',
      tierOpts,
    );
    if (!domainGate.ok) {
      return { authorized: false, error: 'FEATURE_LOCKED' };
    }
  }

  return { authorized: true, userId: user.id, isPlatformAdmin };
}

/**
 * Verifies the authenticated user is a platform admin or an authorized member of agencyOrgId.
 */
export async function verifyAgencyOrgMembership(
  db: D1Database,
  agencyOrgId: string,
  userId: string,
  isPlatformAdmin: boolean,
  allowMemberRead = false,
): Promise<boolean> {
  if (isPlatformAdmin) return true;
  try {
    const member = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(agencyOrgId, userId)
      .first<{ role: string }>();
    const allowedRoles = allowMemberRead ? ['owner', 'admin', 'member'] : ['owner', 'admin'];
    return Boolean(member && allowedRoles.includes(member.role));
  } catch {
    return false;
  }
}

/**
 * Authenticates the caller, resolves D1, and verifies agencyOrgId membership in one step.
 */
export async function authorizeAgencyOrgAction(
  agencyOrgId: string,
  dbOverride?: unknown,
  options?: { requireCustomDomain?: boolean; allowMemberRead?: boolean },
): Promise<
  | { ok: true; db: D1Database; userId: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'FEATURE_LOCKED' }
> {
  const auth = await authenticateAgencyPortalUser(options);
  if (!auth.authorized || !auth.userId) {
    return { ok: false, error: auth.error ?? 'UNAUTHORIZED' };
  }
  const db = resolveDb(dbOverride);
  const isMember = await verifyAgencyOrgMembership(
    db,
    agencyOrgId,
    auth.userId,
    Boolean(auth.isPlatformAdmin),
    options?.allowMemberRead ?? false,
  );
  if (!isMember) {
    return { ok: false, error: 'FORBIDDEN' };
  }
  return { ok: true, db, userId: auth.userId };
}
