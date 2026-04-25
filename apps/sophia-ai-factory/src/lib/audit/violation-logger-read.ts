/**
 * Read and analytics operations for Violation Audit Logger
 * @module audit/violation-logger-read
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import type { ViolationAuditRow, ViolationType, ViolationFilters, ViolationSummary } from './violation-logger-types'
import { VALID_VIOLATION_TYPES } from './violation-logger-types'

export async function getViolationHistory(filters: ViolationFilters): Promise<Array<{
  id: string; type: ViolationType; userId: string; licenseNonce: string; tier: string; createdAt: number; metadata: Record<string, unknown>
}>> {
  const db = createServerClient()
  const limit = filters.limit ?? 100
  let query = db.from<ViolationAuditRow>('audit_logs')
    .select('id, event_type, user_id, license_nonce, tier, receipt, created_at')
    .like('event_type', 'violation:%').order('created_at', { ascending: false }).limit(limit)

  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.licenseNonce) query = query.eq('license_nonce', filters.licenseNonce)
  if (filters.type) query = query.eq('event_type', `violation:${filters.type}`)
  if (filters.startDate) query = query.gte('created_at', filters.startDate)
  if (filters.endDate) query = query.lte('created_at', filters.endDate)

  const { data, error } = await query
  if (error) {
    logger.error('[Violation Logger] Failed to fetch violation history', new Error(error.message))
    return []
  }

  return (data || []).map((row: ViolationAuditRow) => {
    const receipt = typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt || {}
    const rawType = row.event_type?.replace('violation:', '') ?? ''
    const type: ViolationType = VALID_VIOLATION_TYPES.has(rawType) ? (rawType as ViolationType) : 'QUOTA_EXCEEDED'
    return { id: row.id, type, userId: row.user_id, licenseNonce: row.license_nonce, tier: row.tier, createdAt: typeof row.created_at === 'number' ? row.created_at : Number(row.created_at), metadata: receipt }
  })
}

export async function getViolationSummary(options: { startDate: number; endDate: number; limit?: number } = {
  startDate: Math.floor(Date.now() / 1000) - (30 * 86400),
  endDate: Math.floor(Date.now() / 1000), limit: 1000,
}): Promise<ViolationSummary> {
  const db = createServerClient()
  const { data } = await db.from<ViolationAuditRow>('audit_logs')
    .select('event_type, user_id, tier, receipt')
    .like('event_type', 'violation:%')
    .gte('created_at', options.startDate).lte('created_at', options.endDate).limit(options.limit ?? 1000)

  if (!data || data.length === 0) {
    return { totalViolations: 0, byType: {}, byTier: {}, billableViolations: 0, totalBillableCredits: 0, topViolators: [] }
  }

  const byType: Record<string, number> = {}
  const byTier: Record<string, number> = {}
  const userViolations = new Map<string, { count: number; billableCredits: number }>()
  let billableViolations = 0
  let totalBillableCredits = 0

  for (const row of data) {
    const type = row.event_type?.replace('violation:', '') || 'UNKNOWN'
    byType[type] = (byType[type] || 0) + 1
    const tier = row.tier || 'UNKNOWN'
    byTier[tier] = (byTier[tier] || 0) + 1
    const receipt = typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt || {}
    const userId = row.user_id || 'unknown'
    const existing = userViolations.get(userId) || { count: 0, billableCredits: 0 }
    existing.count += 1
    if (receipt.billable && receipt.exceeded_by) {
      existing.billableCredits += receipt.exceeded_by || 0
      billableViolations += 1
      totalBillableCredits += receipt.exceeded_by || 0
    }
    userViolations.set(userId, existing)
  }

  const topViolators = Array.from(userViolations.entries())
    .map(([userId, d]) => ({ userId, violationCount: d.count, billableCredits: d.billableCredits }))
    .sort((a, b) => b.billableCredits - a.billableCredits).slice(0, 10)

  return { totalViolations: data.length, byType, byTier, billableViolations, totalBillableCredits, topViolators }
}
