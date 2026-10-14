/**
 * Post-purchase nudge and first-success sweep executors for email drip cron.
 * @module app/api/cron/email-drip/sweep-post-purchase
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  evaluatePostPurchaseNudgeEmails,
  evaluatePostPurchaseFirstSuccessEmails,
} from '@/tree/email/lifecycle-email-rules';
import { processDecisions } from './sweep-helpers';
import type {
  PostPurchaseCandidateRow,
  FirstVideoCandidateRow,
} from './email-drip-types';

export async function runPostPurchaseNudgeSweep(
  db: D1Database,
  now: number,
  nowSec: number,
): Promise<number> {
  let count = 0;
  const postPurchaseNudgeCandidates = await db
    .prepare(
      `SELECT p.user_id, u.email, u.name, p.completed_at AS purchased_at,
              up.onboarding_completed_at,
              COALESCE(s.plan, 'basic') AS plan
       FROM user_purchases p
       JOIN user u ON u.id = p.user_id
       LEFT JOIN user_profiles up ON up.user_id = p.user_id
       LEFT JOIN subscriptions s ON s.user_id = p.user_id
       WHERE p.status = 'paid'
         AND p.completed_at IS NOT NULL
         AND p.completed_at >= ?1
         AND p.completed_at <= ?2
         AND (up.onboarding_completed_at IS NULL)`,
    )
    .bind(
      Math.floor((now - 3 * 3600 * 1000) / 1000),
      Math.floor((now - Math.round(1.9 * 3600 * 1000)) / 1000),
    )
    .all<PostPurchaseCandidateRow>();

  for (const cand of postPurchaseNudgeCandidates.results ?? []) {
    try {
      const decisions = evaluatePostPurchaseNudgeEmails(
        {
          purchasedAt: cand.purchased_at * 1000,
          onboardingCompletedAt: null,
          ownerFullName: cand.name ?? cand.email.split('@')[0],
          locale: 'vi',
        },
        now,
      );

      count += await processDecisions(
        db,
        cand.user_id,
        cand.email,
        decisions,
        nowSec,
        `post-purchase nudge ${cand.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Post-purchase nudge sweep failed for ${cand.user_id}`, toError(e));
    }
  }
  return count;
}

export async function runFirstSuccessSweep(
  db: D1Database,
  now: number,
  nowSec: number,
): Promise<number> {
  let count = 0;
  const firstSuccessCandidates = await db
    .prepare(
      `SELECT v.user_id, u.email, u.name, MIN(v.created_at) AS first_video_at
       FROM videos v
       JOIN user u ON u.id = v.user_id
       GROUP BY v.user_id
       HAVING first_video_at >= ?1 AND first_video_at <= ?2`,
    )
    .bind(Math.floor((now - 30 * 60 * 1000) / 1000), nowSec)
    .all<FirstVideoCandidateRow>();

  for (const cand of firstSuccessCandidates.results ?? []) {
    try {
      const decisions = evaluatePostPurchaseFirstSuccessEmails(
        {
          firstVideoCreatedAt: cand.first_video_at * 1000,
          ownerFullName: cand.name ?? cand.email.split('@')[0],
          locale: 'vi',
        },
        now,
      );

      count += await processDecisions(
        db,
        cand.user_id,
        cand.email,
        decisions,
        nowSec,
        `first-success ${cand.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] First-success sweep failed for ${cand.user_id}`, toError(e));
    }
  }
  return count;
}
