/**
 * Handler: email:campaign
 *
 * Sends a bulk email campaign via Resend using user's API key (or platform fallback).
 * LIVE — requires Resend API key.
 */

import { getResendKey } from '@/lib/credentials/get-provider-key';
import { logger } from '@/lib/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const recipients = (params?.recipients as string[]) ?? [];
  const subject = (params?.subject as string) ?? 'Message from Sophia AI Factory';
  const body = (params?.body as string) ?? '';
  const fromName = (params?.from_name as string) ?? 'Sophia AI';
  const fromEmail = (params?.from_email as string) ?? 'noreply@sophia.agencyos.network';

  if (!recipients.length) {
    return { ok: false, error: 'params.recipients (array of emails) is required' };
  }

  if (!body) {
    return { ok: false, error: 'params.body is required' };
  }

  const keyResult = await getResendKey({ userId, fallbackToPlatform: true });
  if (!keyResult) {
    return { ok: false, error: 'Resend API key not available. Add it in Settings > Integrations.' };
  }

  const results: Array<{ email: string; status: string; message_id?: string }> = [];
  let successCount = 0;

  for (const to of recipients) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyResult.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html: body,
        }),
      });

      if (resp.ok) {
        const json = await resp.json() as { id?: string };
        results.push({ email: to, status: 'sent', message_id: json.id });
        successCount++;
      } else {
        const err = await resp.text();
        results.push({ email: to, status: 'failed', message_id: err.slice(0, 100) });
      }
    } catch (err) {
      logger.error('[email:campaign] send error', err instanceof Error ? err : new Error(String(err)));
      results.push({ email: to, status: 'failed' });
    }
  }

  return {
    ok: successCount > 0,
    data: {
      total: recipients.length,
      sent: successCount,
      failed: recipients.length - successCount,
      results,
      api_key_source: keyResult.source,
    },
  };
}
