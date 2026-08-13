/**
 * Minimal Sentry HTTP Forwarder
 *
 * Fire-and-forget error forwarding to Sentry's store API endpoint.
 * Uses no SDK — just a raw HTTP POST. Only fires when SENTRY_DSN is set.
 *
 * PII policy: strips email, payment_id; keeps purchase_id and user_id.
 * Timeout: 2s AbortSignal — never blocks caller.
 *
 * @module lib/observability/sentry-forwarder
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

export interface SentryForwardEvent {
  level: 'error' | 'warning'
  message: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

// Allowlist of extra fields that may be forwarded (no PII)
const ALLOWED_EXTRA_KEYS = new Set([
  'userId',
  'purchaseId',
  'videoId',
  'sku',
  'stage',
  'cronName',
  'orphanCount',
  'attemptCount',
  'provider',
])

/** Remove PII fields and restrict to allowlist. */
export function stripPii(
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!extra) return undefined
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(extra)) {
    if (ALLOWED_EXTRA_KEYS.has(key)) {
      cleaned[key] = value
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

/** Parse the project ID from a Sentry DSN like https://key@o123.ingest.sentry.io/456 */
export function parseSentryProjectId(dsn: string): string | null {
  try {
    const url = new URL(dsn)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? null
  } catch {
    return null
  }
}

/** Parse the store endpoint base from a DSN. */
export function parseSentryEndpoint(dsn: string): string | null {
  try {
    const url = new URL(dsn)
    const projectId = parseSentryProjectId(dsn)
    if (!projectId) return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

/** Build the X-Sentry-Auth header value. */
export function buildSentryAuthHeader(dsn: string): string | null {
  try {
    const url = new URL(dsn)
    const key = url.username
    if (!key) return null
    return `Sentry sentry_version=7, sentry_key=${key}, sentry_client=sophia-http-forwarder/1`
  } catch {
    return null
  }
}

/**
 * Forward an event to Sentry via direct HTTP POST.
 * Fire-and-forget: caller does NOT await — import and call, then continue.
 * Errors are silently swallowed.
 */
export async function forwardToSentry(evt: SentryForwardEvent): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN
  if (!dsn) return

  const endpoint = parseSentryEndpoint(dsn)
  const projectId = parseSentryProjectId(dsn)
  const authHeader = buildSentryAuthHeader(dsn)

  if (!endpoint || !projectId || !authHeader) return

  const body = JSON.stringify({
    level: evt.level,
    message: evt.message,
    tags: evt.tags,
    extra: stripPii(evt.extra),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    logger: 'sophia.forwarder',
  })

  // Sentry envelope format (replaces deprecated /store/ endpoint)
  // https://develop.sentry.dev/sdk/envelopes/
  const envelopeHeader = JSON.stringify({ dsn, sdk: { name: 'sophia-http-forwarder', version: '1' } })
  const itemHeader = JSON.stringify({ type: 'event', content_type: 'application/json' })
  const envelope = `${envelopeHeader}\n${itemHeader}\n${body}`

  try {
    if (!shouldAllowRequest('sentry')) {
      // Circuit open — fail-soft, don't block caller
      return
    }
    await fetch(`${endpoint}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': authHeader,
      },
      body: envelope,
      signal: AbortSignal.timeout(2000),
    })
    recordSuccess('sentry')
  } catch (error) {
    recordFailure('sentry', classifyError(error))
    // Fire-and-forget — silently discard
  }
}
