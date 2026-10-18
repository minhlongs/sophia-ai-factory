/**
 * GDPR PII Pattern Matchers and Email Redaction Helper
 *
 * @module audit/gdpr-pii-patterns
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

/**
 * Check if data contains PII (email, phone, SSN, credit card patterns)
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
