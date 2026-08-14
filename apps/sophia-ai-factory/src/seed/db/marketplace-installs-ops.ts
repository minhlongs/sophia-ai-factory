/**
 * SOP Creator Marketplace — SOP install database operations.
 *
 * Pure data access layer for SOP installs. All functions accept
 * a D1Database binding explicitly rather than self-resolving,
 * enabling testability.
 *
 * @module seed/db/marketplace-installs-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateSopInstallInput, SopInstall } from './marketplace-types';

// ── SOP Install Operations ─────────────────────────────────────────────────

/**
 * Create a new SOP install for a user.
 * Checks the user's tier SOP install limit before allowing the install.
 * Throws if the user has reached their install limit.
 * Returns the created install, or throws on failure.
 */
export async function createSopInstall(
  db: D1Database,
  input: CreateSopInstallInput,
  tenantId?: string,
): Promise<SopInstall> {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  try {
    // Check the user's tier and SOP install limit
    // Lazy-import to avoid circular dependency: getUserTier reads subscriptions table
    const { getUserTier } = await import('@/seed/db/get-user-tier');
    const { getSopInstallLimit } = await import('@/seed/config/tiers');

    const tier = await getUserTier(input.user_id);
    const limit = getSopInstallLimit(tier);

    // Count current active installs for this user
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM sop_installs
         WHERE user_id = ? AND status = 'active'`,
      )
      .bind(input.user_id)
      .first<{ count: number }>();

    const activeCount = countResult?.count ?? 0;

    if (activeCount >= limit) {
      throw new Error(
        `SOP install limit reached: ${activeCount}/${limit} active installs for tier ${tier}`,
      );
    }

    const install: SopInstall = {
      id,
      listing_id: input.listing_id,
      user_id: input.user_id,
      license_id: input.license_id,
      price_cents: input.price_cents,
      commission_id: input.commission_id ?? null,
      status: 'active',
      installed_at: now,
      uninstalled_at: null,
    };

    const result = await db
      .prepare(
        `INSERT INTO sop_installs
         (id, listing_id, user_id, license_id, price_cents,
          commission_id, status, installed_at, uninstalled_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        install.id, install.listing_id, install.user_id, install.license_id,
        install.price_cents, install.commission_id, install.status,
        install.installed_at, install.uninstalled_at, resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP install');
    }

    // Increment install_count on the listing
    await db
      .prepare(
        'UPDATE sop_listings SET install_count = install_count + 1 WHERE id = ?',
      )
      .bind(input.listing_id)
      .run();

    return install;
  } catch (error) {
    throw toError(error);
  }
}

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
