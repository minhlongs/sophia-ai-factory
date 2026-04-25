/**
 * DB operations for API Key Validator (generate, check, revoke, list, delete)
 * @module security/api-key-validator-db
 */

import { createServerClient } from '@/lib/db/client'
import { timingSafeEqual } from '@/lib/audit/crypto-utils'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import {
  API_KEY_PREFIX, getApiKeySecret, generateKeyId, computeSignature,
} from './api-key-validator-crypto'
import type { ApiKeyRow, ApiKeyInfo, ValidationResult, GenerateApiKeyResult } from './api-key-validator-types'
import { hmacSha256 } from '@/lib/audit/crypto-utils'

export async function generateApiKey(
  userId: string,
  permissions: string[],
  expiresAt?: number,
  rateLimitPerMinute: number = 100,
): Promise<GenerateApiKeyResult> {
  const db = createServerClient()
  const keyId = generateKeyId()
  const signature = computeSignature(keyId)
  const apiKey = `${API_KEY_PREFIX}${keyId}_${signature}`
  const keyPrefix = apiKey.slice(0, 8)
  const keyHash = hmacSha256(apiKey, getApiKeySecret() + '_storage')
  const { error } = await db.from('raas_api_keys').insert({
    id: keyId, key_hash: keyHash, key_prefix: keyPrefix, org_id: userId,
    permissions: JSON.stringify(permissions),
    expires_at: expiresAt ? Math.floor(expiresAt / 1000) : null,
    rate_limit_per_minute: rateLimitPerMinute, is_active: 1,
  })
  if (error) {
    logger.error('[API Key Validator] Failed to generate API key', toError(error))
    throw new Error(`Failed to generate API key: ${toError(error).message}`)
  }
  logger.info('[API Key Validator] Generated new API key', { keyId, keyPrefix, orgId: userId, permissions, expiresAt })
  return { apiKey, keyId, keyPrefix }
}

function parsePermissions(raw: string[] | string): string[] {
  return Array.isArray(raw) ? raw : (JSON.parse(raw as string) as string[])
}

function rowToApiKeyInfo(row: ApiKeyRow): ApiKeyInfo {
  const prefix = row.key_prefix || (API_KEY_PREFIX + row.id).slice(0, 8)
  return {
    id: row.id, keyId: row.id, keyPrefix: prefix, orgId: row.org_id, ownerId: row.org_id,
    permissions: parsePermissions(row.permissions),
    createdAt: row.created_at,
    expiresAt: row.expires_at ? row.expires_at * 1000 : undefined,
    lastUsedAt: row.last_used_at ? row.last_used_at * 1000 : undefined,
    rateLimitPerMinute: row.rate_limit_per_minute || 100,
    isActive: row.is_active === 1,
  }
}

export async function checkApiKey(keyId: string, signature: string): Promise<ValidationResult> {
  const db = createServerClient()
  if (!timingSafeEqual(signature, computeSignature(keyId))) {
    return { valid: false, error: 'invalid-format' }
  }
  const { data, error } = await db
    .from<ApiKeyRow>('raas_api_keys')
    .select('id, org_id, key_hash, key_prefix, permissions, created_at, expires_at, is_active, last_used_at, rate_limit_per_minute')
    .eq('id', keyId)
    .single()
  if (error || !data) return { valid: false, error: 'not-found' }
  if (data.is_active !== 1) return { valid: false, error: 'revoked' }
  const now = Math.floor(Date.now() / 1000)
  if (data.expires_at && data.expires_at < now) return { valid: false, error: 'expired' }
  await db.from('raas_api_keys').update({ last_used_at: now }).eq('id', data.id)
  return { valid: true, apiKey: rowToApiKeyInfo(data) }
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)
  const { error } = await db.from('raas_api_keys').update({ is_active: 0, expires_at: now }).eq('id', keyId)
  if (error) { logger.error('[API Key Validator] Failed to revoke API key', toError(error)); return false }
  logger.info('[API Key Validator] Revoked API key', { keyId })
  return true
}

export async function getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from<ApiKeyRow>('raas_api_keys')
    .select('id, org_id, key_prefix, permissions, created_at, expires_at, is_active, last_used_at, rate_limit_per_minute')
    .eq('org_id', userId)
    .order('created_at', { ascending: false })
  if (error) { logger.error('[API Key Validator] Failed to fetch user API keys', toError(error)); return [] }
  return ((data ?? []) as ApiKeyRow[]).map(rowToApiKeyInfo)
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const db = createServerClient()
  const { error } = await db.from('raas_api_keys').delete().eq('id', keyId)
  if (error) { logger.error('[API Key Validator] Failed to delete API key', toError(error)); return false }
  logger.info('[API Key Validator] Deleted API key', { keyId })
  return true
}
