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
  UpdateSubaccountInput,
} from '@/seed/types/agency-multitenancy';
import { slugify } from './types';
import { getSubaccountById } from './subaccount-read';

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

/**
 * Updates an existing subaccount's details (name, slug, custom domain, status).
 */
export async function updateSubaccount(
  db: D1Database,
  subaccountId: string,
  input: UpdateSubaccountInput
): Promise<ClientSubaccount> {
  const existing = await getSubaccountById(db, subaccountId);
  if (!existing) {
    throw new Error(`SUBACCOUNT_NOT_FOUND: Subaccount '${subaccountId}' does not exist`);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    bindings.push(input.name.trim());
  }
  if (input.slug !== undefined) {
    const nextSlug = input.slug.trim().toLowerCase();
    const conflict = await db
      .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ? AND slug = ? AND id != ?')
      .bind(existing.agencyOrgId, nextSlug, subaccountId)
      .first<{ id: string }>();

    if (conflict) {
      throw new Error(`SUBACCOUNT_SLUG_CONFLICT: Slug '${nextSlug}' is already taken`);
    }
    updates.push('slug = ?');
    bindings.push(nextSlug);
  }
  if (input.customDomain !== undefined) {
    updates.push('custom_domain = ?');
    bindings.push(input.customDomain ? input.customDomain.trim().toLowerCase() : null);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status.toLowerCase());
  }

  if (updates.length > 0) {
    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    bindings.push(now);
    bindings.push(subaccountId);

    await db
      .prepare(`UPDATE client_subaccounts SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  const updated = await getSubaccountById(db, subaccountId);
  if (!updated) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve updated subaccount');
  }
  return updated;
}

/**
 * Archives/suspends a client subaccount.
 */
export async function archiveSubaccount(
  db: D1Database,
  subaccountId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE client_subaccounts SET status = 'suspended', updated_at = ? WHERE id = ?")
    .bind(now, subaccountId)
    .run();
}
