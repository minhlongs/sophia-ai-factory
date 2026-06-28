/**
 * Types for Violation Audit Logger
 * @module audit/violation-logger-types
 */

export interface ViolationAuditRow {
  id: string
  event_type: string
  user_id: string
  license_nonce: string
  receipt: string | Record<string, unknown>
  tier: string
  created_at: string
}

export interface ViolationAuditInsert {
  event_type: string
  user_id: string
  license_nonce: string
  receipt: string
  tier: string
}

export type ViolationType =
  | 'QUOTA_EXCEEDED'
  | 'REQUEST_THROTTLED'
  | 'OVERAGE_BILLED'
  | 'LICENSE_SUSPENDED'
  | 'QUOTA_ADJUSTED'
  | 'PAYMENT_CONFIRMED'

export interface ViolationEvent {
  type: ViolationType
  userId: string
  licenseNonce: string
  tier: string
  exceededType?: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  exceededLimit?: number
  exceededCurrent?: number
  exceededBy?: number
  requestedCredits?: number
  endpoint?: string
  ipAddress?: string
  userAgent?: string
  billable?: boolean
  pricePerCredit?: number
  totalCharge?: number
  auditReceiptId?: string
  overageEventId?: string
  metadata?: Record<string, unknown>
}

export interface ViolationFilters {
  userId?: string
  licenseNonce?: string
  type?: ViolationType
  startDate?: number
  endDate?: number
  limit?: number
}

export interface ViolationSummary {
  totalViolations: number
  byType: Record<string, number>
  byTier: Record<string, number>
  billableViolations: number
  totalBillableCredits: number
  topViolators: Array<{ userId: string; violationCount: number; billableCredits: number }>
}

export const VALID_VIOLATION_TYPES = new Set<string>([
  'QUOTA_EXCEEDED', 'REQUEST_THROTTLED', 'OVERAGE_BILLED',
  'LICENSE_SUSPENDED', 'QUOTA_ADJUSTED', 'PAYMENT_CONFIRMED',
])
