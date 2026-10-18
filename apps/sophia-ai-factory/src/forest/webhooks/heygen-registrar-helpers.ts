/**
 * HeyGen webhook endpoint types and list/delete helpers.
 *
 * @module forest/webhooks/heygen-registrar-helpers
 */

import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

export const HEYGEN_API_BASE = 'https://api.heygen.com'
export const HEYGEN_EVENTS = ['avatar_video.success', 'avatar_video.fail']

export interface HeyGenWebhookEndpoint {
  endpointId: string
  url: string
  events: string[]
  signingSecret?: string
}

export interface RegisterResult {
  success: boolean
  endpointId?: string
  signingSecret?: string
  error?: string
}

export interface ListResult {
  success: boolean
  endpoints?: HeyGenWebhookEndpoint[]
  error?: string
}

/**
 * List all webhook endpoints for the given API key.
 * Fail-soft — does NOT throw.
 */
export async function listHeyGenWebhooks(apiKey: string): Promise<ListResult> {
  if (!shouldAllowRequest('heygen')) {
    logger.warn('[HeyGen] Circuit breaker open — listWebhooks blocked')
    return { success: false, error: 'Circuit breaker open for heygen — listWebhooks blocked' }
  }

  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v1/webhook/endpoint.list`, {
      headers: { 'X-Api-Key': apiKey },
    })

    const raw = await res.json() as Record<string, unknown>

    if (!res.ok) {
      const msg = String(raw.message ?? raw.error ?? `HTTP ${res.status}`)
      recordFailure('heygen', classifyError(new Error(msg)))
      return { success: false, error: msg }
    }

    const items = (raw.data ?? raw.endpoints ?? []) as Array<Record<string, unknown>>
    const endpoints: HeyGenWebhookEndpoint[] = items.map((e) => ({
      endpointId: String(e.endpoint_id ?? e.id ?? ''),
      url: String(e.url ?? ''),
      events: Array.isArray(e.events) ? (e.events as string[]) : [],
    }))
    recordSuccess('heygen')
    return { success: true, endpoints }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[HeyGen] listWebhooks exception', err instanceof Error ? err : undefined)
    recordFailure('heygen', classifyError(err instanceof Error ? err : new Error(msg)))
    return { success: false, error: msg }
  }
}

/**
 * Delete a webhook endpoint.
 * Fail-soft — does NOT throw.
 */
export async function unregisterHeyGenWebhook(
  apiKey: string,
  endpointId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!shouldAllowRequest('heygen')) {
    logger.warn('[HeyGen] Circuit breaker open — unregisterWebhook blocked')
    return { success: false, error: 'Circuit breaker open for heygen — unregisterWebhook blocked' }
  }

  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v1/webhook/endpoint.delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ endpoint_id: endpointId }),
    })

    if (!res.ok) {
      const raw = await res.json() as Record<string, unknown>
      const msg = String(raw.message ?? raw.error ?? `HTTP ${res.status}`)
      recordFailure('heygen', classifyError(new Error(msg)))
      return { success: false, error: msg }
    }
    recordSuccess('heygen')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[HeyGen] unregisterWebhook exception', err instanceof Error ? err : undefined)
    recordFailure('heygen', classifyError(err instanceof Error ? err : new Error(msg)))
    return { success: false, error: msg }
  }
}
