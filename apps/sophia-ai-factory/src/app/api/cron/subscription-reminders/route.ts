/**
 * Subscription Renewal Reminder Cron
 *
 * Finds subscriptions expiring in 3 or 7 days and sends reminder emails.
 * Deduplicates using billing_events to avoid duplicate sends.
 *
 * Schedule: Daily via Cloudflare Cron Trigger
 * Auth: x-cron-secret header or x-cf-cron: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/sender';
import { logger } from '@/lib/utils/logger-utility';

/** Days before expiry at which to send reminders */
const REMINDER_DAYS = [7, 3] as const;

function verifyCronAuth(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret === expectedSecret) return true;

  const cfCron = request.headers.get('x-cf-cron');
  if (cfCron === 'true') return true;

  return false;
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
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let remindersSent = 0;
  let errors = 0;

  try {
    const db = createServerClient();
    const now = new Date();

    for (const days of REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd   = new Date(now.getTime() + (days + 1) * 24 * 60 * 60 * 1000).toISOString();

      // Find subscriptions expiring in the window
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

          // Check dedup — skip if already sent this cycle
          const { data: existing } = await db
            .from('billing_events')
            .select('org_id')
            .eq('org_id', sub.org_id)
            .eq('event_type', eventKey)
            .gte('created_at', windowStart)
            .limit(1) as { data: BillingEventRow[] | null };

          if (existing?.length) continue;

          // Get org owner user
          const { data: members } = await db
            .from('org_members')
            .select('user_id')
            .eq('org_id', sub.org_id)
            .eq('role', 'owner')
            .limit(1) as { data: OrgMemberRow[] | null };

          const userId = members?.[0]?.user_id;
          if (!userId) continue;

          // Get user email
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

          // Send email (errors logged, not thrown)
          const result = await sendEmail({
            to: user.email,
            subject: `Your Sophia AI subscription renews in ${days} days`,
            html: buildRenewalReminderHtml(user.name || user.email, sub.plan, days, expiresAt),
            tags: [{ name: 'type', value: `renewal_reminder_${days}d` }],
          }).catch((err: Error) => {
            logger.error('[RenewalReminder] sendEmail threw', err, { org_id: sub.org_id });
            return { success: false };
          });

          // Record event regardless (dedup anchor)
          await db.from('billing_events').insert({
            org_id: sub.org_id,
            event_type: eventKey,
            event_category: 'subscription',
            event_data: { days_left: days, plan: sub.plan, email_sent: result.success },
          } as Record<string, unknown>);

          if (result.success) remindersSent++;
        } catch (innerErr) {
          errors++;
          logger.error('[RenewalReminder] Per-sub error', innerErr as Error, { org_id: sub.org_id });
        }
      }
    }

    logger.info('[RenewalReminder] Cron complete', { remindersSent, errors });
    return NextResponse.json({ success: true, remindersSent, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[RenewalReminder] Critical error', new Error(message));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
