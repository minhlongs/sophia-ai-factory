/**
 * HeyGen webhook endpoint management.
 * Auto-registers Sophia's webhook URL with a customer's HeyGen API key.
 * Used by setup-wizard to eliminate manual dashboard steps.
 *
 * @module lib/heygen/webhook-registrar
 */

import { logger } from '@/seed/utils/logger-utility'

const HEYGEN_API_BASE = 'https://api.heygen.com'

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

const HEYGEN_EVENTS = ['avatar_video.success', 'avatar_video.fail']

/**
 * Register Sophia's webhook URL with HeyGen for the given API key.
 * Returns the endpointId and signingSecret on success.
 * Fail-soft — does NOT throw, returns { success: false, error } on failure.
 */
export async function registerHeyGenWebhook(
  apiKey: string,
  callbackUrl: string,
): Promise<RegisterResult> {
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
      return { success: false, error: msg }
    }

    // HeyGen v1 response: { code: 100, data: { endpoint_id, secret } }
    const data = (raw.data ?? raw) as Record<string, unknown>
    const endpointId = String(data.endpoint_id ?? data.endpointId ?? '')
    const signingSecret = data.secret ? String(data.secret) : undefined

    return { success: true, endpointId, signingSecret }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[HeyGen] registerWebhook exception', err instanceof Error ? err : undefined)
    return { success: false, error: msg }
  }
}

/**
 * List all webhook endpoints for the given API key.
 * Fail-soft — does NOT throw.
 */
export async function listHeyGenWebhooks(apiKey: string): Promise<ListResult> {
  try {
    const res = await fetch(`${HEYGEN_API_BASE}/v1/webhook/endpoint.list`, {
      headers: { 'X-Api-Key': apiKey },
    })

    const raw = await res.json() as Record<string, unknown>

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
    return { success: true, endpoints }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
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
      return { success: false, error: msg }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[HeyGen] unregisterWebhook exception', err instanceof Error ? err : undefined)
    return { success: false, error: msg }
  }
}
