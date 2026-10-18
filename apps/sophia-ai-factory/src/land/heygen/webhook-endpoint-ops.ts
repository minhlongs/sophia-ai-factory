/**
 * HeyGen webhook endpoint list and delete operations.
 *
 * @module land/heygen/webhook-endpoint-ops
 */

import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

export const HEYGEN_API_BASE = 'https://api.heygen.com'

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
    return { success: false, error: 'Circuit breaker open for HeyGen — too many failures' }
  }
  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v1/webhook/endpoint.list`, {
      headers: { 'X-Api-Key': apiKey },
    })

    const raw = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      const msg = String(raw.message ?? raw.error ?? `HTTP ${res.status}`)
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
    const kind = classifyError(err)
    recordFailure('heygen', kind)
    logger.error('[HeyGen] listWebhooks exception', err instanceof Error ? err : undefined)
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
    return { success: false, error: 'Circuit breaker open for HeyGen — too many failures' }
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
      const raw = (await res.json()) as Record<string, unknown>
      const msg = String(raw.message ?? raw.error ?? `HTTP ${res.status}`)
      const kind = classifyError(new Error(msg))
      recordFailure('heygen', kind)
      return { success: false, error: msg }
    }
    recordSuccess('heygen')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const kind = classifyError(err)
    recordFailure('heygen', kind)
    logger.error('[HeyGen] unregisterWebhook exception', err instanceof Error ? err : undefined)
    return { success: false, error: msg }
  }
}
