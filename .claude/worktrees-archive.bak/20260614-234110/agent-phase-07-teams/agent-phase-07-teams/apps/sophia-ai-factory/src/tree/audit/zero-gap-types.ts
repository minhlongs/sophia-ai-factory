/**
 * Zero-GAP Audit Types
 * Shared types for the audit runner system.
 *
 * @module lib/audit/zero-gap-types
 */

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  id: string
  category: string
  name: string
  status: CheckStatus
  /** Weight 1-10 for score calculation */
  weight: number
  /** Numeric score for this check (0=fail, 0.5=warn, 1=pass) */
  score: number
  evidence: string
  fix?: string
  durationMs: number
}

export interface AuditRunSummary {
  id: string
  triggeredByUserId: string
  startedAt: number
  completedAt?: number
  totalScore: number
  totalChecks: number
  passed: number
  warned: number
  failed: number
  results: CheckResult[]
}

export type CheckRunner = (env: AuditEnv) => Promise<CheckResult[]>

export interface AuditEnv {
  PROD_URL: string
  HEYGEN_API_KEY?: string
  RESEND_API_KEY?: string
  NOWPAYMENTS_API_KEY?: string
  SUPABASE_SERVICE_KEY?: string
  CRON_SECRET?: string
  d1: D1Database
}
