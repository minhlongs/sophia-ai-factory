/**
 * Compliance Report Scheduler — DB operations + barrel
 * @module audit/report-scheduler
 */

import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/db/client'
import { insertTyped } from '@/lib/db/insert-typed'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type { AuditScheduledReportRow } from './types'
import type { ScheduledReport, ScheduleReportInput, ScheduledReportInsert, ReportType, ReportFormat, ReportFrequency, ReportFilters } from './report-scheduler-types'

export type { ReportType, ReportFormat, ReportFrequency, ReportFilters, ScheduledReport, ScheduleReportInput } from './report-scheduler-types'
export { calculateNextRunAt, validateFilters } from './report-scheduler-logic'

function mapRow(row: AuditScheduledReportRow): ScheduledReport {
  return {
    id: row.id,
    type: row.report_type as ReportType,
    format: row.format as ReportFormat,
    frequency: row.frequency as ReportFrequency,
    recipients: row.recipients,
    filters: row.filters as ReportFilters,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    createdBy: row.created_by
  }
}

export async function scheduleReport(report: ScheduleReportInput): Promise<ScheduledReport> {
  const { validateFilters, calculateNextRunAt } = await import('./report-scheduler-logic')
  validateFilters(report.filters)

  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)
  const nextRunAt = Math.floor(calculateNextRunAt(report.frequency) / 1000)

  const reportData: ScheduledReportInsert = {
    id: randomUUID(),
    report_type: report.type,
    format: report.format,
    frequency: report.frequency,
    recipients: report.recipients,
    filters: report.filters as import('@/lib/supabase/types').Json,
    next_run_at: nextRunAt,
    created_at: now,
    created_by: report.createdBy
  }

  try {
    const result = await insertTyped(db.from<AuditScheduledReportRow>('compliance_report_schedules'), reportData)
      .select().single()

    if (result.error) { logger.error('[Report Scheduler] Failed to schedule report', toError(result.error)); throw result.error }

    const inserted = result.data as AuditScheduledReportRow
    logger.info('[Report Scheduler] Report scheduled', { reportId: inserted.id, type: inserted.report_type, frequency: inserted.frequency, nextRunAt: new Date(inserted.next_run_at * 1000).toISOString() })
    return mapRow(inserted)
  } catch (error) {
    logger.error('[Report Scheduler] Schedule report failed', toError(error)); throw error
  }
}

export async function getScheduledReports(adminId: string): Promise<ScheduledReport[]> {
  const db = createServerClient()
  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules')
      .select('*').eq('created_by', adminId).order('next_run_at', { ascending: true })
    if (result.error) { logger.error('[Report Scheduler] Failed to fetch reports', toError(result.error)); throw result.error }
    return (result.data as AuditScheduledReportRow[]).map(mapRow)
  } catch (error) {
    logger.error('[Report Scheduler] Get reports failed', toError(error)); throw error
  }
}

export async function cancelScheduledReport(reportId: string): Promise<void> {
  const db = createServerClient()
  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules').delete().eq('id', reportId)
    if (result.error) { logger.error('[Report Scheduler] Failed to cancel report', toError(result.error)); throw result.error }
    logger.info('[Report Scheduler] Report cancelled', { reportId })
  } catch (error) {
    logger.error('[Report Scheduler] Cancel report failed', toError(error)); throw error
  }
}

export async function getDueReports(): Promise<ScheduledReport[]> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)
  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules').select('*').lte('next_run_at', now)
    if (result.error) { logger.error('[Report Scheduler] Failed to fetch due reports', toError(result.error)); throw result.error }
    return (result.data as AuditScheduledReportRow[]).map(mapRow)
  } catch (error) {
    logger.error('[Report Scheduler] Get due reports failed', toError(error)); throw error
  }
}

export async function updateNextRunAt(reportId: string, nextRunAt: number): Promise<void> {
  const db = createServerClient()
  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules').update({ next_run_at: nextRunAt }).eq('id', reportId)
    if (result.error) { logger.error('[Report Scheduler] Failed to update next run', toError(result.error)); throw result.error }
  } catch (error) {
    logger.error('[Report Scheduler] Update next run failed', toError(error)); throw error
  }
}
