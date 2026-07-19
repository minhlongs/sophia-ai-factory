/**
 * HTTP delivery of signed webhook payloads.
 * Edge-runtime safe — uses fetch + AbortController, no Node built-ins.
 * @module lib/webhooks/sender
 */

import { signWebhook } from './signature';
import type { WebhookEndpoint, WebhookEvent, WebhookPayload } from './types';
import { logger } from '@/seed/utils/logger-utility';

const TIMEOUT_MS = 10_000;

export interface SendResult {
  success: boolean;
  httpStatus?: number;
  responseBody?: string;
  error?: string;
}

/**
 * POST a signed JSON payload to the endpoint URL.
 * Returns structured result — never throws.
 */
export async function sendWebhook(
  endpoint: Pick<WebhookEndpoint, 'url' | 'secret'>,
  event: WebhookEvent,
  payload: WebhookPayload,
): Promise<SendResult> {
  const deliveryId = crypto.randomUUID();
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);

  // Unified `t=<ts>,v1=<hmac-hex>` format — see lib/webhooks/signature.ts
  let signature: string;
  try {
    signature = await signWebhook(body, endpoint.secret ?? '', timestamp);
  } catch (err) {
    return { success: false, error: `Signing failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Sophia-Signature': signature,
        'X-Sophia-Timestamp': timestamp.toString(),
        'X-Sophia-Event': event,
        'X-Sophia-Delivery': deliveryId,
      },
      body,
    });

    const responseBody = await response.text().catch((err) => {
      logger.warn('Failed to read webhook response body', { error: String(err), context: 'sendWebhook' });
      return '';
    });
    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      httpStatus: response.status,
      responseBody: responseBody.slice(0, 1000),
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? 'Request timeout (10s)' : (err instanceof Error ? err.message : String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}
