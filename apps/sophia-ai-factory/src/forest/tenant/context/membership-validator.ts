/**
 * Membership Validator
 *
 * Layer: forest/tenant/context
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type { UserOrgMembership } from './types';

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
           m.org_id, m.role, m.created_at,
           o.name, o.slug, o.tier, o.max_seats
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1
         ORDER BY m.created_at ASC`,
      )
      .bind(userId)
      .all<{
        org_id: string;
        role: string;
        created_at: number;
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
        role: (r.role || 'member') as OrgRole,
        tier: r.tier || 'free',
        maxSeats: r.max_seats ?? 5,
        isOwner: r.role === 'owner',
        isActiveContext: r.org_id === activeOrgId,
        joinedAt: r.created_at,
      }));
    }
  } catch {
    // Fallback to legacy schema
  }

  try {
    const { results: legacyResults } = await d1
      .prepare(
        `SELECT m.org_id, m.role, o.name, o.slug, o.tier
         FROM org_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1
         ORDER BY m.created_at ASC`,
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
