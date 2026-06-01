/**
 * Email Drip Cron — milestone-aware lifecycle email sequence.
 * Replaces time-only generic marketing drip with milestone-gated D+1/D+7 emails.
 * Schedule: Daily at 04:00 UTC via Cloudflare Cron Trigger.
 * @module app/api/cron/email-drip/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { enqueueWelcomeEmail } from '@/forest/outbox/email-outbox';
import {
  evaluateLifecycleEmails,
  evaluateAffiliateLifecycleEmails,
  evaluateActivationReminderEmails,
  evaluateToolsNudgeEmails,
  evaluateReEngagementD14Emails,
  evaluateWinBackEmails,
  evaluatePostPurchaseNudgeEmails,
  evaluatePostPurchaseFirstSuccessEmails,
} from '@/forest/email/lifecycle-email-rules';
import { computeWeekStats } from '@/forest/email/week-stats';
import { getAffiliateClickStats } from '@/land/affiliates/dashboard-stats';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'email-drip';
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

interface HandoverRow {
  id: string;
  customer_user_id: string;
  created_at: number;
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  agency_name: string;
  trigger_payment_id: string | null;
  source: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

interface AffiliateEnrollmentRow {
  user_id: string;
  code: string;
  /** SQLite datetime('now') string — needs Date.parse to ms. */
  created_at: string;
}

interface ActivationCandidateRow {
  id: string;
  email: string;
  name: string | null;
  /** SQLite datetime('now') string. */
  createdAt: string;
  /** Min(session.createdAt) — null if user never logged in. */
  first_login_at: string | null;
  /** Min(video_jobs.created_at) — unix seconds, null if no video. */
  first_video_at: number | null;
}

interface CancelledSubscriptionRow {
  user_id: string;
  email: string;
  name: string | null;
  /** Cancellation timestamp = subscription.updated_at after status flipped to 'cancelled'. */
  updated_at: string;
}

interface PostPurchaseCandidateRow {
  user_id: string;
  email: string;
  name: string | null;
  /** Unix seconds — payment completed_at from user_purchases. */
  purchased_at: number;
  /** Unix seconds or null — onboarding_completed_at from user_profiles. */
  onboarding_completed_at: number | null;
  /** Subscription plan (tier label). */
  plan: string;
}

interface FirstVideoCandidateRow {
  user_id: string;
  email: string;
  name: string | null;
  /** Unix seconds — earliest video created_at for this user. */
  first_video_at: number;
}

interface ReEngagementCandidateRow {
  id: string;
  email: string;
  name: string | null;
  /** SQLite datetime('now') string. */
  createdAt: string;
  last_login_at: string | null;
  /** Unix seconds. */
  last_video_at: number | null;
  /** Latest subscription status; null if user never subscribed. */
  sub_status: string | null;
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = getD1();
  if (!db) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1 not available'));
    return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  let enqueued = 0;
  const now = Date.now();
  const window7d = 7.5 * 24 * 3600 * 1000;
  const window0_5d = 0.5 * 24 * 3600 * 1000;
  const nowSec = Math.floor(now / 1000);

