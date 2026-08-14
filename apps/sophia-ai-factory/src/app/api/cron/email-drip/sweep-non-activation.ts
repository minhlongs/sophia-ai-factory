/**
 * Re-engagement, win-back, post-purchase, first-success sweeps.
 * Extracted from sweep-activation-rest.ts to keep all files under 200 LOC.
 * @module app/api/cron/email-drip/sweep-non-activation
 */
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  evaluateReEngagementD14Emails,
  evaluateWinBackEmails,
  evaluatePostPurchaseNudgeEmails,
  evaluatePostPurchaseFirstSuccessEmails,
} from '@/tree/email/lifecycle-email-rules';
import { processDecisions } from './sweep-helpers';
import type {
  ReEngagementCandidateRow,
  CancelledSubscriptionRow,
  PostPurchaseCandidateRow,
  FirstVideoCandidateRow,
} from './email-drip-types';

export interface NonActivationSweepCounts {
  reEngagement: number; winBack: number;
  postPurchaseNudge: number; firstSuccess: number;
}

/** Run re-engagement, win-back, post-purchase, first-success sweeps. */
export async function runNonActivationSweeps(
  db: D1Database, now: number, nowSec: number,
): Promise<NonActivationSweepCounts> {
  const counts: NonActivationSweepCounts = {
    reEngagement: 0, winBack: 0, postPurchaseNudge: 0, firstSuccess: 0,
  };

  // ── Re-engagement D+14 sweep ─────────────────────────────────────────
  const reEngagementCandidates = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.createdAt,
              (SELECT MAX(s.createdAt) FROM session s WHERE s.userId = u.id) AS last_login_at,
              (SELECT MAX(v.created_at) FROM videos v WHERE v.user_id = u.id) AS last_video_at,
              (SELECT sub.status FROM subscriptions sub WHERE sub.user_id = u.id ORDER BY sub.updated_at DESC LIMIT 1) AS sub_status
       FROM user u
       WHERE datetime(u.createdAt) >= datetime('now', '-15 days')
         AND datetime(u.createdAt) <= datetime('now', '-13 days', '-12 hours')`,
    )
    .all<ReEngagementCandidateRow>();

  for (const cand of reEngagementCandidates.results ?? []) {
    try {
      const signupMs = Date.parse(cand.createdAt);
      if (Number.isNaN(signupMs)) continue;
      const lastLoginMs = cand.last_login_at ? Date.parse(cand.last_login_at) : NaN;
      const lastVideoMs = cand.last_video_at ? cand.last_video_at * 1000 : NaN;
      const lastActivityMs = Math.max(
        Number.isFinite(lastLoginMs) ? lastLoginMs : 0,
        Number.isFinite(lastVideoMs) ? lastVideoMs : 0,
      );

      const decisions = evaluateReEngagementD14Emails(
        {
          signupAt: signupMs,
          lastActivityAt: lastActivityMs > 0 ? lastActivityMs : null,
          subscriptionActive: cand.sub_status === 'active',
          ownerFullName: cand.name ?? cand.email.split('@')[0],
          locale: 'en',
        },
        now,
      );

      counts.reEngagement += await processDecisions(
        db, cand.id, cand.email, decisions, nowSec,
        `re-engagement ${cand.id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Re-engagement sweep failed for ${cand.id}`, toError(e));
    }
  }

  // ── Win-back sweep ───────────────────────────────────────────────────
  const winBackCandidates = await db
    .prepare(
      `SELECT s.user_id, u.email, u.name, s.updated_at
       FROM subscriptions s
       JOIN user u ON u.id = s.user_id
       WHERE s.status = 'cancelled'
         AND s.user_id IS NOT NULL
         AND datetime(s.updated_at) >= datetime('now', '-61 days')
         AND datetime(s.updated_at) <= datetime('now', '-59 days', '-12 hours')`,
    )
    .all<CancelledSubscriptionRow>();

  for (const row of winBackCandidates.results ?? []) {
    try {
      const cancelledMs = Date.parse(row.updated_at);
      if (Number.isNaN(cancelledMs)) continue;

      const decisions = evaluateWinBackEmails(
        {
          cancelledAt: cancelledMs,
          cancelledAtIso: new Date(cancelledMs).toISOString().slice(0, 10),
          reactivatedAt: null,
          ownerFullName: row.name ?? row.email.split('@')[0],
          locale: 'en',
        },
        now,
      );

      counts.winBack += await processDecisions(
        db, row.user_id, row.email, decisions, nowSec,
        `win-back ${row.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Win-back sweep failed for ${row.user_id}`, toError(e));
    }
  }

  // ── Post-purchase nudge sweep ────────────────────────────────────────
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

      counts.postPurchaseNudge += await processDecisions(
        db, cand.user_id, cand.email, decisions, nowSec,
        `post-purchase nudge ${cand.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Post-purchase nudge sweep failed for ${cand.user_id}`, toError(e));
    }
  }

  // ── First-success sweep ──────────────────────────────────────────────
  const firstSuccessCandidates = await db
    .prepare(
      `SELECT v.user_id, u.email, u.name, MIN(v.created_at) AS first_video_at
       FROM videos v
       JOIN user u ON u.id = v.user_id
       GROUP BY v.user_id
       HAVING first_video_at >= ?1 AND first_video_at <= ?2`,
    )
    .bind(
      Math.floor((now - 30 * 60 * 1000) / 1000),
      nowSec,
    )
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

      counts.firstSuccess += await processDecisions(
        db, cand.user_id, cand.email, decisions, nowSec,
        `first-success ${cand.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] First-success sweep failed for ${cand.user_id}`, toError(e));
    }
  }

  return counts;
}
