/**
 * Email Sender — Resend integration for outreach sequence delivery.
 *
 * Sends emails via Resend API (https://resend.com).
 * Requires RESEND_API_KEY env var.
 * Falls back to logging when key is not configured.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend' | 'dry-run';
}

export interface SequenceStep {
  day: number;
  subject: string;
  body: string;
  channel: string;
}

export interface SequenceScheduleResult {
  scheduled: number;
  skipped: number;
  results: EmailResult[];
}

// ── Send single email ────────────────────────────────────────────────────────

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = params.from ?? process.env.EMAIL_FROM ?? 'Sophia AI <noreply@sophia.ai>';

  // Dry-run mode when no API key
  if (!apiKey) {
    console.log(`[Email DRY-RUN] To: ${params.to} | Subject: ${params.subject}`);
    return { success: true, messageId: `dry_${Date.now()}`, provider: 'dry-run' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html ?? `<pre>${params.text ?? params.subject}</pre>`,
        reply_to: params.replyTo,
        tags: params.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { success: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}`, provider: 'resend' };
    }

    const data = await res.json() as { id?: string };
    return { success: true, messageId: data.id, provider: 'resend' };
  } catch (err) {
    return { success: false, error: (err as Error).message, provider: 'resend' };
  }
}

// ── Send outreach sequence ───────────────────────────────────────────────────

/**
 * Schedule an outreach sequence for a prospect.
 * Only sends email-channel steps; skips LinkedIn/other channels.
 */
export async function sendOutreachSequence(
  prospectEmail: string,
  sequence: SequenceStep[],
  opts?: { dryRun?: boolean },
): Promise<SequenceScheduleResult> {
  const emailSteps = sequence.filter(s => s.channel === 'email');
  const results: EmailResult[] = [];
  let skipped = 0;

  for (const step of emailSteps) {
    if (opts?.dryRun) {
      console.log(`[Sequence DRY-RUN] Day ${step.day}: ${step.subject}`);
      results.push({ success: true, messageId: `dry_d${step.day}`, provider: 'dry-run' });
      continue;
    }

    // In production, this would use a job queue with delay.
    // For now, send immediately (first touch) or log future steps.
    if (step.day === 1) {
      const result = await sendEmail({
        to: prospectEmail,
        subject: step.subject,
        text: step.body,
        tags: [{ name: 'sequence_day', value: String(step.day) }],
      });
      results.push(result);
    } else {
      // Future steps need a scheduler (e.g., CF Durable Objects, cron)
      console.log(`[Sequence] Scheduled Day ${step.day}: ${step.subject} → ${prospectEmail}`);
      results.push({ success: true, messageId: `scheduled_d${step.day}`, provider: 'dry-run' });
      skipped++;
    }
  }

  return {
    scheduled: results.length,
    skipped,
    results,
  };
}
