/**
 * @file kol-outreach-actions.ts
 * @description Server Action for Creator Scouting, Quality Qualification & Outreach Enrollment
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  evaluateKolQuality,
  calculateNegotiatedSplit,
  generateCanSpamOneClickHeader,
} from '@/tree/creator/recruitment-fsm-engine';
import type { KolScoutInput } from '@/seed/types/growth-triad-v5-types';

export async function enrollCreatorOutreachAction(params: {
  creator: KolScoutInput;
  creatorAskPct?: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const evaluation = evaluateKolQuality(params.creator);
  const offeredSplit = calculateNegotiatedSplit(
    params.creatorAskPct ?? 0.35,
    evaluation.qualityScore
  );
  const now = Date.now();
  const kolId = `kol_${now}_${Math.random().toString(36).substring(2, 9)}`;

  const db = createServerClient();
  await db
    .prepare(
      `INSERT INTO kol_lead_records (
         id, platform, handle, follower_count, median_views,
         engagement_rate, quality_score, current_split_pct,
         status, unsubscribed, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      kolId,
      params.creator.platform,
      params.creator.handle,
      params.creator.followerCount,
      params.creator.medianViews,
      evaluation.engagementRatePct,
      evaluation.qualityScore,
      offeredSplit,
      'SCOUTED',
      0,
      now,
      now
    )
    .run();

  const secretKey = 'sop_can_spam_optout_secret';
  const unsubscribeHeader = generateCanSpamOneClickHeader(
    kolId,
    secretKey
  );

  await inngest.send({
    name: 'kol.outreach.enrolled',
    data: {
      kolId,
      handle: params.creator.handle,
      platform: params.creator.platform,
      stepIndex: 1,
      offeredSplitPct: offeredSplit,
    },
  });

  return {
    success: true as const,
    kolId,
    qualityScore: evaluation.qualityScore,
    isQualified: evaluation.isQualified,
    offeredSplitPct: offeredSplit,
    unsubscribeHeader,
  };
}
