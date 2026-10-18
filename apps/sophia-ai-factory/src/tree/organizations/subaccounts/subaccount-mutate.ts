/**
 * Subaccount Mutation & Lifecycle Operations
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/organizations/subaccounts/subaccount-mutate
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClientSubaccount,
  CreateSubaccountInput,
} from '@/seed/types/agency-multitenancy';
import { slugify } from './types';
import { getSubaccountById } from './subaccount-read';

export { updateSubaccount, archiveSubaccount } from './subaccount-update-ops';

/**
 * Creates a new client subaccount within an agency organization.
 */
export async function createSubaccount(
  db: D1Database,
  input: CreateSubaccountInput
): Promise<ClientSubaccount> {
  const agencyOrgId = input.agencyOrgId?.trim();
  const name = input.name?.trim();

  if (!agencyOrgId) {
    throw new Error('VALIDATION_ERROR: agencyOrgId is required');
  }
  if (!name) {
    throw new Error('VALIDATION_ERROR: Subaccount name is required');
  }

  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();

  const existing = await db
    .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ? AND slug = ?')
    .bind(agencyOrgId, slug)
    .first<{ id: string }>();

  if (existing) {
    throw new Error(`SUBACCOUNT_SLUG_CONFLICT: Subaccount slug '${slug}' already exists for this agency`);
  }

  const id = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const customDomain = input.customDomain?.trim() ? input.customDomain.trim().toLowerCase() : null;

  await db
    .prepare(`
      INSERT INTO client_subaccounts (id, agency_org_id, name, slug, custom_domain, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(id, agencyOrgId, name, slug, customDomain, now, now)
    .run();

  if (input.branding) {
    await db
      .prepare(`
        INSERT INTO subaccount_branding (subaccount_id, logo_url, primary_color, accent_color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        input.branding.logoUrl ?? null,
        input.branding.primaryColor ?? '#0f172a',
        input.branding.accentColor ?? '#10b981',
        now,
        now
      )
      .run();
  }

  if (typeof input.initialMcu === 'number' && input.initialMcu >= 0) {
    const allocId = `mcu_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db
      .prepare(`
        INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `)
      .bind(allocId, id, input.initialMcu, now, now)
      .run();
  }

  const created = await getSubaccountById(db, id);
  if (!created) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve newly created subaccount');
  }
  return created;
}
