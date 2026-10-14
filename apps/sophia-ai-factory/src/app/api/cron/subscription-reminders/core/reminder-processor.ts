import { createServerClient } from '@/seed/db/client';
import { resolveOrgOwnerUserId } from '@/seed/auth/workspace-access';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  SubscriptionRow,
  UserRow,
  BillingEventRow,
  ReminderProcessOutcome,
  WindowProcessResult,
} from './types';
import { buildRenewalReminderHtml } from './email-builder';

export async function processSingleSubscriptionReminder(
  db: ReturnType<typeof createServerClient>,
  sub: SubscriptionRow,
  days: number,
  windowStart: string,
): Promise<ReminderProcessOutcome> {
  try {
    const eventKey = `renewal_reminder_${days}d`;

    const { data: existing } = (await db
      .from('billing_events')
      .select('org_id')
      .eq('org_id', sub.org_id)
      .eq('event_type', eventKey)
      .gte('created_at', windowStart)
      .limit(1)) as { data: BillingEventRow[] | null };

    if (existing?.length) return { success: true, sent: false };

    const userId = await resolveOrgOwnerUserId(sub.org_id, db);
    if (!userId) return { success: true, sent: false };

    const { data: users } = (await db
      .from('user')
      .select('id, email, name')
      .eq('id', userId)
      .limit(1)) as { data: UserRow[] | null };

    const user = users?.[0];
    if (!user?.email) return { success: true, sent: false };

    const expiresAt = sub.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
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

    return { success: true, sent: Boolean(result.success) };
  } catch (innerErr) {
    logger.error('[RenewalReminder] Per-sub error', toError(innerErr), { org_id: sub.org_id });
    return { success: false, sent: false };
  }
}

export async function processReminderWindow(
  db: ReturnType<typeof createServerClient>,
  days: number,
  now: Date,
): Promise<WindowProcessResult> {
  const windowStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + (days + 1) * 24 * 60 * 60 * 1000).toISOString();

  const { data: subs } = (await db
    .from('subscriptions')
    .select('org_id, plan, status, current_period_end')
    .eq('status', 'active')
    .gte('current_period_end', windowStart)
    .lte('current_period_end', windowEnd)) as { data: SubscriptionRow[] | null };

  if (!subs?.length) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;
  for (const sub of subs) {
    const outcome = await processSingleSubscriptionReminder(db, sub, days, windowStart);
    if (!outcome.success) {
      errors++;
    } else if (outcome.sent) {
      sent++;
    }
  }
  return { sent, errors };
}
