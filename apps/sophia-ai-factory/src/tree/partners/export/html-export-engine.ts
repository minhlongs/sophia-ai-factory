/**
 * High-DPI Printable HTML Report Engine
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-export-engine
 */

import type {
  PartnerAnalyticsSummary,
  CohortRow,
} from '@/tree/partners/partner-analytics';
import type { PartnerExportBranding } from './types';
import { escapeHtml } from './escaping-utils';
import { generateSvgSparkline } from './sparkline-generator';
import { normalizeAnalyticsArgs } from './args-normalizer';
import { buildPrintableHtmlStyles } from './html-styles';
import {
  renderHeader,
  renderKpiGrid,
  renderCohortTable,
  renderSubClientTable,
} from './html-components';

function getMrrDataPoints(analyticsData: PartnerAnalyticsSummary): number[] {
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

/**
 * Generates a high-DPI printable HTML report with SVG sparklines and partner branding
 * ready for browser/client PDF export with zero vendor leakage.
 */
export function formatPartnerPrintableHtml(
  analyticsDataOrCohorts: PartnerAnalyticsSummary | CohortRow[],
  partnerInfoOrSummary?: PartnerExportBranding | Record<string, unknown>,
  brandingIfThreeArgs?: PartnerExportBranding,
): string {
  const { analyticsData, partnerInfo } = normalizeAnalyticsArgs(
    analyticsDataOrCohorts,
    partnerInfoOrSummary,
    brandingIfThreeArgs,
  );
  const brandName = partnerInfo?.brandName || partnerInfo?.agencyName || analyticsData.partnerName || 'Enterprise Partner Agency';
  const logoUrl = partnerInfo?.logoUrl || null;
  const primaryColor = partnerInfo?.primaryColor || '#06b6d4';
  const accentColor = partnerInfo?.accentColor || '#3b82f6';
  const reportPeriod = partnerInfo?.reportPeriod || analyticsData.period || 'Executive Review';
  const generatedDate = new Date(analyticsData.generatedAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const supportUrl = partnerInfo?.supportUrl || 'https://agency.domain/support';
  const confidentialNote = partnerInfo?.confidentialityNote ||
    `Confidential business analytics report generated exclusively for clients and management of ${escapeHtml(brandName)}.`;

  const mrrDataPoints = getMrrDataPoints(analyticsData);
  const mrrSparklineSvg = generateSvgSparkline(mrrDataPoints, {
    width: 140,
    height: 36,
    strokeColor: primaryColor,
  });

  const mcuDataPoints = analyticsData.topSubClients.length > 0
    ? analyticsData.topSubClients.map((sc) => sc.mcuVelocityDaily)
    : [15, 22, 38, 45, 62, 58];
  const mcuSparklineSvg = generateSvgSparkline(mcuDataPoints, {
    width: 140,
    height: 36,
    strokeColor: accentColor,
  });

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
