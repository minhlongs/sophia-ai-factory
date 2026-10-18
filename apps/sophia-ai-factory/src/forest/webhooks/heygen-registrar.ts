/**
 * HeyGen webhook endpoint management.
 * Auto-registers Sophia's webhook URL with a customer's HeyGen API key.
 * Used by setup-wizard to eliminate manual dashboard steps.
 *
 * @module lib/heygen/webhook-registrar
 */

import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'
import {
  HEYGEN_API_BASE,
  HEYGEN_EVENTS,
  listHeyGenWebhooks,
  unregisterHeyGenWebhook,
  type HeyGenWebhookEndpoint,
  type RegisterResult,
  type ListResult,
} from './heygen-registrar-helpers'

export {
  listHeyGenWebhooks,
  unregisterHeyGenWebhook,
  type HeyGenWebhookEndpoint,
  type RegisterResult,
  type ListResult,
}

/**
 * Register Sophia's webhook URL with HeyGen for the given API key.
 * Returns the endpointId and signingSecret on success.
 * Fail-soft — does NOT throw, returns { success: false, error } on failure.
 */
export async function registerHeyGenWebhook(
  apiKey: string,
  callbackUrl: string,
): Promise<RegisterResult> {
  if (!shouldAllowRequest('heygen')) {
    logger.warn('[HeyGen] Circuit breaker open — registerWebhook blocked')
    return { success: false, error: 'Circuit breaker open for heygen — registerWebhook blocked' }
  }

  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v1/webhook/endpoint.add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ url: callbackUrl, events: HEYGEN_EVENTS }),
    })

    const raw = await res.json() as Record<string, unknown>

    if (!res.ok) {
      const msg = String(raw.message ?? raw.error ?? `HTTP ${res.status}`)
      logger.warn('[HeyGen] registerWebhook failed', { status: res.status, msg })
      recordFailure('heygen', classifyError(new Error(msg)))
      return { success: false, error: msg }
    }

    // HeyGen v1 response: { code: 100, data: { endpoint_id, secret } }
    const data = (raw.data ?? raw) as Record<string, unknown>
    const endpointId = String(data.endpoint_id ?? data.endpointId ?? '')
    const signingSecret = data.secret ? String(data.secret) : undefined

    recordSuccess('heygen')
    return { success: true, endpointId, signingSecret }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[HeyGen] registerWebhook exception', err instanceof Error ? err : undefined)
    recordFailure('heygen', classifyError(err instanceof Error ? err : new Error(msg)))
    return { success: false, error: msg }
  }
}
