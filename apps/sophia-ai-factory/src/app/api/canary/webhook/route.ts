/**
 * Canary Webhook Endpoint
 * POST /api/canary/webhook
 *
 * Public diagnostic endpoint for SDK testing and monitoring.
 * Validates an incoming signed payload and returns verification details.
 * Does NOT return 401 on bad signature — reports result in body instead.
 *
 * Rate-limited: 10 req/min per IP via withRateLimit.
 *
 * Expected header: X-Sophia-Signature: t=<unix>,v1=<hmac-hex>
 * Optional legacy: bare 64-char hex (reports format='legacy')
 *
 * Response: {
 *   valid: boolean,
 *   format: 'unified' | 'legacy' | 'unknown',
 *   skewMs: number,
 *   ageMs: number,
 *   thresholds: { hmacMismatchRatePctMax: number, latencyP95MsMax: number },
 *   mismatchRate: { windowSec: number, total: number, mismatches: number, ratePct: number },
 *   breach: boolean,
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'
import { verifyWebhook } from '@/lib/webhooks/signature'
import { logger } from '@/seed/utils/logger-utility'

const SIG_HEADER = 'x-sophia-signature'
const CANARY_SECRET_ENV = 'CANARY_WEBHOOK_SECRET'
const MAX_AGE_SEC = 300

/** Alert thresholds exposed to external monitors (Better Stack / Pingdom). */
const THRESHOLDS = {
  /** Maximum acceptable HMAC-mismatch rate (%) over the rolling window. */
  hmacMismatchRatePctMax: 1.0,
  /** Maximum acceptable p95 latency in ms (self-reported via X-Request-Latency if present). */
  latencyP95MsMax: 500,
} as const

/**
 * Rolling 5-minute mismatch counter (in-memory, best-effort).
 * In a multi-worker Cloudflare environment each isolate maintains its own bucket —
 * sufficient for approximate alerting; a KV-backed counter would be more precise
 * but adds latency to the diagnostic endpoint.
 */
const WINDOW_SEC = 300 // 5 min

interface MismatchWindow {
  windowStart: number // unix seconds
  total: number
  mismatches: number
}

let mismatchWindow: MismatchWindow = { windowStart: 0, total: 0, mismatches: 0 }

/** Advance the window if the current 5-minute bucket has expired. */
function advanceWindowIfNeeded(nowSec: number): void {
  if (nowSec - mismatchWindow.windowStart >= WINDOW_SEC) {
    mismatchWindow = { windowStart: nowSec, total: 0, mismatches: 0 }
  }
}

/** Record a verification result into the rolling window. */
function recordVerification(valid: boolean): void {
  const nowSec = Math.floor(Date.now() / 1000)
  advanceWindowIfNeeded(nowSec)
  mismatchWindow.total += 1
  if (!valid) mismatchWindow.mismatches += 1
}

/** Compute current mismatch rate and breach status. */
function getMismatchRate(): { windowSec: number; total: number; mismatches: number; ratePct: number; breach: boolean } {
  const nowSec = Math.floor(Date.now() / 1000)
  advanceWindowIfNeeded(nowSec)
  const { total, mismatches } = mismatchWindow
  const ratePct = total > 0 ? (mismatches / total) * 100 : 0
  const breach = total >= 10 && ratePct > THRESHOLDS.hmacMismatchRatePctMax
  return { windowSec: WINDOW_SEC, total, mismatches, ratePct: Math.round(ratePct * 100) / 100, breach }
}

interface CanaryResponse {
  valid: boolean
  format: 'unified' | 'legacy' | 'unknown'
  skewMs: number
  ageMs: number
  thresholds: typeof THRESHOLDS
  mismatchRate: ReturnType<typeof getMismatchRate>
  breach: boolean
}

function parseTimestampFromHeader(header: string): number | null {
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const k = part.slice(0, eqIdx).trim()
    const v = part.slice(eqIdx + 1).trim()
    if (k === 't') {
      const ts = parseInt(v, 10)
      return isNaN(ts) ? null : ts
    }
  }
  return null
}

function detectFormat(signature: string): CanaryResponse['format'] {
  if (signature.includes('t=') && signature.includes('v1=')) return 'unified'
  if (/^[0-9a-f]{64}$/i.test(signature)) return 'legacy'
  return 'unknown'
}

async function handleCanaryWebhook(request: NextRequest): Promise<NextResponse> {
  const sigHeader = request.headers.get(SIG_HEADER)

  if (!sigHeader) {
    return NextResponse.json(
      { error: 'Missing X-Sophia-Signature header', code: 'MISSING_SIGNATURE' },
      { status: 400 }
    )
  }

  const secret = process.env[CANARY_SECRET_ENV]
  if (!secret) {
    logger.warn('[Canary Webhook] CANARY_WEBHOOK_SECRET not configured — using empty secret for diagnostic only')
  }

  const rawBody = await request.text()
  const format = detectFormat(sigHeader)
  const now = Math.floor(Date.now() / 1000)

  // Compute skew from header timestamp (unified format only)
  const headerTs = format === 'unified' ? parseTimestampFromHeader(sigHeader) : null
  const skewMs = headerTs !== null ? Math.abs(now - headerTs) * 1000 : 0
  const ageMs = headerTs !== null ? (now - headerTs) * 1000 : 0

  let valid = false

  if (format === 'unknown') {
    // Unknown format — can't verify; still record as mismatch for rate tracking
    recordVerification(false)
    const mismatchRate = getMismatchRate()
    const response: CanaryResponse = {
      valid: false,
      format,
      skewMs: 0,
      ageMs: 0,
      thresholds: THRESHOLDS,
      mismatchRate,
      breach: mismatchRate.breach,
    }
    return NextResponse.json(response)
  }

  if (format === 'legacy') {
    logger.warn('webhook_legacy_signature_used', {
      event: 'webhook_legacy_signature_used',
      sender: 'canary/webhook',
    })
  }

  if (secret) {
    try {
      valid = await verifyWebhook(rawBody, sigHeader, secret, {
        toleranceSec: MAX_AGE_SEC,
        acceptLegacy: true,
      })
    } catch {
      valid = false
    }
  }

  recordVerification(valid)
  const mismatchRate = getMismatchRate()

  const response: CanaryResponse = {
    valid,
    format,
    skewMs,
    ageMs,
    thresholds: THRESHOLDS,
    mismatchRate,
    breach: mismatchRate.breach,
  }
  return NextResponse.json(response)
}

export const POST = withRateLimit(handleCanaryWebhook, {
  config: { intervalMs: 60_000, maxRequests: 10 },
})

export const dynamic = 'force-dynamic'

// Exported for testing
export { getMismatchRate, recordVerification, THRESHOLDS, WINDOW_SEC }
