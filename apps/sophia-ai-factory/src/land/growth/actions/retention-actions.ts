/**
 * @file retention-actions.ts
 * @description Server Actions for Predictive Viewer Retention & Survival Heatmap Auto-Trimmer
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  computeKaplanMeierSurvivalCurve,
  detectRetentionCliffs,
  evaluateRetentionStatus,
} from '@/tree/retention/survival-retention-engine';
import type { RetentionSecondBucket } from '@/seed/types/growth-triad-v6-types';

export async function analyzeVideoRetentionAction(params: {
  videoId: string;
  buckets: RetentionSecondBucket[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const curve = computeKaplanMeierSurvivalCurve(params.buckets);
  const cliffs = detectRetentionCliffs(curve);

  const thirtySecPoint = curve.find((p) => p.second === 30);
  const thirtySecRetention = thirtySecPoint ? thirtySecPoint.survivalRate : 0.5;

  const status = evaluateRetentionStatus(thirtySecRetention, cliffs);

  const db = createServerClient();
  const now = Date.now();
  const reportId = `rep_${now}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO retention_survival_reports (
         id, video_id, sample_size, thirty_sec_retention,
         cliffs_json, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      reportId,
      params.videoId,
      params.buckets.length > 0 ? params.buckets[0].viewers : 0,
      thirtySecRetention,
      JSON.stringify(cliffs),
      status,
      now,
      now
    )
    .run();

  if (cliffs.length > 0) {
    await inngest.send({
      name: 'retention.cliff.trimmed',
      data: {
        videoId: params.videoId,
        cliffStartSec: cliffs[0].startSecond,
        trimDurationSec: cliffs[0].recommendedTrimSec,
        thirtySecRetention,
      },
    });
  }

  return {
    success: true as const,
    reportId,
    thirtySecRetention,
    status,
    cliffs,
  };
}
