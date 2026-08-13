/**
 * Handler: email:test
 *
 * Sends a single test email to the user's account email via Resend.
 * LIVE — uses platform Resend key as fallback.
 */

import { getResendKey } from '@/tree/credentials/get-provider-key';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import type { MissionHandlerResult, MissionContext } from '@/seed/types/missions';

const RESEND_TEST_SERVICE = 'resend-test';

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

  if (!shouldAllowRequest(RESEND_TEST_SERVICE)) {
    return { ok: false, error: 'Resend service temporarily unavailable (circuit open)' };
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
      recordSuccess(RESEND_TEST_SERVICE);
      const json = await resp.json() as { id?: string };
      return {
        ok: true,
        data: { to: toEmail, message_id: json.id, status: 'delivered' },
      };
    }

    const err = await resp.text();
    recordFailure(RESEND_TEST_SERVICE, classifyHttpStatus(resp.status));
    return { ok: false, error: `Resend error: ${resp.status} ${err.slice(0, 200)}` };
  } catch (err) {
    recordFailure(RESEND_TEST_SERVICE, classifyError(err));
    logger.error('[email:test] error', err instanceof Error ? err : new Error(String(err)));
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}
