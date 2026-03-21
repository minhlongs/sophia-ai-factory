/**
 * RaaS Webhook Delivery
 *
 * Delivers mission completion events to consumer webhook URLs.
 * Retries up to 3 times with exponential backoff.
 */

import { createServerClient } from '@/lib/supabase/client';
import { signPayload, WEBHOOK_HEADERS } from './webhook-hmac';

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

/** Check if hostname is in 172.16.0.0/12 private range (172.16-31.x.x). */
function isPrivate172(h: string): boolean {
  if (!h.startsWith('172.')) return false;
  const second = parseInt(h.split('.')[1], 10);
  return second >= 16 && second <= 31;
}

/** Block SSRF: reject internal IPs, cloud metadata, non-HTTP(S) URLs. */
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const h = parsed.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    if (h.startsWith('10.') || h.startsWith('192.168.') || isPrivate172(h)) return false;
    if (h === '169.254.169.254' || h.endsWith('.internal')) return false;
    return true;
  } catch { return false; }
}

// ── Delivery ──────────────────────────────────────────────────────────────────

/**
 * Attempt to POST payload to webhookUrl with retry logic.
 * Records each attempt in raas_webhook_deliveries.
 */
export async function deliverWebhook(
  missionId: string,
  orgId: string,
  webhookUrl: string,
  payload: object,
  signingSecret?: string
): Promise<void> {
  if (!isUrlSafe(webhookUrl)) {
    console.error(`[webhook-delivery] Blocked unsafe URL: ${webhookUrl}`);
    return;
  }

  const db = createServerClient();
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const start = Date.now();
    let statusCode: number | null = null;

    try {
      const bodyStr = JSON.stringify(payload);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      // HMAC sign if secret provided
      const secret = signingSecret ?? process.env.WEBHOOK_SIGNING_SECRET;
      if (secret) {
        const { signature, timestamp } = signPayload(bodyStr, secret);
        headers[WEBHOOK_HEADERS.signature] = signature;
        headers[WEBHOOK_HEADERS.timestamp] = timestamp;
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
      });
      statusCode = res.status;
    } catch {
      // Network error — statusCode stays null
    }

    const delivered = statusCode !== null && statusCode >= 200 && statusCode < 300;
    const nextRetryAt =
      !delivered && attempt < MAX_ATTEMPTS
        ? new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (attempt - 1)).toISOString()
        : null;

    await db.from('raas_webhook_deliveries').insert({
      mission_id:     missionId,
      org_id:         orgId,
      webhook_url:    webhookUrl,
      payload,
      status_code:    statusCode,
      attempt_number: attempt,
      delivered_at:   delivered ? new Date().toISOString() : null,
      next_retry_at:  nextRetryAt,
    });

    if (delivered) return;

    // Backoff before retry
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** (attempt - 1)));
    }
  }

  console.error(`[webhook-delivery] All ${MAX_ATTEMPTS} attempts failed for mission ${missionId}`);
}
