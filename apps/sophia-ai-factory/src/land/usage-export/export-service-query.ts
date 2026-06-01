/**
 * DB query and aggregation helpers for Usage Export Service
 * @module usage-export/export-service-query
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { UsageEventRow } from '../supabase/types'
import type { UsageExportRecord, UsageExportSummary, BillingPeriod } from './types'
import type { GetUsageExportParams } from './export-service-params'

export function getDateRange(
  billingPeriod: BillingPeriod,
  startDate?: number | null,
  endDate?: number | null,
): { periodStart: number; periodEnd: number } {
  const now = Math.floor(Date.now() / 1000)
  if (billingPeriod === 'custom') {
    if (!startDate || !endDate) throw new Error('startDate and endDate are required for custom billing period')
    return { periodStart: startDate, periodEnd: endDate }
  }
  if (billingPeriod === 'monthly') {
    const d = new Date()
    return {
      periodStart: Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000),
      periodEnd: Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000),
    }
  }
  return { periodStart: now - 7 * 24 * 60 * 60, periodEnd: now }
}

export function mapToExportRecord(row: UsageEventRow): UsageExportRecord {
  return {
    id: row.id || crypto.randomUUID(),
    tenant_id: row.user_id,
    feature_key: `${row.service_name}.${row.action}`,
    quantity: row.credits_used,
    timestamp: row.created_at,
    license_nonce: row.license_nonce,
    service: row.service_name,
    action: row.action,
    tokens_input: row.tokens_input || 0,
    tokens_output: row.tokens_output || 0,
    request_count: 1,
    status: row.status_code && row.status_code >= 200 && row.status_code < 300 ? 'success' : 'error',
    response_time_ms: row.response_time_ms || null,
    external_customer_id: row.external_customer_id || null,
  }
}

export function calculateSummary(records: UsageExportRecord[]): UsageExportSummary {
  const summary: UsageExportSummary = {
    totalRequests: 0, totalCredits: 0, totalTokensInput: 0, totalTokensOutput: 0, byService: {},
  }
  for (const record of records) {
    summary.totalRequests++
    summary.totalCredits += record.quantity
    summary.totalTokensInput += record.tokens_input
    summary.totalTokensOutput += record.tokens_output
    if (!summary.byService[record.service]) {
      summary.byService[record.service] = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0 }
    }
    summary.byService[record.service].requests++
    summary.byService[record.service].credits += record.quantity
    summary.byService[record.service].tokensInput += record.tokens_input
    summary.byService[record.service].tokensOutput += record.tokens_output
  }
  return summary
}

export async function getUsageExportData(params: GetUsageExportParams): Promise<{
  records: UsageExportRecord[];
  totalCount: number;
  pagination: { currentPage: number; totalPages: number; pageSize: number; totalRecords: number; hasNextPage: boolean; hasPreviousPage: boolean };
  periodStart: number;
  periodEnd: number;
}> {
  const { page = 1, pageSize = 100 } = params
  logger.info('[UsageExport] Querying usage data', {
    billingPeriod: params.billingPeriod, externalCustomerId: params.externalCustomerId,
    service: params.service, page, pageSize,
  })
  try {
    const { periodStart, periodEnd } = getDateRange(params.billingPeriod, params.startDate, params.endDate)
    const db = createServerClient()
    let query = db
      .from('usage_events')
      .select('*', { count: 'exact' })
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
    if (params.externalCustomerId) query = query.eq('external_customer_id', params.externalCustomerId)
    if (params.service) query = query.eq('service_name', params.service)
    if (params.licenseNonce) query = query.eq('license_nonce', params.licenseNonce)
    const { data: rows, error, count } = await query
    if (error) {
      logger.error('[UsageExport] Database query failed', toError(error), { billingPeriod: params.billingPeriod })
      throw new Error(`Database query failed: ${error.message}`)
    }
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / pageSize)
    const records = ((rows || []) as unknown as UsageEventRow[]).map((row: UsageEventRow) => mapToExportRecord(row))
    logger.info('[UsageExport] Query completed', { totalRecords: totalCount, returnedRecords: records.length, totalPages })
    return {
      records, totalCount,
      pagination: {
        currentPage: page, totalPages, pageSize, totalRecords: totalCount,
        hasNextPage: page < totalPages, hasPreviousPage: page > 1,
      },
      periodStart, periodEnd,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[UsageExport] Query failed', err, { billingPeriod: params.billingPeriod })
    throw error
  }
}
