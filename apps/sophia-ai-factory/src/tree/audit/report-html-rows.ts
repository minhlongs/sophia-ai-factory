/**
 * HTML table row formatters for compliance PDF report
 *
 * @module audit/report-html-rows
 */

import type { ComplianceReportData } from '@/tree/audit/report-types'

export const formatDate = (date: Date) => date.toISOString().split('T')[0]
export const formatDateTime = (date: Date) => date.toISOString()

/** Render license table rows */
export function buildLicenseRows(licenses: ComplianceReportData['licenses']): string {
  return licenses
    .map(
      (lic) => `
        <tr class="license-row">
          <td class="mono">${lic.nonce.slice(0, 12)}...</td>
          <td><span class="badge badge-${lic.tier.toLowerCase()}">${lic.tier}</span></td>
          <td class="num">${lic.validationCount.toLocaleString()}</td>
          <td class="num">${lic.usageCredits.toLocaleString()}</td>
          <td class="mono">${formatDate(new Date(lic.createdAt))}</td>
        </tr>
      `
    )
    .join('\n')
}

/** Render model breakdown table rows */
export function buildModelRows(modelBreakdown: ComplianceReportData['modelBreakdown']): string {
  return modelBreakdown
    .map(
      (model) => `
        <tr class="model-row">
          <td class="mono">${model.modelName}</td>
          <td class="num">${model.invocations.toLocaleString()}</td>
          <td class="num">${model.tokensProcessed.toLocaleString()}</td>
          <td class="num">${model.tokensInput.toLocaleString()}</td>
          <td class="num">${model.tokensOutput.toLocaleString()}</td>
        </tr>
      `
    )
    .join('\n')
}
