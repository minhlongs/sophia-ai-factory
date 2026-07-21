'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { hasCreatorAccess } from '@/land/sop-marketplace';

export async function checkCreatorAccess(): Promise<{
  hasAccess: boolean;
  userId: string | null;
  tier: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { hasAccess: false, userId: null, tier: null };
  }

  const d1 = getD1();
  if (!d1) {
    return { hasAccess: false, userId: user.id, tier: null };
  }

  // Check MASTER tier first
  const { getUserTier } = await import('@/seed/db/get-user-tier');
  const tier = await getUserTier(user.id);

  if (tier === 'MASTER') {
    return { hasAccess: true, userId: user.id, tier };
  }

  // Check beta invite approval
  const hasAccess = await hasCreatorAccess(d1, user.id);
  return { hasAccess, userId: user.id, tier };
}