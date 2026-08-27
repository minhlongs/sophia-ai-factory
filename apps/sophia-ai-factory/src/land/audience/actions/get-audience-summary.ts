/**
 * Server Action: Get audience summary (segments + latest platform metrics).
 *
 * Read-only. Auth via getCurrentUser(); workspace membership verified via
 * org_members (IDOR prevention). Empty state is a success — an error Result
 * is only returned for validation/auth/forbidden/internal failures.
 *
 * Timestamp discipline: audience_metrics windows are MILLISECONDS.
 *
 * @module land/audience/actions/get-audience-summary
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { listSegments } from '@/tree/audience/audience-segments';
import { getLatestMetrics } from '@/tree/audience/metrics-store';
import type { AudienceMetrics, AudienceSegment } from '@/tree/audience/types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export interface AudienceMetricsSummaryItem {
  platform: AudienceMetrics['platform'];
  followers: number;
  engagementRate: number;
  windowStartMs: number;
  windowEndMs: number;
}

export interface AudienceSummary {
  segments: AudienceSegment[];
  metrics: AudienceMetricsSummaryItem[];
  totalFollowers: number;
  /** Mean engagement rate across platforms, rounded to 6 decimals. */
  averageEngagementRate: number;
}

export type AudienceSummaryError = { code: string; message: string };

/**
 * Get the audience summary for a workspace: all segments plus the latest
 * metrics row per platform. Returns empty arrays (not an error) when the
 * workspace has no audience data yet.
 */
export async function getAudienceSummary(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; value: AudienceSummary } | { ok: false; error: AudienceSummaryError }> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Verify workspace membership (IDOR prevention) — same pattern as
    // land/creative-economy/dashboard-summary.ts.
    const db = createServerClient();
    const membership = await db
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const [segmentsResult, metricsResult] = await Promise.all([
      listSegments(parsed.data.workspaceId),
      getLatestMetrics(parsed.data.workspaceId),
    ]);

    if (!segmentsResult.ok) {
      return failure({ code: 'INTERNAL', message: segmentsResult.error.message });
    }
    if (!metricsResult.ok) {
      return failure({ code: 'INTERNAL', message: metricsResult.error.message });
    }

    const metrics: AudienceMetricsSummaryItem[] = metricsResult.value.map((m) => ({
      platform: m.platform,
      followers: m.followers,
      engagementRate: m.engagementRate,
      windowStartMs: m.windowStartMs,
      windowEndMs: m.windowEndMs,
    }));

    const totalFollowers = metrics.reduce((sum, m) => sum + m.followers, 0);
    const averageEngagementRate =
      metrics.length === 0
        ? 0
        : Math.round((metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length) * 1_000_000) /
          1_000_000;

    return success({
      segments: segmentsResult.value,
      metrics,
      totalFollowers,
      averageEngagementRate,
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[audience] getAudienceSummary failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
