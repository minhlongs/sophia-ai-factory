/**
 * API Key validators for Airtable, HeyGen, and MuAPI
 * @module seed/validation/services-extended
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { ValidationResult } from './services-schemas'

const AIRTABLE_SERVICE = 'airtable-validator'

export async function validateAirtable(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(AIRTABLE_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) {
      recordSuccess(AIRTABLE_SERVICE)
      const data = await response.json() as Record<string, unknown>
      return { valid: true, message: "Valid Airtable key", meta: { id: data['id'], email: data['email'] } }
    }
    if (response.status === 403) {
      recordFailure(AIRTABLE_SERVICE, classifyHttpStatus(response.status))
      return { valid: false, message: "Invalid Personal Access Token" }
    }
    recordFailure(AIRTABLE_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(AIRTABLE_SERVICE, kind)
    return { valid: false, message: `Network error validating PAT: ${getErrorMessage(error)}` }
  }
}

const HEYGEN_SERVICE = 'heygen-validator'

export async function validateHeyGen(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(HEYGEN_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://api.heygen.com/v2/user/remaining_quota', { method: 'GET', headers: { 'x-api-key': key } })
    if (response.status === 200) {
      recordSuccess(HEYGEN_SERVICE)
      return { valid: true, message: "Valid HeyGen key", meta: await response.json() as Record<string, unknown> }
    }
    if (response.status === 401) {
      recordFailure(HEYGEN_SERVICE, classifyHttpStatus(response.status))
      return { valid: false, message: "Invalid HeyGen API key" }
    }
    recordFailure(HEYGEN_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(HEYGEN_SERVICE, kind)
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}

const MUAPI_SERVICE = 'muapi-validator'

export async function validateMuAPI(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  if (!shouldAllowRequest(MUAPI_SERVICE)) {
    return { valid: false, message: 'Service temporarily unavailable (circuit open)' }
  }
  try {
    const response = await fetch('https://api.muapi.ai/v1/account', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) {
      recordSuccess(MUAPI_SERVICE)
      return { valid: true, message: "Valid MuAPI key", meta: await response.json() as Record<string, unknown> }
    }
    if (response.status === 401 || response.status === 403) {
      recordFailure(MUAPI_SERVICE, classifyHttpStatus(response.status))
      return { valid: false, message: "Invalid MuAPI key" }
    }
    recordFailure(MUAPI_SERVICE, classifyHttpStatus(response.status))
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) {
    const kind = classifyError(error)
    recordFailure(MUAPI_SERVICE, kind)
    return { valid: false, message: `Network error: ${getErrorMessage(error)}` }
  }
}
