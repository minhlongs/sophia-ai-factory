/**
 * Compliance Report Generator — barrel re-export
 *
 * Sub-modules:
 *   report-types.ts        — LicenseReportData, ModelUsageData, HashChainVerification, ComplianceReportSummary, ComplianceReportData
 *   report-html-template.ts — generateComplianceHTML
 *   report-formatters.ts   — generateUsageCSV, generateComplianceJSON, formatBytes
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { generateComplianceHTML } from '@/tree/audit/report-html-template'
import { generateUsageCSV, generateComplianceJSON, formatBytes } from '@/tree/audit/report-formatters'
import type { ComplianceReportData } from '@/tree/audit/report-types'

export type {
  LicenseReportData,
  ModelUsageData,
  HashChainVerification,
  ComplianceReportSummary,
  ComplianceReportData,
} from './report-types'
export { generateComplianceHTML }
export { generateUsageCSV, generateComplianceJSON, formatBytes }

/** Generate report in specified format */
export function generateReport(
  data: ComplianceReportData,
  format: 'pdf' | 'csv' | 'json'
): string {
  try {
    switch (format) {
      case 'pdf':
        return generateComplianceHTML(data)
      case 'json':
        return generateComplianceJSON(data)
      case 'csv': {
        const usageData = data.modelBreakdown.map((model) => ({
          timestamp: data.generatedAt,
          licenseNonce: data.licenses[0]?.nonce || 'N/A',
          modelName: model.modelName,
          tokenCount: model.tokensProcessed,
          tokensInput: model.tokensInput,
          tokensOutput: model.tokensOutput,
          tier: data.licenses[0]?.tier || 'N/A'
        }))
        return generateUsageCSV(usageData, {
          startDate: data.period.start.getTime() / 1000,
          endDate: data.period.end.getTime() / 1000
        })
      }
      default:
        throw new Error(`Invalid format: ${format}`)
    }
  } catch (error) {
    logger.error('[Report Generator] Generate report failed', toError(error))
    throw error
  }
}
