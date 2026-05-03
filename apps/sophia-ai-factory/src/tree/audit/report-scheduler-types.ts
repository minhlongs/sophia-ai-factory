/**
 * Types for Compliance Report Scheduler
 * @module audit/report-scheduler-types
 */

import type { Json } from '@/lib/supabase/types'

export type ReportType = 'compliance' | 'usage' | 'billing'
export type ReportFormat = 'pdf' | 'csv' | 'json'
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

export interface ReportFilters {
  startDate?: number
  endDate?: number
  licenseNonce?: string
  modelNames?: string[]
  tiers?: string[]
  includePII?: boolean
}

export interface ScheduledReport {
  id: string
  type: ReportType
  format: ReportFormat
  frequency: ReportFrequency
  recipients: string[]
  filters: ReportFilters
  nextRunAt: number
  createdAt: number
  createdBy: string
}

export type ScheduleReportInput = Omit<ScheduledReport, 'id' | 'nextRunAt' | 'createdAt'>

export interface ScheduledReportInsert {
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
