/**
 * SOP Creator Marketplace — creator profile database operations.
 *
 * Pure data access layer for creator profiles. All functions accept
 * a D1Database binding explicitly rather than self-resolving,
 * enabling testability.
 *
 * @module seed/db/marketplace-profile-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateCreatorProfileInput, CreatorProfile } from './marketplace-types';
import { buildCreatorProfileRecord, buildProfileUpdateClause } from './marketplace-profile-helpers';

// ── Creator Profile Operations ─────────────────────────────────────────────

/**
 * Create a new creator profile for the given user.
 * Returns the generated profile ID, or throws on failure.
 */
export async function createCreatorProfile(
  db: D1Database,
  input: CreateCreatorProfileInput,
  tenantId?: string,
): Promise<CreatorProfile> {
  const resolvedTenantId = tenantId ?? 'default';
  const profile = buildCreatorProfileRecord(input);

  try {
    const result = await db
      .prepare(
        `INSERT INTO creator_profiles
         (id, user_id, display_name, bio, avatar_url, payout_method,
          payout_address, total_earnings_cents, total_paid_cents,
          status, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        profile.id, profile.user_id, profile.display_name, profile.bio,
        profile.avatar_url, profile.payout_method, profile.payout_address,
        profile.total_earnings_cents, profile.total_paid_cents,
        profile.status, profile.created_at, profile.updated_at,
        resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create creator profile');
    }

    return profile;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get a creator profile by user ID.
 * Returns the profile or null if not found.
 */
export async function getCreatorProfile(
  db: D1Database,
  userId: string,
  tenantId?: string,
): Promise<CreatorProfile | null> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const row = await db
      .prepare('SELECT * FROM creator_profiles WHERE user_id = ? AND tenant_id = ?')
      .bind(userId, resolvedTenantId)
      .first<CreatorProfile>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Update a creator profile by user ID.
 * Only the provided fields are updated.
 * Returns the updated profile, or null if not found.
 */
export async function updateCreatorProfile(
  db: D1Database,
  userId: string,
  input: Partial<CreateCreatorProfileInput>,
  tenantId?: string,
): Promise<CreatorProfile | null> {
  const { fields, values } = buildProfileUpdateClause(userId, input);

  try {
    await db
      .prepare(`UPDATE creator_profiles SET ${fields.join(', ')} WHERE user_id = ?`)
      .bind(...values)
      .run();

    return getCreatorProfile(db, userId, tenantId);
  } catch (error) {
    throw toError(error);
  }
}
