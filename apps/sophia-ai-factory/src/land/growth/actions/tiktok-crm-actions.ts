/**
 * @file tiktok-crm-actions.ts
 * @description Server Actions for TikTok Shop Creator Outreach & Sample Fulfillment CRM
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  evaluateSampleGate,
  resolveCommissionTier,
} from '@/tree/tiktok-crm/sample-gate-fsm';

export async function evaluateTikTokCreatorAction(params: {
  creatorHandle: string;
  followerCount: number;
  rollingGmv30d: number;
  engagementRate: number;
  attributedSalesCount: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const evaluation = evaluateSampleGate({
    followerCount: params.followerCount,
    rollingGmv30d: params.rollingGmv30d,
    engagementRate: params.engagementRate,
    attributedSalesCount: params.attributedSalesCount,
  });

  const targetTier = resolveCommissionTier(params.attributedSalesCount);
  const now = Date.now();
  const creatorId = `tt_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const db = createServerClient();

  await db
    .prepare(
      `INSERT INTO tiktok_creator_records (
         id, user_id, creator_handle, follower_count,
         rolling_gmv_30d, engagement_rate, sample_status,
         commission_tier, video_deadline_days, attributed_sales_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      creatorId,
      user.id,
      params.creatorHandle,
      params.followerCount,
      params.rollingGmv30d,
      params.engagementRate,
      evaluation.status,
      targetTier,
      7,
      params.attributedSalesCount,
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'tiktok.sample.evaluated',
    data: {
      creatorId,
      userId: user.id,
      creatorHandle: params.creatorHandle,
      sampleStatus: evaluation.status,
      tier: targetTier,
    },
  });

  return {
    success: true,
    creatorId,
    sampleStatus: evaluation.status,
    commissionTier: targetTier,
    reason: evaluation.reason,
  };
}