  try {
    // Find handovers created within 0.5d–7.5d ago
    const handovers = await db
      .prepare(
        `SELECT id, customer_user_id, created_at, customer_first_login_at,
                customer_first_sop_install_at, agency_name, trigger_payment_id, source
         FROM customer_handovers
         WHERE created_at BETWEEN ?1 AND ?2`,
      )
      .bind(
        Math.floor((now - window7d) / 1000),
        Math.floor((now - window0_5d) / 1000),
      )
      .all<HandoverRow>();

    for (const handover of handovers.results ?? []) {
      try {
        const userRow = await db
          .prepare(`SELECT id, email, name FROM user WHERE id = ?1 LIMIT 1`)
          .bind(handover.customer_user_id)
          .first<UserRow>();
        if (!userRow) continue;

        const locale = 'vi'; // default; real locale from user_profiles if available
        const weekStats = handover.customer_first_login_at
          ? await computeWeekStats(db, handover.customer_user_id)
          : null;

        const decisions = evaluateLifecycleEmails(
          {
            createdAt: handover.created_at * 1000,
            firstLoginAt: handover.customer_first_login_at ? handover.customer_first_login_at * 1000 : null,
            firstSopInstallAt: handover.customer_first_sop_install_at ? handover.customer_first_sop_install_at * 1000 : null,
            ownerFullName: userRow.name ?? userRow.email.split('@')[0],
            locale,
          },
          weekStats,
          now,
        );

        for (const decision of decisions) {
          // Dedup check
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(handover.customer_user_id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          // Enqueue
          const uniqueId = `lifecycle_${handover.customer_user_id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: userRow.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          // Insert dedup log row
          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(handover.customer_user_id, decision.template, nowSec)
            .run();

          enqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Failed for handover ${handover.id}`, toError(e));
      }
    }

    // ── Affiliate lifecycle sweep (Day-1 tutorial + Day-7 case study) ───────
    // Window slightly wider than evaluator gates so we don't miss boundary cases.
    const affiliateWindowMs = 8 * 24 * 3600 * 1000;
    const affiliates = await db
      .prepare(
        `SELECT user_id, code, created_at
         FROM referral_codes
         WHERE user_id IS NOT NULL
           AND datetime(created_at) >= datetime('now', '-8 days')
           AND datetime(created_at) <= datetime('now', '-12 hours')`,
      )
      .all<AffiliateEnrollmentRow>();

    let affiliateEnqueued = 0;
    for (const aff of affiliates.results ?? []) {
      try {
        const userRow = await db
          .prepare(`SELECT id, email, name FROM user WHERE id = ?1 LIMIT 1`)
          .bind(aff.user_id)
          .first<UserRow>();
        if (!userRow) continue;

        const enrolledMs = Date.parse(aff.created_at);
        if (Number.isNaN(enrolledMs)) continue;
        if (now - enrolledMs > affiliateWindowMs) continue;

        // Day-7 personalization stats — last 7 days, BASIC user is the affiliate.
        const since7d = Math.floor((now - 7 * 24 * 3600 * 1000) / 1000);
        const stats = await getAffiliateClickStats(
          aff.user_id, aff.user_id, since7d, nowSec,
        ).catch(() => null);

        const decisions = evaluateAffiliateLifecycleEmails(
          {
            enrolledAt: enrolledMs,
            ownerFullName: userRow.name ?? userRow.email.split('@')[0],
            locale: 'en',
            referralCode: aff.code,
            totalClicks: stats?.totalClicks,
            totalConversions: stats?.totalConversions,
            pendingEarningsUsd: stats?.totalCommissionUsd,
          },
          now,
        );

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(aff.user_id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${aff.user_id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: userRow.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(aff.user_id, decision.template, nowSec)
            .run();

          affiliateEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Affiliate sweep failed for ${aff.user_id}`, toError(e));
      }
    }

    // ── Activation reminder sweep (Day-3 if logged in but no first video) ───
    // Window slightly wider than evaluator gates (2.9–4.0d) so boundary users aren't missed.
    const activationCandidates = await db
      .prepare(
        `SELECT u.id, u.email, u.name, u.createdAt,
                (SELECT MIN(s.createdAt) FROM session s WHERE s.userId = u.id) AS first_login_at,
                (SELECT MIN(v.created_at) FROM videos v WHERE v.user_id = u.id) AS first_video_at
         FROM user u
         WHERE datetime(u.createdAt) >= datetime('now', '-4 days', '-12 hours')
           AND datetime(u.createdAt) <= datetime('now', '-2 days', '-12 hours')`,
      )
      .all<ActivationCandidateRow>();

    let activationEnqueued = 0;
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

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(cand.id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${cand.id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: cand.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(cand.id, decision.template, nowSec)
            .run();

          activationEnqueued++;
        }
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

    let toolsNudgeEnqueued = 0;
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

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(cand.id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${cand.id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: cand.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(cand.id, decision.template, nowSec)
            .run();

          toolsNudgeEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Tools-nudge sweep failed for ${cand.id}`, toError(e));
      }
    }

    // ── Re-engagement D+14 sweep (active sub gone quiet 7d+) ────────────────
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

    let reEngagementEnqueued = 0;
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

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(cand.id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${cand.id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: cand.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(cand.id, decision.template, nowSec)
            .run();

          reEngagementEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Re-engagement sweep failed for ${cand.id}`, toError(e));
      }
    }

    // ── Win-back sweep (Day-60 cancelled, no reactivation) ─────────────────
    // Heuristic: a subscription currently `status='cancelled'` whose `updated_at`
    // sits in the 59–61 day window is a clean cancellation that hasn't been
    // reactivated (reactivation flips status back to 'active' + bumps updated_at).
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

    let winBackEnqueued = 0;
    for (const row of winBackCandidates.results ?? []) {
      try {
        const cancelledMs = Date.parse(row.updated_at);
        if (Number.isNaN(cancelledMs)) continue;

        const decisions = evaluateWinBackEmails(
          {
            cancelledAt: cancelledMs,
            cancelledAtIso: new Date(cancelledMs).toISOString().slice(0, 10),
            reactivatedAt: null, // status='cancelled' filter implies not yet back
            ownerFullName: row.name ?? row.email.split('@')[0],
            locale: 'en',
          },
          now,
        );

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(row.user_id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${row.user_id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: row.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(row.user_id, decision.template, nowSec)
            .run();

          winBackEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Win-back sweep failed for ${row.user_id}`, toError(e));
      }
    }

    // ── Post-purchase nudge sweep (2h after purchase, setup not done) ────────
    // Selects users whose purchase completed 1.9–3h ago and haven't finished setup.
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

    let postPurchaseNudgeEnqueued = 0;
    for (const cand of postPurchaseNudgeCandidates.results ?? []) {
      try {
        const decisions = evaluatePostPurchaseNudgeEmails(
          {
            purchasedAt: cand.purchased_at * 1000,
            onboardingCompletedAt: null, // already filtered by WHERE clause
            ownerFullName: cand.name ?? cand.email.split('@')[0],
            locale: 'vi',
          },
          now,
        );

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(cand.user_id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${cand.user_id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: cand.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(cand.user_id, decision.template, nowSec)
            .run();

          postPurchaseNudgeEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] Post-purchase nudge sweep failed for ${cand.user_id}`, toError(e));
      }
    }

    // ── First-success sweep (first video created within last 30 min) ─────────
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

    let firstSuccessEnqueued = 0;
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

        for (const decision of decisions) {
          const existing = await db
            .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
            .bind(cand.user_id, decision.template)
            .first<{ 1: number }>();
          if (existing) continue;

          const uniqueId = `lifecycle_${cand.user_id}_${decision.template}`;
          await enqueueWelcomeEmail(db, {
            paymentId: uniqueId,
            toEmail: cand.email,
            template: decision.template as 'welcome-magic-link',
            payload: decision.payload,
          });

          await db
            .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
            .bind(cand.user_id, decision.template, nowSec)
            .run();

          firstSuccessEnqueued++;
        }
      } catch (e) {
        logger.error(`[email-drip] First-success sweep failed for ${cand.user_id}`, toError(e));
      }
    }

    logger.info(
      `[email-drip] Completed. handover=${enqueued} affiliate=${affiliateEnqueued} activation=${activationEnqueued} toolsNudge=${toolsNudgeEnqueued} reEngagement=${reEngagementEnqueued} winBack=${winBackEnqueued} ppNudge=${postPurchaseNudgeEnqueued} firstSuccess=${firstSuccessEnqueued}`,
    );
    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      ok: true,
      enqueued,
      affiliateEnqueued,
      activationEnqueued,
      toolsNudgeEnqueued,
      reEngagementEnqueued,
      winBackEnqueued,
      postPurchaseNudgeEnqueued,
      firstSuccessEnqueued,
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    const errDetail = err instanceof Error ? err.message : String(err);
    logger.error('[Cron:EmailDrip] ' + errorId, { error: errDetail });
    await recordCronRun(db, CRON_NAME, 'failure', 'internal_error');
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: 'internal_error', ref: errorId }, { status: 500 });
  }
}
