/**
 * API Key Validator for RaaS Gateway Audit API
 *
 * Handles mk_ API key generation, validation, and management.
 * Format: mk_{keyId}_{hmacSignature}
 *
 * @module security/api-key-validator
 */

import { createServerClient } from '@/lib/db/client'
import { hmacSha256, timingSafeEqual } from '@/lib/audit/crypto-utils'
import { logger } from '@/lib/utils/logger-utility'
import type { Json } from '@/lib/supabase/types'

/**
 * API Key information stored in database
 */
export interface ApiKeyInfo {
  keyId: string
  keyPrefix: string // First 8 chars of mk_...
  ownerId: string
  permissions: string[] // ['audit:read', 'audit:write', 'reports:download']
  createdAt: number
  expiresAt?: number
  lastUsedAt?: number
  rateLimitPerMinute: number
}

/**
 * Validation result for API key checks
 */
export interface ValidationResult {
  valid: boolean
  error?: 'missing-key' | 'invalid-format' | 'expired' | 'revoked' | 'rate-limited' | 'not-found'
  apiKey?: ApiKeyInfo
}

/**
 * Generated API key response
 */
export interface GenerateApiKeyResult {
  apiKey: string
  keyId: string
  keyPrefix: string
}

/**
 * API Key format: mk_{keyId}_{hmacSignature}
 * - keyId: 16-char random hex (8 bytes)
 * - hmacSignature: HMAC-SHA256 of keyId using secret
 */
const API_KEY_PREFIX = 'mk_'
const KEY_ID_LENGTH = 16 // 16 hex chars = 8 bytes

/**
 * Get HMAC secret for API key signing
 * Falls back to a default for development (should be set in production)
 */
function getApiKeySecret(): string {
  const secret = process.env.API_KEY_SECRET || process.env.RAAS_API_KEY_SECRET
  if (!secret) {
    logger.warn('[API Key Validator] API_KEY_SECRET not set, using insecure default')
    return 'insecure-dev-secret-change-in-production'
  }
  return secret
}

/**
 * Generate a random hex string for keyId
 */
function generateKeyId(): string {
  const bytes = new Uint8Array(KEY_ID_LENGTH / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validate mk_ API key format
 * Format: mk_{keyId}_{hmacSignature}
 *
 * @param key - API key to validate
 * @returns true if format is valid
 */
export function validateApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false
  }

  // Check prefix
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false
  }

  // Remove prefix and split
  const withoutPrefix = key.slice(API_KEY_PREFIX.length)
  const parts = withoutPrefix.split('_')

  // Must have exactly 2 parts: keyId and signature
  if (parts.length !== 2) {
    return false
  }

  const [keyId, signature] = parts

  // keyId must be exactly KEY_ID_LENGTH hex chars
  if (keyId.length !== KEY_ID_LENGTH) {
    return false
  }

  // keyId must be valid hex
  if (!/^[0-9a-f]+$/.test(keyId)) {
    return false
  }

  // Signature must be 64 hex chars (SHA256)
  if (signature.length !== 64) {
    return false
  }

  // Signature must be valid hex
  if (!/^[0-9a-f]+$/.test(signature)) {
    return false
  }

  return true
}

/**
 * Extract keyId and signature from API key
 * Does NOT validate the signature - use checkApiKey for that
 */
export function extractKeyIdAndSignature(key: string): { keyId: string; signature: string } | null {
  if (!validateApiKeyFormat(key)) {
    return null
  }

  const withoutPrefix = key.slice(API_KEY_PREFIX.length)
  const [keyId, signature] = withoutPrefix.split('_')

  return { keyId, signature }
}

/**
 * Compute expected HMAC signature for a keyId
 */
function computeSignature(keyId: string): string {
  const secret = getApiKeySecret()
  return hmacSha256(keyId, secret)
}

/**
 * Generate new API key for user
 *
 * @param userId - User ID who owns this key
 * @param permissions - Array of permissions (e.g., ['audit:read', 'audit:write'])
 * @param expiresAt - Optional expiration timestamp (ms)
 * @param rateLimitPerMinute - Rate limit (default 100)
 * @returns Generated API key and metadata
 */
export async function generateApiKey(
  userId: string,
  permissions: string[],
  expiresAt?: number,
  rateLimitPerMinute: number = 100
): Promise<GenerateApiKeyResult> {
  const db = createServerClient()

  // Generate keyId and compute signature
  const keyId = generateKeyId()
  const signature = computeSignature(keyId)

  // Full API key to return to user (only time signature is visible)
  const apiKey = `${API_KEY_PREFIX}${keyId}_${signature}`

  // Key prefix for display/logging (first 8 chars)
  const keyPrefix = apiKey.slice(0, 8)

  // Hash the full key for storage (never store plain key)
  const keyHash = hmacSha256(apiKey, getApiKeySecret() + '_storage')

  // Insert into database
  const insertData = {
    key_id: keyId,
    key_hash: keyHash,
    owner_id: userId,
    permissions: JSON.stringify(permissions),
    expires_at: expiresAt ? Math.floor(expiresAt / 1000) : null,
    rate_limit_per_min: rateLimitPerMinute,
  }

  const { data, error } = await (db as any)
    .from('raas_api_keys')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    logger.error('[API Key Validator] Failed to generate API key', error as Error)
    throw new Error(`Failed to generate API key: ${(error as Error).message}`)
  }

  logger.info('[API Key Validator] Generated new API key', {
    keyId,
    keyPrefix,
    ownerId: userId,
    permissions,
    expiresAt,
  })

  return {
    apiKey,
    keyId,
    keyPrefix,
  }
}

