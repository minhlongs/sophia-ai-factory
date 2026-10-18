import { getD1 } from '@/seed/db/get-d1';
import {
  listMyListings,
  getCreatorEarnings,
  listActiveChallenges,
  getUserAllProgress,
} from '@/land/sop-marketplace';
import type { SopChallengeRow, UserChallengeProgressRow } from '@/seed/sop/sop-types';
import type { EarningsBreakdown } from './types';

export interface CreatorDashboardMetrics {
  totalInstalls: number;
  earningsBreakdown: EarningsBreakdown;
  challenges: SopChallengeRow[];
  userProgress: UserChallengeProgressRow[];
}

export async function loadCreatorDashboardMetrics(userId: string): Promise<CreatorDashboardMetrics> {
  const listingsResult = await listMyListings();
  const totalInstalls = listingsResult.ok
    ? listingsResult.value.reduce((sum, l) => sum + l.installCount, 0)
    : 0;

  const db = await getD1();
  let earningsBreakdown: EarningsBreakdown = { totalEarned: 0, pending: 0, payable: 0, paid: 0 };
  let challenges: SopChallengeRow[] = [];
  let userProgress: UserChallengeProgressRow[] = [];

  if (db) {
    try {
      const [earnings, activeChallenges, progress] = await Promise.all([
        getCreatorEarnings(db, userId),
        listActiveChallenges(db),
        getUserAllProgress(db, userId),
      ]);
      earningsBreakdown = earnings;
      challenges = activeChallenges;
      userProgress = progress;
    } catch {
      // Graceful fallback — chart shows zeros, challenges section shows empty
    }
  }

  return {
    totalInstalls,
    earningsBreakdown,
    challenges,
    userProgress,
  };
}
