'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  getVideoAnalytics,
  getTopVideos,
  getAnalyticsSummary,
  type DateRange,
} from '@/seed/db/repositories/video-analytics-repo';
import { inngest } from '@/forest/inngest/client';

function resolveRange(dateRange?: { start: string; end: string }): DateRange {
  if (dateRange) return dateRange;
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getVideoAnalyticsAction(
  videoId: string,
  dateRange?: { start: string; end: string },
): Promise<ActionResult<Awaited<ReturnType<typeof getVideoAnalytics>>>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tier = await getUserTier(user.id);
  if (tier === 'BASIC') return { success: false, error: 'Analytics requires Premium tier' };

  try {
    const data = await getVideoAnalytics(user.id, videoId, undefined, resolveRange(dateRange));
    return { success: true, data };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getAnalyticsDashboardAction(
  dateRange?: { start: string; end: string },
): Promise<
  ActionResult<{
    topVideos: Awaited<ReturnType<typeof getTopVideos>>;
    summary: Awaited<ReturnType<typeof getAnalyticsSummary>>;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tier = await getUserTier(user.id);
  if (tier === 'BASIC') return { success: false, error: 'Analytics requires Premium tier' };

  try {
    const range = resolveRange(dateRange);
    const [topVideos, summary] = await Promise.all([
      getTopVideos(user.id, 'views', 10, range),
      getAnalyticsSummary(user.id, range),
    ]);
    return { success: true, data: { topVideos, summary } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function triggerAnalyticsSyncAction(): Promise<ActionResult<{ triggered: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    await inngest.send({
      name: 'analytics/sync.requested',
      data: { userId: user.id, requestedAt: Date.now() },
    });
    return { success: true, data: { triggered: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
