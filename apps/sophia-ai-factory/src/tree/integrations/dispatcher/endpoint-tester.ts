/**
 * Webhook Test Ping Engine
 *
 * Implements lightweight test ping to a webhook endpoint.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/endpoint-tester
 */

import { SIGNATURE_HEADER_NAME, signWebhookPayload } from './crypto-verifier';

/**
 * Sends a lightweight test ping to a webhook endpoint.
 */
export async function testWebhookEndpoint(
  endpointUrl: string,
  secretKey: string,
  fetcher?: typeof fetch
): Promise<{ success: boolean; httpStatus?: number; error?: string }> {
  const fetchFn = fetcher || globalThis.fetch;
  const testPayload = {
    event: 'endpoint.test',
    timestamp: Date.now(),
    message: 'Sophia AI Factory Webhook Ping Verification',
  };
  const payloadJson = JSON.stringify(testPayload);

  try {
    const signResult = await signWebhookPayload(secretKey, payloadJson);
    const res = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-Webhook-Dispatcher/2.0',
        [SIGNATURE_HEADER_NAME]: signResult.signatureHeader,
        'X-Sophia-Event': 'endpoint.test',
        'X-Sophia-Attempt': '1',
      },
      body: payloadJson,
      signal: AbortSignal.timeout(5_000),
    });

    return {
      success: res.ok,
      httpStatus: res.status,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
