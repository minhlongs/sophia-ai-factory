/**
 * Fallback Organization Context Queries for Multi-Tenant Context Switcher
 * @module forest/tenant/context/context-switcher-queries
 */

import type { D1Database } from '@/seed/db/client';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type { ActiveOrgContext } from './types';

export async function queryDefaultUserOrgContext(
  d1: D1Database,
  userId: string,
): Promise<ActiveOrgContext | null> {
  try {
    const primaryRow = await d1
      .prepare(
        `SELECT m.org_id, m.role, o.name, o.slug, o.tier, o.status
         FROM organization_members m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ?1 AND o.status = 'active'
         ORDER BY m.created_at ASC
         LIMIT 1`,
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
         LIMIT 1`,
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
