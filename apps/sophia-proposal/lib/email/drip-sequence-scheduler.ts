/**
 * Drip Sequence Scheduler — schedules timed email sequences.
 *
 * Uses D1 to persist scheduled emails and a cron-compatible check function.
 * Sequences: onboarding welcome flow, trial expiry warnings.
 */

import { getD1Client } from '@/lib/db/client';
import { sendEmail } from './sender';
import {
  welcomeEmail,
  trialEndingEmail,
  missionCompleteEmail,
} from './email-templates';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DripStep {
  delayDays: number;
  subject: string;
  templateFn: (name: string) => string;
}

interface ScheduledEmail {
  id: string;
  org_id: string;
  email: string;
  name: string;
  subject: string;
  template_key: string;
  send_at: string;
  sent: boolean;
}

// ── Onboarding Sequence ─────────────────────────────────────────────────────

const ONBOARDING_STEPS: DripStep[] = [
  {
    delayDays: 0,
    subject: 'Welcome to Sophia AI Factory!',
    templateFn: (name) => welcomeEmail(name, 'Starter', 500),
  },
  {
    delayDays: 3,
    subject: 'Tip: Create your first AI mission in 30 seconds',
    templateFn: (name) => `
      <h2>Quick tip, ${name}</h2>
      <p>Most agencies start with <code>proposal:create</code> — it generates a client-ready proposal in under 30 seconds.</p>
      <p><a href="https://sophia.ai/dashboard/missions/new">Try it now →</a></p>
    `,
  },
  {
    delayDays: 7,
    subject: 'See Sophia in action — live demo',
    templateFn: (name) => `
      <h2>Hi ${name},</h2>
      <p>Want to see how agencies use Sophia to close deals 40% faster?</p>
      <p><a href="https://sophia.ai/#demo">Try the live demo →</a></p>
    `,
  },
  {
    delayDays: 14,
    subject: 'Ready to upgrade? Unlock all 17 AI commands',
    templateFn: (name) => `
      <h2>Hey ${name},</h2>
      <p>You've been using Sophia for 2 weeks. Upgrade to Growth for 2,000 MCU/month and priority support.</p>
      <p><a href="https://sophia.ai/dashboard/billing/upgrade">Upgrade now →</a></p>
    `,
  },
];

// ── Schedule Functions ───────────────────────────────────────────────────────

export async function scheduleOnboardingDrip(
  orgId: string,
  email: string,
  name: string,
): Promise<number> {
  const db = await getD1Client();
  const now = Date.now();
  let scheduled = 0;

  for (const step of ONBOARDING_STEPS) {
    const sendAt = new Date(now + step.delayDays * 86_400_000).toISOString();
    try {
      await db.from('scheduled_emails').insert({
        org_id: orgId,
        email,
        name,
        subject: step.subject,
        template_key: `onboarding_day_${step.delayDays}`,
        send_at: sendAt,
        sent: false,
      });
      scheduled++;
    } catch {
      // Table may not exist yet — silently skip
    }
  }

  // Send day-0 email immediately
  if (ONBOARDING_STEPS[0]) {
    await sendEmail({
      to: email,
      subject: ONBOARDING_STEPS[0].subject,
      html: ONBOARDING_STEPS[0].templateFn(name),
    });
  }

  return scheduled;
}

export async function scheduleTrialEndingDrip(
  orgId: string,
  email: string,
  name: string,
  trialEndDate: Date,
): Promise<number> {
  const db = await getD1Client();
  const endMs = trialEndDate.getTime();
  const warnings = [
    { daysBefore: 3, subject: 'Your Sophia trial ends in 3 days' },
    { daysBefore: 1, subject: 'Last day of your Sophia trial' },
  ];

  let scheduled = 0;
  for (const w of warnings) {
    const sendAt = new Date(endMs - w.daysBefore * 86_400_000).toISOString();
    try {
      await db.from('scheduled_emails').insert({
        org_id: orgId,
        email,
        name,
        subject: w.subject,
        template_key: `trial_ending_${w.daysBefore}d`,
        send_at: sendAt,
        sent: false,
      });
      scheduled++;
    } catch {
      // Table may not exist
    }
  }
  return scheduled;
}

// ── Cron Processor ──────────────────────────────────────────────────────────

export async function processDueEmails(): Promise<number> {
  const db = await getD1Client();
  let sent = 0;

  try {
    const { data: due } = await db
      .from<ScheduledEmail>('scheduled_emails')
      .select('*')
      .eq('sent', false)
      .lte('send_at', new Date().toISOString())
      .limit(50);

    if (!due || due.length === 0) return 0;

    for (const row of due) {
      const html = resolveTemplate(row.template_key, row.name);
      const result = await sendEmail({
        to: row.email,
        subject: row.subject,
        html,
        tags: [{ name: 'drip', value: row.template_key }],
      });

      if (result.success) {
        await db.from('scheduled_emails').update({ sent: true }).eq('id', row.id);
        sent++;
      }
    }
  } catch {
    // Table may not exist
  }

  return sent;
}

function resolveTemplate(key: string, name: string): string {
  if (key.startsWith('onboarding_day_')) {
    const day = parseInt(key.replace('onboarding_day_', ''), 10);
    const step = ONBOARDING_STEPS.find(s => s.delayDays === day);
    return step ? step.templateFn(name) : `<p>Hi ${name}, check out Sophia AI!</p>`;
  }
  if (key === 'trial_ending_3d') return trialEndingEmail(name, 3);
  if (key === 'trial_ending_1d') return trialEndingEmail(name, 1);
  return `<p>Hi ${name}</p>`;
}
