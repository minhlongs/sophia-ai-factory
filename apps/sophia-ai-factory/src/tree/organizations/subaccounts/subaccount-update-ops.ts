/**
 * Subaccount Update & Archive Operations
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed and sibling tree modules)
 *
 * @module tree/organizations/subaccounts/subaccount-update-ops
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClientSubaccount,
  UpdateSubaccountInput,
} from '@/seed/types/agency-multitenancy';
import { getSubaccountById } from './subaccount-read';

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