/**
 * Check API key against database
 * Validates signature and checks expiration/revocation status
 *
 * @param keyId - Key ID extracted from API key
 * @param signature - Signature to verify
 * @returns Validation result with API key info if valid
 */
export async function checkApiKey(
  keyId: string,
  signature: string
): Promise<ValidationResult> {
  const db = createServerClient()

  // First verify signature locally (fast path)
  const expectedSignature = computeSignature(keyId)

  if (!timingSafeEqual(signature, expectedSignature)) {
    return {
      valid: false,
      error: 'invalid-format',
    }
  }

  // Look up in database
  const { data, error } = await (db as any)
    .from('raas_api_keys')
    .select('id, key_id, key_hash, owner_id, permissions, created_at, expires_at, revoked_at, last_used_at, rate_limit_per_min')
    .eq('key_id', keyId)
    .single()

  if (error || !data) {
    return {
      valid: false,
      error: 'not-found',
    }
  }

  // Check if revoked
  if (data.revoked_at) {
    return {
      valid: false,
      error: 'revoked',
    }
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (data.expires_at && data.expires_at < now) {
    return {
      valid: false,
      error: 'expired',
    }
  }

  // Update last_used_at for active key
  await (db as any)
    .from('raas_api_keys')
    .update({ last_used_at: now })
    .eq('id', data.id)

  return {
    valid: true,
    apiKey: {
      keyId: data.key_id,
      keyPrefix: (API_KEY_PREFIX + data.key_id).slice(0, 8),
      ownerId: data.owner_id,
      permissions: data.permissions as string[],
      createdAt: data.created_at,
      expiresAt: data.expires_at ? data.expires_at * 1000 : undefined,
      lastUsedAt: data.last_used_at ? data.last_used_at * 1000 : undefined,
      rateLimitPerMinute: data.rate_limit_per_min || 100,
    },
  }
}

/**
 * Validate full API key (format + database check)
 *
 * @param apiKey - Full API key from X-API-Key header
 * @returns Validation result
 */
export async function validateApiKey(apiKey: string | null): Promise<ValidationResult> {
  if (!apiKey) {
    return {
      valid: false,
      error: 'missing-key',
    }
  }

  // Check format first
  if (!validateApiKeyFormat(apiKey)) {
    return {
      valid: false,
      error: 'invalid-format',
    }
  }

  // Extract and verify
  const extracted = extractKeyIdAndSignature(apiKey)
  if (!extracted) {
    return {
      valid: false,
      error: 'invalid-format',
    }
  }

  return checkApiKey(extracted.keyId, extracted.signature)
}

/**
 * Revoke API key by keyId
 *
 * @param keyId - Key ID to revoke
 * @returns true if successful
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  const { error } = await (db as any)
    .from('raas_api_keys')
    .update({ revoked_at: now })
    .eq('key_id', keyId)

  if (error) {
    logger.error('[API Key Validator] Failed to revoke API key', error as Error)
    return false
  }

  logger.info('[API Key Validator] Revoked API key', { keyId })
  return true
}

/**
 * Get all API keys for a user
 *
 * @param userId - User ID
 * @returns Array of API key info (without secrets)
 */
export async function getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const db = createServerClient()

  const { data, error } = await (db as any)
    .from('raas_api_keys')
    .select('id, key_id, owner_id, permissions, created_at, expires_at, revoked_at, last_used_at, rate_limit_per_min')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[API Key Validator] Failed to fetch user API keys', error as Error)
    return []
  }

  interface ApiKeyRow {
    key_id: string;
    owner_id: string;
    permissions: string[];
    created_at: string;
    expires_at: number | null;
    last_used_at: number | null;
    rate_limit_per_min: number | null;
  }

  return data.map((row: ApiKeyRow) => ({
    keyId: row.key_id,
    keyPrefix: (API_KEY_PREFIX + row.key_id).slice(0, 8),
    ownerId: row.owner_id,
    permissions: row.permissions as string[],
    createdAt: row.created_at,
    expiresAt: row.expires_at ? row.expires_at * 1000 : undefined,
    lastUsedAt: row.last_used_at ? row.last_used_at * 1000 : undefined,
    rateLimitPerMinute: row.rate_limit_per_min || 100,
  }))
}

/**
 * Delete API key by keyId (permanent deletion)
 *
 * @param keyId - Key ID to delete
 * @returns true if successful
 */
export async function deleteApiKey(keyId: string): Promise<boolean> {
  const db = createServerClient()

  const { error } = await (db as any)
    .from('raas_api_keys')
    .delete()
    .eq('key_id', keyId)

  if (error) {
    logger.error('[API Key Validator] Failed to delete API key', error as Error)
    return false
  }

  logger.info('[API Key Validator] Deleted API key', { keyId })
  return true
}
