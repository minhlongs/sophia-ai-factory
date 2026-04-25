/**
 * Usage Export Service
 *
 * Sub-modules:
 *   export-service-params.ts — GetUsageExportParams
 *   export-service-query.ts  — getUsageExportData, calculateSummary, mapToExportRecord
 *
 * @module usage-export/export-service
 */

import { logger } from '../utils/logger-utility'
import type { UsageExportRecord, UsageExportSummary, UsageExportResponse, ExportFormat } from './types'
import { formatAsCSV, formatSummaryAsCSV } from './csv-formatter'
import { formatAsJSON, formatExportResponse, createJSONDownload } from './json-formatter'
import { getUsageExportData, calculateSummary } from './export-service-query'

export type { GetUsageExportParams } from './export-service-params'
export { getUsageExportData } from './export-service-query'

export function exportToCSV(
  records: UsageExportRecord[],
  options?: { includeHeader?: boolean; fields?: (keyof UsageExportRecord)[] },
): string {
  logger.info('[UsageExport] Converting to CSV', { recordCount: records.length })
  return formatAsCSV(records, { includeHeader: options?.includeHeader ?? true, fields: options?.fields })
}

export function exportToJSON(records: UsageExportRecord[], options?: { indent?: number }): string {
  logger.info('[UsageExport] Converting to JSON', { recordCount: records.length })
  return formatAsJSON(records, { indent: options?.indent ?? 2 })
}

export function generateExportSummary(records: UsageExportRecord[]): UsageExportSummary {
  logger.info('[UsageExport] Generating summary', { recordCount: records.length })
  return calculateSummary(records)
}

import type { GetUsageExportParams } from './export-service-params'

export async function generateCompleteExport(
  params: GetUsageExportParams & { format: ExportFormat },
): Promise<UsageExportResponse> {
  const { format, ...queryParams } = params
  const queryResult = await getUsageExportData(queryParams)
  const summary = calculateSummary(queryResult.records)
  const response = formatExportResponse({
    records: queryResult.records, summary, format,
    billingPeriod: params.billingPeriod,
    periodStart: queryResult.periodStart, periodEnd: queryResult.periodEnd,
    filters: {
      customerId: params.externalCustomerId || null,
      service: params.service || null,
      licenseNonce: params.licenseNonce || null,
    },
    pagination: queryResult.pagination,
  })
  logger.info('[UsageExport] Complete export generated', {
    format, recordCount: queryResult.records.length, totalCredits: summary.totalCredits,
  })
  return response
}

export function createDownloadableExport(
  response: UsageExportResponse,
  format: ExportFormat,
): { content: string; filename: string; contentType: string } {
  if (format === 'csv') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    return {
      content: `${formatAsCSV(response.records)}\r\n\r\n${formatSummaryAsCSV(response.summary)}`,
      filename: `usage-export-${timestamp}.csv`,
      contentType: 'text/csv',
    }
  }
  return createJSONDownload(response)
}
