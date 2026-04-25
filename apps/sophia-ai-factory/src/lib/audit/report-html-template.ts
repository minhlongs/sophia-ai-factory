/**
 * Generate HTML template for compliance PDF report
 *
 * Orchestrates styles + section builders from sibling modules.
 */

import type { ComplianceReportData } from './report-types'
import { getReportStyles } from './report-html-styles'
import { buildReportSections } from './report-html-sections'

export function generateComplianceHTML(data: ComplianceReportData): string {
  const { reportId } = data
  const styles = getReportStyles()
  const sections = buildReportSections(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Report - ${reportId}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    ${sections.header}
    ${sections.summarySection}
    ${sections.hashChainSection}
    ${sections.licenseSection}
    ${sections.modelSection}
    ${sections.footer}
  </div>
</body>
</html>`
}
