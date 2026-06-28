/**
 * Types for Overage Event Logger
 * @module quota/overage-logger-types
 */

export interface OverageEventInput {
  userId: string
  licenseNonce: string
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  exceededLimit: number
  exceededCurrent: number
  exceededBy: number
  requestedCredits: number
  tier: string
  endpoint?: string
  service?: string
  action?: string
  ipAddress?: string
  userAgent?: string
  externalCustomerId?: string
}
