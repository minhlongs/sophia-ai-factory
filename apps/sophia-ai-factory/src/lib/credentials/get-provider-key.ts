/**
 * Smart provider key lookup for fulfillment paths.
 *
 * Resolution order per provider:
 *   1. userId provided -> try user_provider_credentials (getUserCredential)
 *   2. Not found AND fallbackToPlatform=true -> process.env platform key
 *   3. Neither -> null
 *
 * Returns { key, source: 'user' | 'platform' } so callers can log the source
 * and enforce "user MUST have own key" for customer fulfillment.
 *
 * Platform fallback is intentional ONLY for:
 *   - Synthetic monitor (BYOK disabled)
 *   - Health checks (no userId)
 *   - Onboarding welcome video (before user purchase)
 *   - Transactional emails (Resend fallback always on)
 *
 * @module lib/credentials/get-provider-key
 */

import { getUserCredential } from './user-credentials-repo'

export interface ProviderKeyResult {
  key: string
  source: 'user' | 'platform'
}

export interface GetKeyOptions {
  userId?: string
  fallbackToPlatform?: boolean
}

/**
 * Resolve HeyGen API key.
 * Default: fallbackToPlatform = false (customer fulfillment must use own key).
 */
export async function getHeyGenKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = false } = opts

  if (userId) {
    const userKey = await getUserCredential(userId, 'heygen')
    if (userKey) return { key: userKey, source: 'user' }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.HEYGEN_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }

  return null
}

/**
 * Resolve Resend API key.
 * Default: fallbackToPlatform = true (transactional emails always work).
 */
export async function getResendKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = true } = opts

  if (userId) {
    const userKey = await getUserCredential(userId, 'resend')
    if (userKey) return { key: userKey, source: 'user' }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.RESEND_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }

  return null
}

/**
 * Resolve NOWPayments API key.
 * Default: fallbackToPlatform = true (single payment provider for MVP).
 */
export async function getNowPaymentsKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = true } = opts

  if (userId) {
    const userKey = await getUserCredential(userId, 'nowpayments')
    if (userKey) return { key: userKey, source: 'user' }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.NOWPAYMENTS_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }

  return null
}
