/**
 * Creative Identity D1 Read Queries
 * Layer: tree/creative-identity/types
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeIdentity } from '@/seed/types/creative-domain';
import {
  CreativeIdentityError,
  type CreativeIdentityRow,
  rowToDomain,
} from './models';

/**
 * Get the active CreativeIdentity for a workspace.
 */
export async function getActiveIdentity(workspaceId: string): Promise<CreativeIdentity | null> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(
      `SELECT * FROM creative_identities WHERE workspace_id = ?1 AND is_active = 1 ORDER BY version DESC LIMIT 1`,
    )
    .bind(workspaceId)
    .first<CreativeIdentityRow>();

  if (!row) return null;
  return rowToDomain(row);
}

/**
 * Get a specific identity by id.
 */
export async function getIdentity(id: string): Promise<CreativeIdentity | null> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM creative_identities WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<CreativeIdentityRow>();

  if (!row) return null;
  return rowToDomain(row);
}

/**
 * List all versions for a workspace.
 */
export async function listIdentityVersions(workspaceId: string): Promise<CreativeIdentity[]> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM creative_identities WHERE workspace_id = ?1 ORDER BY version DESC`)
    .bind(workspaceId)
    .all<CreativeIdentityRow>();

  return (result.results ?? []).map(rowToDomain);
}
