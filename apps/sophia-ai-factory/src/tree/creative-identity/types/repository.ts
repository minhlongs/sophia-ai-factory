/**
 * Creative Identity D1 Persistence Repository
 * Layer: tree/creative-identity/types
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeIdentity } from '@/seed/types/creative-domain';
import {
  CreativeIdentityError,
  type CreativeIdentityRow,
  domainToRow,
  rowToDomain,
} from './models';
import {
  insertCreativeIdentityRow,
  updateCreativeIdentityRow,
} from './repository-sql-helpers';

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

/**
 * Create a new identity version.
 * Deactivates previous versions automatically.
 */
export async function createIdentity(identity: CreativeIdentity): Promise<CreativeIdentity> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  identity.createdAt = now;
  identity.updatedAt = now;
  identity.version = 1;

  const row = domainToRow(identity);

  try {
    await insertCreativeIdentityRow(db, row);
  } catch (err) {
    throw new CreativeIdentityError(
      'INSERT_FAILED',
      `Failed to create identity: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  return identity;
}

/**
 * Update an existing identity, bumping version and deactivating old versions.
 */
export async function updateIdentity(identity: CreativeIdentity): Promise<CreativeIdentity> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const existing = await getIdentity(identity.id);
  if (!existing) {
    throw new CreativeIdentityError('NOT_FOUND', `Identity ${identity.id} not found`);
  }

  identity.version = existing.version + 1;
  identity.updatedAt = now;

  const row = domainToRow(identity);

  // Deactivate old versions, then update current
  try {
    await updateCreativeIdentityRow(db, row);
  } catch (err) {
    throw new CreativeIdentityError(
      'UPDATE_FAILED',
      `Failed to update identity: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  return identity;
}

/**
 * Soft-delete (deactivate) an identity.
 */
export async function deactivateIdentity(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  await db.prepare(`UPDATE creative_identities SET is_active = 0 WHERE id = ?1`).bind(id).run();
}
