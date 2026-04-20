/**
 * Compliance Report Scheduler
 *
 * Manages scheduled generation and delivery of compliance reports (PDF/CSV/JSON).
 * Supports daily, weekly, monthly, and quarterly schedules with configurable filters.
 *
 * @module audit/report-scheduler
 */

import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/db/client'
import { insertTyped } from '@/lib/db/insert-typed'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type { Json } from '@/lib/supabase/types'
import type { AuditScheduledReportRow } from './types'

/**
 * Report types available for scheduling
 */
export type ReportType = 'compliance' | 'usage' | 'billing'

/**
 * Export formats for generated reports
 */
export type ReportFormat = 'pdf' | 'csv' | 'json'

/**
 * Schedule frequency options
 */
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

/**
 * Report filter configuration for GDPR-compliant exports
 */
export interface ReportFilters {
  /** Start of report period (Unix timestamp) */
  startDate?: number
  /** End of report period (Unix timestamp) */
  endDate?: number
  /** Filter by specific license nonce */
  licenseNonce?: string
  /** Filter by model names */
  modelNames?: string[]
  /** Filter by license tiers */
  tiers?: string[]
  /** Include PII data (false = GDPR-compliant redaction) */
  includePII?: boolean
}

/**
 * Scheduled report configuration stored in database
 */
export interface ScheduledReport {
  /** Unique report identifier */
  id: string
  /** Type of report to generate */
  type: ReportType
  /** Export format */
  format: ReportFormat
  /** Execution frequency */
  frequency: ReportFrequency
  /** Email recipients */
  recipients: string[]
  /** Report filters */
  filters: ReportFilters
  /** Next scheduled execution (Unix timestamp) */
  nextRunAt: number
  /** Creation timestamp (Unix timestamp) */
  createdAt: number
  /** Admin user who created the schedule */
  createdBy: string
}

/**
 * Input type for scheduling a new report (excludes generated fields)
 */
export type ScheduleReportInput = Omit<ScheduledReport, 'id' | 'nextRunAt' | 'createdAt'>

/**
 * Database insert type for scheduled reports
 */
interface ScheduledReportInsert {
  id: string
  report_type: string
  format: string
  frequency: string
  recipients: string[]
  filters: Json
  next_run_at: number
  created_at: number
  created_by: string
}

/**
 * Calculate next run timestamp based on frequency
 * Exported for testing
 */
export function calculateNextRunAt(frequency: ReportFrequency, from: number = Date.now()): number {
  const now = from
  const date = new Date(now)

  switch (frequency) {
    case 'daily':
      // Next day at same time
      return now + 24 * 60 * 60 * 1000

    case 'weekly':
      // Same day next week
      return now + 7 * 24 * 60 * 60 * 1000

    case 'monthly': {
      // Same day next month (handle month-end edge cases)
      const currentDay = date.getDate()
      date.setMonth(date.getMonth() + 1)
      // If current day is 31 and next month has fewer days, use last day
      if (currentDay > 28 && date.getDate() !== currentDay) {
        date.setDate(0) // Set to last day of previous month
      }
      return date.getTime()
    }

    case 'quarterly': {
      // Same day in 3 months
      const currentDay = date.getDate()
      date.setMonth(date.getMonth() + 3)
      if (currentDay > 28 && date.getDate() !== currentDay) {
        date.setDate(0)
      }
      return date.getTime()
    }

    default:
      throw new Error(`Invalid frequency: ${frequency}`)
  }
}

/**
 * Validate report filters
 * Exported for testing
 */
export function validateFilters(filters: ReportFilters): void {
  if (filters.startDate && filters.endDate) {
    if (filters.startDate > filters.endDate) {
      throw new Error('startDate must be before endDate')
    }
  }

  if (filters.modelNames && filters.modelNames.length === 0) {
    throw new Error('modelNames array cannot be empty')
  }

  if (filters.tiers && filters.tiers.length === 0) {
    throw new Error('tiers array cannot be empty')
  }
}

/**
 * Schedule a new compliance report
 *
 * @param report - Report configuration (excluding id, nextRunAt, createdAt)
 * @returns Created scheduled report with generated id and nextRunAt
 *
 * @example
 * const report = await scheduleReport({
 *   type: 'compliance',
 *   format: 'pdf',
 *   frequency: 'weekly',
 *   recipients: ['admin@example.com'],
 *   filters: { includePII: false },
 *   createdBy: 'admin-user-id'
 * })
 */
