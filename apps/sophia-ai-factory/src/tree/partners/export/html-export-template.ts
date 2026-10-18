/**
 * Printable HTML Report Template & Sparkline Series Helpers
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-export-template
 */

import type { PartnerAnalyticsSummary } from '@/tree/partners/partner-analytics';
import { escapeHtml } from './escaping-utils';
import { buildPrintableHtmlStyles } from './html-styles';
import {
  renderHeader,
  renderKpiGrid,
  renderCohortTable,
  renderSubClientTable,
} from './html-components';

export function getMrrDataPoints(analyticsData: PartnerAnalyticsSummary): number[] {
  if (analyticsData.cohortMatrix.cohorts.length > 1) {
    return analyticsData.cohortMatrix.cohorts.map((c) => c.initialMrrCents / 100);
  }
  if (analyticsData.cohortMatrix.cohorts.length === 1) {
    const c = analyticsData.cohortMatrix.cohorts[0];
    return c.periods.length > 1
      ? c.periods.map((p) => p.mrrCents / 100)
      : [c.initialMrrCents / 100];
  }
  return [1000, 1500, 2200, 3100, 4500, 5200];
}

export interface PrintableHtmlDocumentInput {
  readonly brandName: string;
  readonly logoUrl: string | null;
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly reportPeriod: string;
  readonly generatedDate: string;
  readonly supportUrl: string;
  readonly confidentialNote: string;
  readonly analyticsData: PartnerAnalyticsSummary;
  readonly mrrSparklineSvg: string;
  readonly mcuSparklineSvg: string;
}

export function renderPrintableHtmlDocument(input: PrintableHtmlDocumentInput): string {
  const {
    brandName,
    logoUrl,
    primaryColor,
    accentColor,
    reportPeriod,
    generatedDate,
    supportUrl,
    confidentialNote,
    analyticsData,
    mrrSparklineSvg,
    mcuSparklineSvg,
  } = input;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(brandName)} — Executive Client Performance &amp; Cohort Report</title>
  <style>${buildPrintableHtmlStyles(primaryColor, accentColor)}</style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Print / Save as PDF
    </button>
  </div>
  ${renderHeader(brandName, logoUrl, analyticsData.tier, reportPeriod, generatedDate)}
  ${renderKpiGrid(analyticsData, mrrSparklineSvg, mcuSparklineSvg)}
  <div class="section-title">
    <div class="section-bar"></div>
    Customer Cohort Retention &amp; Net Revenue Retention (NRR) Matrix
  </div>
  <table>
    <thead>
      <tr>
        <th>Cohort</th>
        <th class="text-center">Initial Size</th>
        <th class="text-right">Initial MRR</th>
        <th class="text-center">M0</th>
        <th class="text-center">M1</th>
        <th class="text-center">M2</th>
        <th class="text-center">M3</th>
        <th class="text-right">Current NRR</th>
        <th class="text-right">Realized Revenue</th>
        <th class="text-right">Realized LTV</th>
      </tr>
    </thead>
    <tbody>
      ${renderCohortTable(analyticsData)}
    </tbody>
  </table>
  <div class="section-title">
    <div class="section-bar"></div>
    Sub-Client MCU Consumption Velocity &amp; Runway Analysis
  </div>
  <table>
    <thead>
      <tr>
        <th>Client ID</th>
        <th>Client Name</th>
        <th>Package Tier</th>
        <th class="text-right">Monthly MRR</th>
        <th class="text-right">MCU Balance</th>
        <th class="text-right">Daily Velocity (7d)</th>
        <th class="text-center">Runway Days</th>
        <th class="text-center">Health Status</th>
      </tr>
    </thead>
    <tbody>
      ${renderSubClientTable(analyticsData)}
    </tbody>
  </table>
  <div class="footer">
    <div>${escapeHtml(confidentialNote)}</div>
    <div>Support: <a href="${escapeHtml(supportUrl)}" style="color:var(--primary); text-decoration:none;">${escapeHtml(supportUrl)}</a></div>
  </div>
</body>
</html>`;
}
