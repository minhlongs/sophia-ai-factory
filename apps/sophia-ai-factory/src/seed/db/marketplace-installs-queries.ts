/**
 * SOP Creator Marketplace — SOP install query operations.
 *
 * @module seed/db/marketplace-installs-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { SopInstall } from './marketplace-types';

/**
 * Get an SOP install by its license ID.
 * Returns the install or null if not found.
 */
export async function getSopInstall(
  db: D1Database,
  licenseId: string,
): Promise<SopInstall | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM sop_installs WHERE license_id = ?')
      .bind(licenseId)
      .first<SopInstall>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * List all SOP installs for a given user.
 * Returns an empty array if the user has no installs.
 */
export async function listUserInstalls(
  db: D1Database,
  userId: string,
  tenantId?: string,
): Promise<SopInstall[]> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const result = await db
      .prepare(
        'SELECT * FROM sop_installs WHERE user_id = ? AND tenant_id = ? ORDER BY installed_at DESC',
      )
      .bind(userId, resolvedTenantId)
      .all<SopInstall>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}
