/**
 * Crypto helpers for API Key Validator (format, generation, signing)
 * @module security/api-key-validator-crypto
 */

// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- mekong-exempt: security validators need audit/crypto-utils (tree) for HMAC operations
import { hmacSha256 } from '@/lib/audit/crypto-utils'
import { logger } from '@/lib/utils/logger-utility'

export const API_KEY_PREFIX = 'mk_'
export const KEY_ID_LENGTH = 16

export function getApiKeySecret(): string {
  const secret = process.env.API_KEY_SECRET || process.env.RAAS_API_KEY_SECRET
  if (!secret) {
    logger.warn('[API Key Validator] API_KEY_SECRET not set, using insecure default')
    return 'insecure-dev-secret-change-in-production'
  }
  return secret
}

export function generateKeyId(): string {
  const bytes = new Uint8Array(KEY_ID_LENGTH / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function validateApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  if (!key.startsWith(API_KEY_PREFIX)) return false
  const withoutPrefix = key.slice(API_KEY_PREFIX.length)
  const parts = withoutPrefix.split('_')
  if (parts.length !== 2) return false
  const [keyId, signature] = parts
  if (keyId.length !== KEY_ID_LENGTH) return false
  if (!/^[0-9a-f]+$/.test(keyId)) return false
  if (signature.length !== 64) return false
  if (!/^[0-9a-f]+$/.test(signature)) return false
  return true
}

export function extractKeyIdAndSignature(key: string): { keyId: string; signature: string } | null {
  if (!validateApiKeyFormat(key)) return null
  const withoutPrefix = key.slice(API_KEY_PREFIX.length)
  const [keyId, signature] = withoutPrefix.split('_')
  return { keyId, signature }
}

export function computeSignature(keyId: string): string {
  return hmacSha256(keyId, getApiKeySecret())
}
