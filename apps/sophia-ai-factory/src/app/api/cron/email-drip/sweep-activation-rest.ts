/**
 * Activation + tools-nudge sweeps.
 * Re-engagement, win-back, post-purchase, first-success are in sweep-non-activation.ts.
 * @module app/api/cron/email-drip/sweep-activation-rest
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  evaluateActivationReminderEmails,
  evaluateToolsNudgeEmails,
} from '@/tree/email/lifecycle-email-rules';
import { processDecisions } from './sweep-helpers';
import { runNonActivationSweeps } from './sweep-non-activation';
import type { ActivationCandidateRow } from './email-drip-types';

export interface ActivationSweepCounts {
  activation: number;
  toolsNudge: number;
  reEngagement: number;
  winBack: number;
  postPurchaseNudge: number;
  firstSuccess: number;
}

/**
 * Run activation, tools-nudge, re-engagement, win-back, post-purchase, first-success sweeps.
 */
export async function runActivationAndRestSweeps(
  db: D1Database,
  now: number,
  nowSec: number,
): Promise<ActivationSweepCounts> {
  const counts: ActivationSweepCounts = {
    activation: 0,
    toolsNudge: 0,
    reEngagement: 0,
    winBack: 0,
    postPurchaseNudge: 0,
    firstSuccess: 0,
  };

  // ── Activation reminder sweep (D+1 no-first-login) ──────────────────
  const activationCandidates = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.createdAt,
              (SELECT MIN(s.createdAt) FROM session s WHERE s.userId = u.id) AS first_login_at,
              (SELECT MIN(v.created_at) FROM videos v WHERE v.user_id = u.id) AS first_video_at
       FROM user u
       WHERE datetime(u.createdAt) >= datetime('now', '-2 days')
         AND datetime(u.createdAt) <= datetime('now', '-12 hours')`,
    )
    .all<ActivationCandidateRow>();

  for (const cand of activationCandidates.results ?? []) {
    try {
      const signupMs = Date.parse(cand.createdAt);
      if (Number.isNaN(signupMs)) continue;
      const firstLoginMs = cand.first_login_at ? Date.parse(cand.first_login_at) : NaN;

      const decisions = evaluateActivationReminderEmails(
        {
          signupAt: signupMs,
          firstLoginAt: Number.isFinite(firstLoginMs) ? firstLoginMs : null,
          firstVideoCreatedAt: cand.first_video_at ? cand.first_video_at * 1000 : null,
          ownerFullName: cand.name ?? cand.email.split('@')[0],
          locale: 'en',
        },
        now,
      );

      counts.activation += await processDecisions(
        db, cand.id, cand.email, decisions, nowSec,
        `activation ${cand.id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Activation sweep failed for ${cand.id}`, toError(e));
    }
  }

  // ── Tools-nudge sweep (Day-4 — active users who shipped first video) ────
  const toolsNudgeCandidates = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.createdAt,
              (SELECT MIN(s.createdAt) FROM session s WHERE s.userId = u.id) AS first_login_at,
              (SELECT MIN(v.created_at) FROM videos v WHERE v.user_id = u.id) AS first_video_at
       FROM user u
       WHERE datetime(u.createdAt) >= datetime('now', '-5 days', '-12 hours')
         AND datetime(u.createdAt) <= datetime('now', '-3 days', '-12 hours')`,
    )
    .all<ActivationCandidateRow>();

  for (const cand of toolsNudgeCandidates.results ?? []) {
    try {
      const signupMs = Date.parse(cand.createdAt);
      if (Number.isNaN(signupMs)) continue;
      const firstLoginMs = cand.first_login_at ? Date.parse(cand.first_login_at) : NaN;

      const decisions = evaluateToolsNudgeEmails(
        {
          signupAt: signupMs,
          firstLoginAt: Number.isFinite(firstLoginMs) ? firstLoginMs : null,
          firstVideoCreatedAt: cand.first_video_at ? cand.first_video_at * 1000 : null,
          ownerFullName: cand.name ?? cand.email.split('@')[0],
          locale: 'en',
        },
        now,
      );

      counts.toolsNudge += await processDecisions(
        db, cand.id, cand.email, decisions, nowSec,
        `tools-nudge ${cand.id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Tools-nudge sweep failed for ${cand.id}`, toError(e));
    }
  }

  // ── Remaining sweeps (delegated) ────────────────────────────────────
  const restCounts = await runNonActivationSweeps(db, now, nowSec);

  return {
    ...counts,
    ...restCounts,
  };
}
