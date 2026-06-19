/**
 * Handler: webhook:test
 *
 * POSTs a test payload to the user's webhook URL and verifies 2xx response.
 * LIVE — real HTTP call to user-supplied URL.
 */

import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const url = (ctx.params?.url as string) ?? '';

  if (!url) {
    return { ok: false, error: 'params.url is required' };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return { ok: false, error: 'params.url must be a valid URL' };
  }

  const testPayload = JSON.stringify({
    event: 'webhook.test',
    source: 'sophia-ai-factory',
    timestamp: Math.floor(Date.now() / 1000),
    data: { message: 'Webhook test from Sophia AI Factory — your endpoint is working correctly!' },
  });

  try {
    const startMs = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-AI-Factory/1.0',
        'X-Sophia-Event': 'webhook.test',
      },
      body: testPayload,
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - startMs;

    if (resp.ok) {
      return {
        ok: true,
        data: {
          url,
          http_status: resp.status,
          latency_ms: latencyMs,
          result: 'success',
          message: 'Webhook endpoint responded successfully.',
        },
      };
    }

    return {
      ok: false,
      error: `Webhook returned ${resp.status}. Ensure your endpoint returns 2xx for POST requests.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return {
      ok: false,
      error: `Webhook delivery failed: ${message}`,
    };
  }
}
