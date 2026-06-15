/**
 * Smart provider key lookup for fulfillment paths.
 *
 * Resolution order per provider:
 * 1. userId provided -> try user_provider_credentials (getUserCredential)
 * 2. Not found AND fallbackToPlatform=true -> process.env platform key
 * 3. Neither -> null
 *
 * Returns { key, source: 'user' | 'platform' } so callers can log the source
 * and enforce "user MUST have own key" for customer fulfillment.
 *
 * Platform fallback is intentional ONLY for:
 * - Synthetic monitor (BYOK disabled)
 * - Health checks (no userId)
 * - Onboarding welcome video (before user purchase)
 * - Transactional emails (Resend fallback always on)
 *
 * @module lib/credentials/get-provider-key */
import { ByokKeyRotatedError, getUserCredential } from '@/tree/credentials/user-credentials-repo'

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
    try {
      const userKey = await getUserCredential(userId, 'heygen')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      // M11: key rotated during active job - fall through to platform/null
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
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
    try {
      const userKey = await getUserCredential(userId, 'resend')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      // M11: key rotated during active job - fall through to platform/null
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.RESEND_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }
  return null
}

/**
 * Resolve Kling (fal.ai) API key.
 * Default: fallbackToPlatform = false (customer fulfillment must use own key).
 */
export async function getKlingKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = false } = opts

  if (userId) {
    try {
      const userKey = await getUserCredential(userId, 'kling')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      // M11: key rotated during active job - fall through to platform/null
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.KLING_API_KEY
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
    try {
      const userKey = await getUserCredential(userId, 'nowpayments')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      // M11: key rotated during active job - fall through to platform/null
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.NOWPAYMENTS_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }
  return null
}

/**
 * Resolve AssemblyAI API key.
 * Default: fallbackToPlatform = false (BYOK-required - customer must provide own key).
 */
export async function getAssemblyAIKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = false } = opts

  if (userId) {
    try {
      const userKey = await getUserCredential(userId, 'assemblyai')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      // M11: key rotated during active job - fall through to platform/null
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.ASSEMBLYAI_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }
  return null
}

/**
 * Resolve OpenAI API key for thumbnail generation (gpt-image-1).
 *
 * Resolution order:
 * 1. User stored 'openai' credential (BYOK - preferred)
 * 2. User stored 'openrouter' credential (can proxy OpenAI image gen)
 * 3. Platform env OPENAI_API_KEY (only if fallbackToPlatform = true)
 *
 * Default: fallbackToPlatform = false (customer fulfillment must use own key).
 */
export async function getThumbnailKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = false } = opts

  if (userId) {
    try {
      const openaiKey = await getUserCredential(userId, 'openai')
      if (openaiKey) return { key: openaiKey, source: 'user' }
    } catch (err) {
      // M11: key rotated - try openrouter fallback, then platform
      if (err instanceof ByokKeyRotatedError) {
        // Fall through to openrouter attempt below
      } else {
        throw err
      }
    }
    try {
      const openrouterKey = await getUserCredential(userId, 'openrouter')
      if (openrouterKey) return { key: openrouterKey, source: 'user' }
    } catch (err) {
      if (err instanceof ByokKeyRotatedError) {
        // Both openai and openrouter keys rotated - fall through to platform
      } else {
        throw err
      }
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.OPENAI_API_KEY
    if (envKey) return { key: envKey, source: 'platform' }
  }
  return null
}
