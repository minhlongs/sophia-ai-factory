/**
 * Video Generation and Fulfillment Provider Key Lookups
 *
 * Layer: tree/credentials/provider-key
 */

import { ByokKeyRotatedError, getUserCredential } from '@/tree/credentials/user-credentials-repo'
import type { GetKeyOptions, ProviderKeyResult } from './types'

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
 * Resolve Replicate API key.
 * Default: fallbackToPlatform = false (customer fulfillment must use own key).
 */
export async function getReplicateKey(
  opts: GetKeyOptions = {},
): Promise<ProviderKeyResult | null> {
  const { userId, fallbackToPlatform = false } = opts

  if (userId) {
    try {
      const userKey = await getUserCredential(userId, 'replicate')
      if (userKey) return { key: userKey, source: 'user' }
    } catch (err) {
      if (err instanceof ByokKeyRotatedError) return null
      throw err
    }
  }

  if (fallbackToPlatform) {
    const envKey = process.env.REPLICATE_API_TOKEN
    if (envKey) return { key: envKey, source: 'platform' }
  }
  return null
}
