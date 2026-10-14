/**
 * Multi-Tenant Organization Context Switcher
 *
 * Layer: forest/tenant/context
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_ORG_HEADER,
  FALLBACK_ORG_HEADER,
  OrgContextError,
  type ActiveOrgContext,
} from './types';
import { validateOrgMembership } from './membership-validator';
import { queryDefaultUserOrgContext } from './context-switcher-queries';

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

  if (!validation.isMember || !validation.org || validation.org.status !== 'active') {
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

  let candidateOrgId =
    options?.reqHeaders?.get(ACTIVE_ORG_HEADER) || options?.reqHeaders?.get(FALLBACK_ORG_HEADER);

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
    logger.warn('[OrgContext] Stale or invalid active_org_id candidate ignored', {
      userId,
      candidateOrgId,
    });
  }

  if (!d1) return null;

  return queryDefaultUserOrgContext(d1, userId);
}
