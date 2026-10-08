/**
 * Server Actions for Video Analytics & Net ROI Attribution Cockpit
 * Layer: land (Server Actions) | LOC: < 200 | Zero :any
 * @module land/analytics/actions/analytics-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { toError } from '@/seed/utils/to-error';
import {
  analyticsQueryFilterSchema,
  type AnalyticsQueryFilter,
  type VideoAnalyticsSnapshot,
  type ChannelAggregateMetrics,
} from '@/seed/types/video-analytics-types';
import {
  listUserAnalyticsSnapshots,
  getUserAggregateMetrics,
} from '@/land/analytics/video-analytics-store';

export interface AnalyticsActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function getAnalyticsOverviewAction(): Promise<
  AnalyticsActionResponse<ChannelAggregateMetrics>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const metrics = await getUserAggregateMetrics(user.id);
    return { success: true, data: metrics };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function listAttributedVideosAction(
  rawFilter?: Partial<AnalyticsQueryFilter>,
): Promise<AnalyticsActionResponse<VideoAnalyticsSnapshot[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const parsed = analyticsQueryFilterSchema.safeParse(rawFilter ?? {});
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid filter', code: 'VALIDATION_ERROR' };
    }

    const list = await listUserAnalyticsSnapshots(user.id, parsed.data);
    return { success: true, data: list };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function triggerAnalyticsSyncAction(
  jobId: string,
): Promise<AnalyticsActionResponse<{ dispatched: boolean; jobId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    if (!jobId) return { success: false, error: 'Job ID required', code: 'VALIDATION_ERROR' };

    await inngest.send({
      name: 'social.analytics.sync_requested',
      data: { userId: user.id, jobId },
    });

    return { success: true, data: { dispatched: true, jobId } };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}
