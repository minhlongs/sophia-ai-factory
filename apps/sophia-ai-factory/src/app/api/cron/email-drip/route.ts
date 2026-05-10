/**
 * Email Drip Cron — milestone-aware lifecycle email sequence.
 * Replaces time-only generic marketing drip with milestone-gated D+1/D+7 emails.
 * Schedule: Daily at 04:00 UTC via Cloudflare Cron Trigger.
 * @module app/api/cron/email-drip/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { enqueueWelcomeEmail } from '@/forest/outbox/email-outbox';
import {
  evaluateLifecycleEmails,
  evaluateAffiliateLifecycleEmails,
  evaluateActivationReminderEmails,
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

  const db = getD1();
  if (!db) return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
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
                (SELECT MIN(v.created_at) FROM video_jobs v WHERE v.user_id = u.id) AS first_video_at
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

    logger.info(
      `[email-drip] Completed. handover=${enqueued} affiliate=${affiliateEnqueued} activation=${activationEnqueued}`,
    );
    await recordCronRun(db, CRON_NAME, 'success');
    return NextResponse.json({
      ok: true,
      enqueued,
      affiliateEnqueued,
      activationEnqueued,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordCronRun(db, CRON_NAME, 'failure', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
