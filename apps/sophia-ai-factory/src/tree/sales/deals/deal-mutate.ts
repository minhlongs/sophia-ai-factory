/**
 * Enterprise Deals Update and Deletion Operations
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-mutate
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  UpdateEnterpriseDealInput,
} from '@/seed/types/enterprise-deal';
import { getEnterpriseDealById } from './deal-read';
import { buildDealUpdateSql } from './deal-update-builder';

/**
 * Updates an enterprise deal.
 */
export async function updateEnterpriseDeal(
  db: D1Database,
  id: string,
  input: UpdateEnterpriseDealInput
): Promise<EnterpriseDeal> {
  const existing = await getEnterpriseDealById(db, id);
  if (!existing) {
    throw new Error(`Enterprise deal not found: ${id}`);
  }

  const { sql, bindings } = buildDealUpdateSql(id, input);
  await db.prepare(sql).bind(...bindings).run();

  const updated = await getEnterpriseDealById(db, id);
  if (!updated) {
    throw new Error(`Failed to retrieve updated enterprise deal '${id}'`);
  }
  return updated;
}

/**
 * Deletes an enterprise deal by ID.
 */
export async function deleteEnterpriseDeal(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM enterprise_deals WHERE id = ?')
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
