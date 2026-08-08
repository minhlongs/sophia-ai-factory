/**
 * GDPR PII Detection and Email Redaction Utilities
 *
 * Pattern matchers and redaction helpers extracted from gdpr-redaction.ts
 * to keep that module under 200 lines.
 *
 * @module audit/gdpr-redaction-pii-detection
 */

import { logger } from '@/seed/utils/logger-utility'

/**
 * PII pattern matchers for detection
 */
export const PII_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  creditCard: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Check if data contains PII (email, phone, SSN, credit card patterns)
 *
 * @param data - String to check for PII
 * @returns true if PII patterns detected
 *
 * @example
 * containsPII('john@example.com')  // true
 * containsPII('regular text')      // false
 */
export function containsPII(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false
  }

  return (
    PII_PATTERNS.email.test(data) ||
    PII_PATTERNS.phone.test(data) ||
    PII_PATTERNS.ssn.test(data) ||
    PII_PATTERNS.creditCard.test(data)
  )
}

/**
 * Redact email address preserving domain for analytics
 * Format: "a***z@example.com" (first char + *** + last char before @)
 *
 * @param email - Email address to redact
 * @returns Redacted email string
 *
 * @example
 * redactEmail('john.doe@example.com')  // "j***e@example.com"
 * redactEmail('ab@test.org')           // "a***b@test.org"
 */
export function redactEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    logger.warn('Invalid email for redaction:', { email })
    return '[REDACTED]'
  }

  const atIndex = email.indexOf('@')
  if (atIndex === -1) {
    logger.warn('Invalid email format - no @ symbol:', { email })
    return '[REDACTED]'
  }

  const localPart = email.slice(0, atIndex)
  const domainPart = email.slice(atIndex)

  if (localPart.length === 0) {
    return '[REDACTED]'
  }

  if (localPart.length === 1) {
    return `${localPart}***${domainPart}`
  }

  const firstChar = localPart.charAt(0)
  const lastChar = localPart.charAt(localPart.length - 1)
  return `${firstChar}***${lastChar}${domainPart}`
}

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
