/**
 * API Key Validator for RaaS Gateway Audit API
 *
 * Sub-modules:
 *   api-key-validator-types.ts  — ApiKeyInfo, ValidationResult, GenerateApiKeyResult, ApiKeyRow
 *   api-key-validator-crypto.ts — format validation, key generation, HMAC signing
 *   api-key-validator-db.ts     — generateApiKey, checkApiKey, revoke, list, delete
 *
 * @module security/api-key-validator
 */

export type { ApiKeyInfo, ValidationResult, GenerateApiKeyResult } from './api-key-validator-types'
export { validateApiKeyFormat, extractKeyIdAndSignature } from './api-key-validator-crypto'
export { generateApiKey, checkApiKey, revokeApiKey, getUserApiKeys, deleteApiKey } from './api-key-validator-db'

import { validateApiKeyFormat, extractKeyIdAndSignature } from '@/seed/security/api-key-validator-crypto'
import { checkApiKey } from '@/seed/security/api-key-validator-db'
import type { ValidationResult } from '@/seed/security/api-key-validator-types'

export async function validateApiKey(apiKey: string | null): Promise<ValidationResult> {
  if (!apiKey) return { valid: false, error: 'missing-key' }
  if (!validateApiKeyFormat(apiKey)) return { valid: false, error: 'invalid-format' }
  const extracted = extractKeyIdAndSignature(apiKey)
  if (!extracted) return { valid: false, error: 'invalid-format' }
  return checkApiKey(extracted.keyId, extracted.signature)
}
