/**
 * Creator Access Gate
 *
 * Determines whether a user has access to the Creator Marketplace.
 * MASTER tier users always have access. Beta invite users with approved
 * invites also have access.
 */

import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { isBetaInviteApproved } from './beta-invites';

/**
 * Check whether a user has creator access.
 * Returns true if the user is MASTER tier OR has an approved beta invite.
 */
export async function hasCreatorAccess(db: D1Database, userId: string): Promise<boolean> {
  const tier = await resolveUserTier(userId);
  if (tier === 'MASTER') return true;

  return isBetaInviteApproved(db, userId);
}
