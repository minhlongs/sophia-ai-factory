'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { claimChallengeReward } from '@/land/sop-marketplace/challenges';
import { revalidatePath } from 'next/cache';

export async function claimChallengeRewardAction(formData: FormData): Promise<void> {
  const challengeId = String(formData.get('challengeId') ?? '');

  const user = await getCurrentUser();
  if (!user?.id || !challengeId) {
    return;
  }

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const challenge = await db
    .prepare(`SELECT id, reward_type, reward_value FROM sop_challenges WHERE id = ?1`)
    .bind(challengeId)
    .first<{ id: string; reward_type: string; reward_value: string }>();

  if (!challenge) {
    return;
  }

  const result = await claimChallengeReward(
    db,
    user.id,
    challengeId,
    challenge.reward_type,
    challenge.reward_value,
  );

  if (result.ok) {
    revalidatePath('/dashboard/challenges');
  }
}
