/**
 * API Key validators + barrel re-export of schemas
 * @module validation/services
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { ValidationResult } from './services-schemas'

export * from './services-schemas'
export { validateAirtable, validateHeyGen, validateMuAPI } from './services-extended'

const OPENROUTER_SERVICE = 'openrouter-validator'

export async function validateOpenRouter(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(OPENROUTER_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) {
      recordSuccess(OPENROUTER_SERVICE)
      return { valid: true, message: "Valid OpenRouter key", meta: await response.json() }
    }
    recordFailure(OPENROUTER_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(OPENROUTER_SERVICE, kind)
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

const ELEVENLABS_SERVICE = 'elevenlabs-validator'

export async function validateElevenLabs(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(ELEVENLABS_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', { method: 'GET', headers: { 'xi-api-key': key } })
    if (response.status === 200) {
      recordSuccess(ELEVENLABS_SERVICE)
      const data = await response.json() as Record<string, unknown>
      return { valid: true, message: "Valid ElevenLabs key", meta: { tier: data['tier'] } }
    }
    recordFailure(ELEVENLABS_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(ELEVENLABS_SERVICE, kind)
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

const DID_SERVICE = 'd-id-validator'

export async function validateDID(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(DID_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://api.d-id.com/credits', { method: 'GET', headers: { 'Authorization': `Basic ${key}` } })
    if (response.status === 401) {
      recordFailure(DID_SERVICE, classifyHttpStatus(response.status))
      return { valid: false, message: `Invalid key (Status: ${response.status})` }
    }
    if (response.status === 200) {
      recordSuccess(DID_SERVICE)
      return { valid: true, message: "Valid D-ID key", meta: await response.json() }
    }
    recordFailure(DID_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(DID_SERVICE, kind)
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}
