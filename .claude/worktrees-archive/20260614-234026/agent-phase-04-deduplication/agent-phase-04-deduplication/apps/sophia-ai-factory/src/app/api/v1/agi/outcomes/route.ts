/**
 * GET /api/v1/agi/outcomes — Outcome metrics, top SOPs, recent outcomes for the user.
 * Auth: Better Auth session.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getRecentOutcomes,
  getTopSopsByRevenue,
  getCreatorOutcomeSummary,
} from '@/seed/db/repositories/outcome-tracking-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
  try {
    user = await getCurrentUser();
  } catch { /* unauth */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [recentOutcomes, topSops, sopSummaries] = await Promise.all([
      getRecentOutcomes(user.id, 20),
      getTopSopsByRevenue(user.id, 5),
      getCreatorOutcomeSummary(user.id, { limit: 10 }),
    ]);
    return NextResponse.json({ recentOutcomes, topSops, sopSummaries });
  } catch (err) {
    logger.error('[API] GET /agi/outcomes failed', { error: getErrorMessage(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
