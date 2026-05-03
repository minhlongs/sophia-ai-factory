/**
 * Handler: email:test
 *
 * Sends a single test email to the user's account email via Resend.
 * LIVE — uses platform Resend key as fallback.
 */

import { getResendKey } from '@/lib/credentials/get-provider-key';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

interface UserRow {
  email: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const toOverride = params?.to as string | undefined;

  const db = createServerClient();
  let toEmail = toOverride;

  if (!toEmail) {
    const { data: user } = await db
      .from('user')
      .select('email')
      .eq('id', userId)
      .single() as { data: UserRow | null; error: unknown };
    toEmail = user?.email;
  }

  if (!toEmail) {
    return { ok: false, error: 'Could not determine recipient email' };
  }

  const keyResult = await getResendKey({ userId, fallbackToPlatform: true });
  if (!keyResult) {
    return { ok: false, error: 'Resend API key not available' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyResult.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sophia AI <noreply@sophia.agencyos.network>',
        to: [toEmail],
        subject: 'Sophia AI — Test Email',
        html: '<h1>Test email</h1><p>Your Sophia AI integration is working correctly.</p>',
      }),
    });

    if (resp.ok) {
      const json = await resp.json() as { id?: string };
      return {
        ok: true,
        data: { to: toEmail, message_id: json.id, status: 'delivered' },
      };
    }

    const err = await resp.text();
    return { ok: false, error: `Resend error: ${resp.status} ${err.slice(0, 200)}` };
  } catch (err) {
    logger.error('[email:test] error', err instanceof Error ? err : new Error(String(err)));
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}
