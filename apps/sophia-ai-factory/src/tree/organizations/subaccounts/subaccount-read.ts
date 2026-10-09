/**
 * Subaccount Read & Query Operations
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/organizations/subaccounts/subaccount-read
 */

import type { D1Database } from '@/seed/db/client';
import type { ClientSubaccount } from '@/seed/types/agency-multitenancy';
import { mapRowToSubaccount, BASE_SELECT, type SubaccountRow } from './types';

/**
 * Retrieves a client subaccount by its ID with full branding and MCU quota.
 */
export async function getSubaccountById(
  db: D1Database,
  subaccountId: string
): Promise<ClientSubaccount | null> {
  const row = await db
    .prepare(`${BASE_SELECT} WHERE cs.id = ?`)
    .bind(subaccountId)
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}

/**
 * Retrieves a client subaccount by slug within an agency organization.
 */
export async function getSubaccountBySlug(
  db: D1Database,
  agencyOrgId: string,
  slug: string
): Promise<ClientSubaccount | null> {
  const row = await db
    .prepare(`${BASE_SELECT} WHERE cs.agency_org_id = ? AND cs.slug = ?`)
    .bind(agencyOrgId, slug.toLowerCase())
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}

/**
 * Lists all client subaccounts belonging to an agency organization.
 */
export async function listSubaccountsByOrg(
  db: D1Database,
  agencyOrgId: string
): Promise<ClientSubaccount[]> {
  const { results } = await db
    .prepare(`${BASE_SELECT} WHERE cs.agency_org_id = ? ORDER BY cs.created_at DESC`)
    .bind(agencyOrgId)
    .all<SubaccountRow>();

  return (results || []).map(mapRowToSubaccount);
}

/**
 * Resolves a client subaccount by custom domain hostname.
 */
export async function getSubaccountByCustomDomain(
  db: D1Database,
  hostname: string
): Promise<ClientSubaccount | null> {
  const normalized = hostname.trim().toLowerCase();
  const row = await db
    .prepare(`${BASE_SELECT} WHERE LOWER(cs.custom_domain) = ? AND cs.status = 'active'`)
    .bind(normalized)
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}
