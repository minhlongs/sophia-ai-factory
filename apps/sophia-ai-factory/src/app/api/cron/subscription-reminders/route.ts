/**
 * Subscription Renewal Reminder Cron
 *
 * Finds subscriptions expiring in 3 or 7 days and sends reminder emails.
 * Deduplicates using billing_events to avoid duplicate sends.
 *
 * Schedule: Daily via Cloudflare Cron Trigger (0 2 * * *)
 * Auth: x-cron-secret header or x-cf-cron: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

const CRON_NAME = 'subscription-reminders';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Days before expiry at which to send reminders */
const REMINDER_DAYS = [7, 3] as const;

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

interface SubOrgRow {
  org_id: string;
  next_billing_at: string;
  tier: string;
  email: string;
  name: string | null;
}

async function getExpiringSubs(db: D1Database, days: number): Promise<SubOrgRow[]> { // eslint-disable-line @typescript-eslint/no-unused-vars
  const query = `
    SELECT o.id as org_id, o.next_billing_at, o.active_tier as tier,
           u.email, u.name
    FROM orgs o
    JOIN users u ON u.id = o.owner_id
    WHERE o.next_billing_at IS NOT NULL
      AND date(o.next_billing_at) = date('now', '+' || ? || ' days')
    ORDER BY o.next_billing_at ASC
  `;
  const result = await db.prepare(query).bind(days).all<SubOrgRow>();
  return result.results;
}

interface SubscriptionRow {
  org_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}

interface OrgMemberRow {
  user_id: string;
  org_id: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

interface BillingEventRow {
  org_id: string;
  event_type: string;
}

function buildRenewalReminderHtml(
  name: string,
  plan: string,
  daysLeft: number,
  expiresAt: string
): string {
  const displayName = name || 'there';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Your Sophia AI subscription renews in ${daysLeft} days</h2>
  <p>Hi ${displayName},</p>
  <p>Your <strong>${plan.toUpperCase()}</strong> plan expires on <strong>${expiresAt}</strong>.</p>
  <p>To continue uninterrupted access, please ensure your payment method is up to date.</p>
  <a href="https://sophia.agencyos.network/dashboard/billing"
     style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
    Manage Billing
  </a>
  <p style="font-size:13px;color:#666;">Questions? Reply to this email or message @Sophia_Bbot on Telegram.</p>
</body></html>`;
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = getD1();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  let remindersSent = 0;
  let errors = 0;

  try {
    const db = createServerClient();
    const now = new Date();

    for (const days of REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd   = new Date(now.getTime() + (days + 1) * 24 * 60 * 60 * 1000).toISOString();

      const { data: subs } = await db
        .from('subscriptions')
        .select('org_id, plan, status, current_period_end')
        .eq('status', 'active')
        .gte('current_period_end', windowStart)
        .lte('current_period_end', windowEnd) as { data: SubscriptionRow[] | null };

      if (!subs?.length) continue;

      for (const sub of subs) {
        try {
          const eventKey = `renewal_reminder_${days}d`;

          const { data: existing } = await db
            .from('billing_events')
            .select('org_id')
            .eq('org_id', sub.org_id)
            .eq('event_type', eventKey)
            .gte('created_at', windowStart)
            .limit(1) as { data: BillingEventRow[] | null };

          if (existing?.length) continue;

          const { data: members } = await db
            .from('org_members')
            .select('user_id')
            .eq('org_id', sub.org_id)
            .eq('role', 'owner')
            .limit(1) as { data: OrgMemberRow[] | null };

          const userId = members?.[0]?.user_id;
          if (!userId) continue;

          const { data: users } = await db
            .from('user')
            .select('id, email, name')
            .eq('id', userId)
            .limit(1) as { data: UserRow[] | null };

          const user = users?.[0];
          if (!user?.email) continue;

          const expiresAt = sub.current_period_end
            ? new Date(sub.current_period_end).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            : 'soon';

          const result = await sendEmail({
            to: user.email,
            subject: `Your Sophia AI subscription renews in ${days} days`,
            html: buildRenewalReminderHtml(user.name || user.email, sub.plan, days, expiresAt),
            tags: [{ name: 'type', value: `renewal_reminder_${days}d` }],
          }).catch((err: Error) => {
            logger.error('[RenewalReminder] sendEmail threw', err, { org_id: sub.org_id });
            return { success: false };
          });

          await db.from('billing_events').insert({
            org_id: sub.org_id,
            event_type: eventKey,
            event_category: 'subscription',
            event_data: { days_left: days, plan: sub.plan, email_sent: result.success },
          } as Record<string, unknown>);

          if (result.success) remindersSent++;
        } catch (innerErr) {
          errors++;
          logger.error('[RenewalReminder] Per-sub error', toError(innerErr), { org_id: sub.org_id });
        }
      }
    }

    logger.info('[RenewalReminder] Cron complete', { remindersSent, errors });
    if (d1) await recordCronRun(d1, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ success: true, remindersSent, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[RenewalReminder] Critical error', new Error(message));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
