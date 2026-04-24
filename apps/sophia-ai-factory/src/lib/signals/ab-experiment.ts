/**
 * A/B experiment variant assignment — sticky per distinct_id via EXPERIMENT_KV + cookie
 * Wraps feature-flags.ts; cookie ensures client/server variant agreement (no flicker)
 */

import { flag } from './feature-flags'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export type Variant = 'control' | string // 'treatment' | 'treatment_a' | 'treatment_b' etc.

interface AssignResult {
  variant: Variant
  /** Set-Cookie header value — apply to response if available */
  setCookieHeader: string
}

/**
 * Assign a sticky A/B variant for the given experiment + distinct_id.
 * Reads PostHog feature flag (60s KV cache) then persists in cookie.
 * Falls back to 'control' on any error.
 */
export async function assignVariant(
  experimentName: string,
  distinctId: string,
): Promise<AssignResult> {
  let variant: Variant = 'control'

  try {
    const raw = await flag(experimentName, distinctId)

    if (typeof raw === 'string' && raw.length > 0) {
      variant = raw
    } else if (raw === true) {
      variant = 'treatment'
    } else if (raw === false || raw === null) {
      variant = 'control'
    }
  } catch (err) {
    logger.warn('[signals] assignVariant flag lookup failed — defaulting to control', {
      experimentName,
      error: getErrorMessage(err),
    })
  }

  // Build secure cookie for client/server sync (HttpOnly prevents XSS read)
  const cookieName = `ab_${experimentName}`
  const setCookieHeader = [
    `${cookieName}=${variant}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ')

  return { variant, setCookieHeader }
}

/**
 * Read variant from request cookies (fast path — no KV/PostHog call).
 * Returns null if cookie not set (need full assignVariant call).
 */
export function readVariantFromCookie(
  cookies: Record<string, string>,
  experimentName: string,
): Variant | null {
  const cookieName = `ab_${experimentName}`
  return cookies[cookieName] ?? null
}