export async function scheduleReport(
  report: ScheduleReportInput
): Promise<ScheduledReport> {
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
    filters: report.filters as Json,
    next_run_at: nextRunAt,
    created_at: now,
    created_by: report.createdBy
  }

  try {
    const result = await insertTyped(db.from<AuditScheduledReportRow>('compliance_report_schedules'), reportData)
      .select()
      .single()

    if (result.error) {
      logger.error('[Report Scheduler] Failed to schedule report', toError(result.error))
      throw result.error
    }

    const inserted = result.data as AuditScheduledReportRow

    logger.info('[Report Scheduler] Report scheduled', {
      reportId: inserted.id,
      type: inserted.report_type,
      frequency: inserted.frequency,
      nextRunAt: new Date(inserted.next_run_at * 1000).toISOString()
    })

    return {
      id: inserted.id,
      type: inserted.report_type as ReportType,
      format: inserted.format as ReportFormat,
      frequency: inserted.frequency as ReportFrequency,
      recipients: inserted.recipients,
      filters: inserted.filters as ReportFilters,
      nextRunAt: inserted.next_run_at,
      createdAt: inserted.created_at,
      createdBy: inserted.created_by
    }
  } catch (error) {
    logger.error('[Report Scheduler] Schedule report failed', toError(error))
    throw error
  }
}

/**
 * Get all scheduled reports for an admin user
 *
 * @param adminId - Admin user ID
 * @returns Array of scheduled reports
 *
 * @example
 * const reports = await getScheduledReports('admin-user-id')
 */
export async function getScheduledReports(adminId: string): Promise<ScheduledReport[]> {
  const db = createServerClient()

  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules')
      .select('*')
      .eq('created_by', adminId)
      .order('next_run_at', { ascending: true })

    if (result.error) {
      logger.error('[Report Scheduler] Failed to fetch reports', toError(result.error))
      throw result.error
    }

    return (result.data as AuditScheduledReportRow[]).map((row) => ({
      id: row.id,
      type: row.report_type as ReportType,
      format: row.format as ReportFormat,
      frequency: row.frequency as ReportFrequency,
      recipients: row.recipients,
      filters: row.filters as ReportFilters,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at,
      createdBy: row.created_by
    }))
  } catch (error) {
    logger.error('[Report Scheduler] Get reports failed', toError(error))
    throw error
  }
}

/**
 * Cancel a scheduled report
 *
 * @param reportId - Report ID to cancel
 *
 * @example
 * await cancelScheduledReport('report-uuid')
 */
export async function cancelScheduledReport(reportId: string): Promise<void> {
  const db = createServerClient()

  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules')
      .delete()
      .eq('id', reportId)

    if (result.error) {
      logger.error('[Report Scheduler] Failed to cancel report', toError(result.error))
      throw result.error
    }

    logger.info('[Report Scheduler] Report cancelled', { reportId })
  } catch (error) {
    logger.error('[Report Scheduler] Cancel report failed', toError(error))
    throw error
  }
}

/**
 * Get due reports that need to be executed
 *
 * @returns Array of reports that are due for execution
 */
export async function getDueReports(): Promise<ScheduledReport[]> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules')
      .select('*')
      .lte('next_run_at', now)

    if (result.error) {
      logger.error('[Report Scheduler] Failed to fetch due reports', toError(result.error))
      throw result.error
    }

    return (result.data as AuditScheduledReportRow[]).map((row) => ({
      id: row.id,
      type: row.report_type as ReportType,
      format: row.format as ReportFormat,
      frequency: row.frequency as ReportFrequency,
      recipients: row.recipients,
      filters: row.filters as ReportFilters,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at,
      createdBy: row.created_by
    }))
  } catch (error) {
    logger.error('[Report Scheduler] Get due reports failed', toError(error))
    throw error
  }
}

/**
 * Update next run timestamp after execution
 *
 * @param reportId - Report ID
 * @param nextRunAt - New next run timestamp
 */
export async function updateNextRunAt(
  reportId: string,
  nextRunAt: number
): Promise<void> {
  const db = createServerClient()

  try {
    const result = await db.from<AuditScheduledReportRow>('compliance_report_schedules')
      .update({ next_run_at: nextRunAt })
      .eq('id', reportId)

    if (result.error) {
      logger.error('[Report Scheduler] Failed to update next run', toError(result.error))
      throw result.error
    }
  } catch (error) {
    logger.error('[Report Scheduler] Update next run failed', toError(error))
    throw error
  }
}
