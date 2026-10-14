/**
 * Infrastructure, Audio, and Utility Provider Key Lookups
 *
 * Layer: tree/credentials/provider-key
 */

import { ByokKeyRotatedError, getUserCredential } from '@/tree/credentials/user-credentials-repo'
import type { GetKeyOptions, ProviderKeyResult } from './types'

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
      if (!(err instanceof ByokKeyRotatedError)) {
        throw err
      }
    }
    try {
      const openrouterKey = await getUserCredential(userId, 'openrouter')
      if (openrouterKey) return { key: openrouterKey, source: 'user' }
    } catch (err) {
      if (!(err instanceof ByokKeyRotatedError)) {
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
