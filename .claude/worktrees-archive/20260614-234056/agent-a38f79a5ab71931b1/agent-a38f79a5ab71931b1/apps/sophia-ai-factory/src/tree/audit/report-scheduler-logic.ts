/**
 * Pure logic functions for Report Scheduler (no DB deps)
 * @module audit/report-scheduler-logic
 */

import type { ReportFrequency, ReportFilters } from '@/tree/audit/report-scheduler-types'

export function calculateNextRunAt(frequency: ReportFrequency, from: number = Date.now()): number {
  const date = new Date(from)

  switch (frequency) {
    case 'daily':
      return from + 24 * 60 * 60 * 1000

    case 'weekly':
      return from + 7 * 24 * 60 * 60 * 1000

    case 'monthly': {
      const currentDay = date.getDate()
      date.setMonth(date.getMonth() + 1)
      if (currentDay > 28 && date.getDate() !== currentDay) date.setDate(0)
      return date.getTime()
    }

    case 'quarterly': {
      const currentDay = date.getDate()
      date.setMonth(date.getMonth() + 3)
      if (currentDay > 28 && date.getDate() !== currentDay) date.setDate(0)
      return date.getTime()
    }

    default:
      throw new Error(`Invalid frequency: ${frequency}`)
  }
}

export function validateFilters(filters: ReportFilters): void {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    throw new Error('startDate must be before endDate')
  }
  if (filters.modelNames && filters.modelNames.length === 0) {
    throw new Error('modelNames array cannot be empty')
  }
  if (filters.tiers && filters.tiers.length === 0) {
    throw new Error('tiers array cannot be empty')
  }
}
