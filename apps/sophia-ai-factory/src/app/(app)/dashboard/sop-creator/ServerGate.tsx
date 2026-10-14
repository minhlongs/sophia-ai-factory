'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { CREATOR_MARKETPLACE_V2_ENABLED } from '@/land/sop-marketplace/availability';

export async function checkCreatorAccess(): Promise<{
  hasAccess: boolean;
  userId: string | null;
  tier: string | null;
  marketplaceAvailable: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { hasAccess: false, userId: null, tier: null, marketplaceAvailable: false };
  }

  if (!CREATOR_MARKETPLACE_V2_ENABLED) {
    return { hasAccess: false, userId: user.id, tier: null, marketplaceAvailable: false };
  }

  const d1 = await getD1();
  if (!d1) {
    return { hasAccess: false, userId: user.id, tier: null, marketplaceAvailable: true };
  }

  // Check MASTER tier first
  const { resolveUserTier } = await import('@/seed/db/resolve-user-tier');
  const tier = await resolveUserTier(user.id);

  if (tier === 'MASTER') {
    return { hasAccess: true, userId: user.id, tier, marketplaceAvailable: true };
  }

  // Check beta invite approval
  const hasAccess = await hasCreatorAccess(d1, user.id);
  return { hasAccess, userId: user.id, tier, marketplaceAvailable: true };
}
