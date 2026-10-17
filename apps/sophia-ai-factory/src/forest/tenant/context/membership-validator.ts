/**
 * Membership Validator
 *
 * Layer: forest/tenant/context
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { OrgRole } from '@/seed/types/rbac-matrix';

export { listUserOrganizations } from './org-membership-list';

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
    const memberRow = await d1
      .prepare(
        `SELECT m.role, o.name, o.slug, o.tier, o.status, o.max_seats
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND m.org_id = ?2
         LIMIT 1`,
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
      return {
        isMember: true,
        role: (memberRow.role || 'member') as OrgRole,
        org: {
          name: memberRow.name,
          slug: memberRow.slug,
          tier: memberRow.tier || 'free',
          status: memberRow.status || 'active',
          maxSeats: memberRow.max_seats ?? 5,
        },
      };
    }
  } catch {
    // Fallback to legacy schema
  }

  try {
    const legacyRow = await d1
      .prepare(
        `SELECT m.role, o.name, o.slug, o.tier
         FROM org_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND m.org_id = ?2
         LIMIT 1`,
      )
      .bind(userId, targetOrgId)
      .first<{ role: string; name: string; slug: string; tier: string }>();

    if (legacyRow) {
      return {
        isMember: true,
        role: (legacyRow.role || 'member') as OrgRole,
        org: {
          name: legacyRow.name,
          slug: legacyRow.slug,
          tier: legacyRow.tier || 'free',
          status: 'active',
          maxSeats: 1,
        },
      };
    }
  } catch {
    // Both failed
  }

  return { isMember: false, role: null, org: null };
}
