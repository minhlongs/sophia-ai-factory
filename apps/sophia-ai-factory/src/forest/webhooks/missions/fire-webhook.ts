/**
 * Outbound Webhook Delivery for Mission Engine
 *
 * POSTs mission state to user's webhook URL with HMAC-SHA256 signature.
 * Retries 3x with exponential backoff on failure.
 * Signing secret stored as provider='sophia_webhook_secret' in user_provider_credentials.
 */

import { createServerClient } from '@/seed/db/client';
import { hmacSha256 } from '@/tree/audit/crypto-utils';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

interface MissionRow {
  id: string;
  user_id: string;
  command: string;
  status: string;
  result: string | null;
  error: string | null;
  credits_used: number;
  created_at: number;
  completed_at: number | null;
}

interface CredentialRow {
  encrypted_value: string;
}

/**
 * Fire webhook for a completed mission.
 * Updates webhook_fired_at on success.
 */
export async function fireMissionWebhook(missionId: string, url: string): Promise<void> {
  const db = createServerClient();

  // Fetch mission data
  const { data: mission } = await db
    .from('engine_missions')
    .select('id, user_id, command, status, result, error, credits_used, created_at, completed_at')
    .eq('id', missionId)
    .single() as { data: MissionRow | null; error: unknown };

  if (!mission) {
    logger.error('[Webhook] Mission not found', { missionId });
    return;
  }

  // Look up signing secret
  const { data: credRow } = await db
    .from('user_provider_credentials')
    .select('encrypted_value')
    .eq('user_id', mission.user_id)
    .eq('provider', 'sophia_webhook_secret')
    .single() as { data: CredentialRow | null; error: unknown };

  const signingSecret = credRow?.encrypted_value ?? '';

  const payload = JSON.stringify({
    id: mission.id,
    command: mission.command,
    status: mission.status,
    result: mission.result ? JSON.parse(mission.result) : null,
    error: mission.error ?? null,
    credits_used: mission.credits_used,
    created_at: mission.created_at,
    completed_at: mission.completed_at ?? null,
  });

  const signature = signingSecret ? hmacSha256(payload, signingSecret) : '';

  if (!shouldAllowRequest('webhooks')) {
    logger.warn('[Webhook] Circuit breaker open for webhooks, skipping delivery', { missionId, url });
    return;
  }

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-AI-Factory/1.0',
      };
      if (signature) headers['x-sophia-signature'] = signature;

      const resp = await fetch(url, { method: 'POST', headers, body: payload });
      if (resp.ok) {
        recordSuccess('webhooks');
        // Mark fired
        await db
          .from('engine_missions')
          .update({ webhook_fired_at: Math.floor(Date.now() / 1000) })
          .eq('id', missionId);
        logger.debug('[Webhook] Delivered', { missionId, url, attempt });
        return;
      }
      lastError = `HTTP ${resp.status}`;
      recordFailure('webhooks', classifyError(new Error(`HTTP ${resp.status}`)));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      recordFailure('webhooks', classifyError(err));
    }
  }

  logger.error('[Webhook] Delivery failed after 3 attempts', { missionId, url, lastError });
}
