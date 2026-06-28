/**
 * API Key validators + barrel re-export of schemas
 * @module validation/services
 */

import { getErrorMessage } from '@/seed/utils/to-error'
import type { ValidationResult } from './services-schemas'

export * from './services-schemas'

export async function validateOpenRouter(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) return { valid: true, message: "Valid OpenRouter key", meta: await response.json() }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error: ${getErrorMessage(error)}` } }
}

export async function validateElevenLabs(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', { method: 'GET', headers: { 'xi-api-key': key } })
    if (response.status === 200) { const data = await response.json() as Record<string, unknown>; return { valid: true, message: "Valid ElevenLabs key", meta: { tier: data['tier'] } } }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error: ${getErrorMessage(error)}` } }
}

export async function validateDID(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://api.d-id.com/credits', { method: 'GET', headers: { 'Authorization': `Basic ${key}` } })
    if (response.status === 401) return { valid: false, message: `Invalid key (Status: ${response.status})` }
    if (response.status === 200) return { valid: true, message: "Valid D-ID key", meta: await response.json() }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error: ${getErrorMessage(error)}` } }
}

export async function validateAirtable(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) { const data = await response.json() as Record<string, unknown>; return { valid: true, message: "Valid Airtable key", meta: { id: data['id'], email: data['email'] } } }
    if (response.status === 403) return { valid: false, message: "Invalid Personal Access Token" }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error validating PAT: ${getErrorMessage(error)}` } }
}

export async function validateHeyGen(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://api.heygen.com/v2/user/remaining_quota', { method: 'GET', headers: { 'x-api-key': key } })
    if (response.status === 200) return { valid: true, message: "Valid HeyGen key", meta: await response.json() as Record<string, unknown> }
    if (response.status === 401) return { valid: false, message: "Invalid HeyGen API key" }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error: ${getErrorMessage(error)}` } }
}

export async function validateMuAPI(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" }
  try {
    const response = await fetch('https://api.muapi.ai/v1/account', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
    if (response.status === 200) return { valid: true, message: "Valid MuAPI key", meta: await response.json() as Record<string, unknown> }
    if (response.status === 401 || response.status === 403) return { valid: false, message: "Invalid MuAPI key" }
    return { valid: false, message: `Invalid key (Status: ${response.status})` }
  } catch (error) { return { valid: false, message: `Network error: ${getErrorMessage(error)}` } }
}
