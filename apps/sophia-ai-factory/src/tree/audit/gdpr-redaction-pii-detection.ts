/**
 * GDPR PII Detection and Email Redaction Utilities
 *
 * Pattern matchers and redaction helpers extracted from gdpr-redaction.ts
 * to keep that module under 200 lines.
 *
 * @module audit/gdpr-redaction-pii-detection
 */

import { PII_PATTERNS, containsPII, redactEmail } from './gdpr-pii-patterns'

export { PII_PATTERNS, containsPII, redactEmail }

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Recursively redact PII from a JSON details object
 *
 * @param details - Arbitrary JSON value to sanitize
 * @returns Sanitized JSON value with PII replaced
 */
export function redactDetailsPII(details: Json): Json {
  if (details === null || details === undefined) {
    return null
  }

  if (typeof details === 'string') {
    if (PII_PATTERNS.email.test(details)) {
      return redactEmail(details)
    }
    return details
  }

  if (typeof details === 'number' || typeof details === 'boolean') {
    return details
  }

  if (Array.isArray(details)) {
    return details.map(item => redactDetailsPII(item ?? null))
  }

  // Object — check for known PII fields
  const redactedObj: Record<string, Json> = {}
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) {
      redactedObj[key] = null
      continue
    }
    if (typeof value === 'string') {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('email') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('ssn')
      ) {
        redactedObj[key] = '[REDACTED]'
      } else if (PII_PATTERNS.email.test(value)) {
        redactedObj[key] = redactEmail(value)
      } else {
        redactedObj[key] = value
      }
    } else {
      redactedObj[key] = redactDetailsPII(value ?? null)
    }
  }

  return redactedObj
}
