/**
 * API Key validators + barrel re-export of schemas
 * @module validation/services
 */

import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'
import type { ValidationResult } from './services-schemas'

export * from './services-schemas'

export async function validateOpenRouter(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('openrouter')) {
    return { valid: false, message: "Circuit breaker open for OpenRouter — try again later" }
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) { recordSuccess('openrouter'); return { valid: true, message: "Valid OpenRouter key", meta: await response.json() } }
    recordFailure('openrouter', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('openrouter', classifyError(error))
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

export async function validateElevenLabs(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('elevenlabs')) {
    return { valid: false, message: "Circuit breaker open for ElevenLabs — try again later" }
  }
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', { method: 'GET', headers: { 'xi-api-key': key } })
    if (response.status === 200) {
      recordSuccess('elevenlabs')
      const data = await response.json() as Record<string, unknown>
      return { valid: true, message: "Valid ElevenLabs key", meta: { tier: data['tier'] } }
    }
    recordFailure('elevenlabs', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('elevenlabs', classifyError(error))
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

export async function validateDID(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('did')) {
    return { valid: false, message: "Circuit breaker open for D-ID — try again later" }
  }
  try {
    const response = await fetch('https://api.d-id.com/credits', { method: 'GET', headers: { 'Authorization': `Basic ${key}` } })
    if (response.status === 401) {
      recordFailure('did', classifyError(new Error('HTTP 401')))
      return { valid: false, message: `Invalid key (Status: ${response.status})` }
    }
    if (response.status === 200) {
      recordSuccess('did')
      return { valid: true, message: "Valid D-ID key", meta: await response.json() }
    }
    recordFailure('did', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('did', classifyError(error))
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

export async function validateAirtable(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('airtable')) {
    return { valid: false, message: "Circuit breaker open for Airtable — try again later" }
  }
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) {
      recordSuccess('airtable')
      const data = await response.json() as Record<string, unknown>
      return { valid: true, message: "Valid Airtable key", meta: { id: data['id'], email: data['email'] } }
    }
    if (response.status === 403) {
      recordFailure('airtable', classifyError(new Error('HTTP 403')))
      return { valid: false, message: "Invalid Personal Access Token" }
    }
    recordFailure('airtable', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('airtable', classifyError(error))
    return { valid: false, message: `Network error validating PAT: ${getErrorMessage(error)}` }
  }
}

export async function validateHeyGen(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('heygen')) {
    return { valid: false, message: "Circuit breaker open for HeyGen — try again later" }
  }
  try {
    const response = await fetch('https://api.heygen.com/v2/user/remaining_quota', { method: 'GET', headers: { 'x-api-key': key } })
    if (response.status === 200) {
      recordSuccess('heygen')
      return { valid: true, message: "Valid HeyGen key", meta: await response.json() as Record<string, unknown> }
    }
    if (response.status === 401) {
      recordFailure('heygen', classifyError(new Error('HTTP 401')))
      return { valid: false, message: "Invalid HeyGen API key" }
    }
    recordFailure('heygen', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('heygen', classifyError(error))
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

export async function validateMuAPI(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest('muapi')) {
    return { valid: false, message: "Circuit breaker open for MuAPI — try again later" }
  }
  try {
    const response = await fetch('https://api.muapi.ai/v1/account', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) {
      recordSuccess('muapi')
      return { valid: true, message: "Valid MuAPI key", meta: await response.json() as Record<string, unknown> }
    }
    if (response.status === 401 || response.status === 403) {
      recordFailure('muapi', classifyError(new Error(`HTTP ${response.status}`)))
      return { valid: false, message: "Invalid MuAPI key" }
    }
    recordFailure('muapi', classifyError(new Error(`HTTP ${response.status}`)))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    recordFailure('muapi', classifyError(error))
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}
