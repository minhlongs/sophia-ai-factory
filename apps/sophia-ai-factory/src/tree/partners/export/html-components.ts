/**
 * High-DPI Printable HTML Report Section Components
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-components
 */

import type { PartnerAnalyticsSummary } from '@/tree/partners/partner-analytics';
import { escapeHtml, formatCurrency } from './escaping-utils';

export {
  renderCohortTable,
  renderSubClientTable,
} from './html-table-components';

export function renderHeader(
  brandName: string,
  logoUrl: string | null,
  tier: string,
  reportPeriod: string,
  generatedDate: string
): string {
  return `
  <div class="report-header">
    <div class="brand-container">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="brand-logo" alt="${escapeHtml(brandName)}" />` : `<div class="brand-title">${escapeHtml(brandName)}</div>`}
      <div>
        <div class="report-subtitle">Client Performance, Cohort Retention &amp; MCU Consumption Ledger</div>
        <span class="badge-tier">${escapeHtml(tier)} Partner Tier</span>
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-period">${escapeHtml(reportPeriod)}</div>
      <div class="meta-date">Report Date: ${escapeHtml(generatedDate)}</div>
    </div>
  </div>`;
}

export function renderKpiGrid(
  analyticsData: PartnerAnalyticsSummary,
  mrrSparklineSvg: string,
  mcuSparklineSvg: string
): string {
  const activePercent = analyticsData.totalSubClients > 0
    ? Math.round((analyticsData.activeSubClients / analyticsData.totalSubClients) * 100)
    : 0;
  const churnColor = analyticsData.blendedChurnPct > 5 ? '#b91c1c' : '#15803d';
  const nrrColor = analyticsData.cohortMatrix.summary.overallNrrPct >= 100 ? '#15803d' : '#b91c1c';

  return `
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Sub-Clients</div>
      <div class="kpi-value">${analyticsData.totalSubClients}</div>
      <div class="kpi-sub">${analyticsData.activeSubClients} Active (${activePercent}%)</div>
    </div>
    <div class="kpi-card spark-card">
      <div class="kpi-label">Monthly MRR</div>
      <div class="kpi-value">${escapeHtml(formatCurrency(analyticsData.totalMrrCents))}</div>
      ${mrrSparklineSvg}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Client LTV</div>
      <div class="kpi-value">${escapeHtml(formatCurrency(analyticsData.avgLtvCents))}</div>
      <div class="kpi-sub">Proj: ${escapeHtml(formatCurrency(analyticsData.cohortMatrix.summary.projectedLtvCents))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Blended Churn</div>
      <div class="kpi-value" style="color: ${churnColor};">${analyticsData.blendedChurnPct.toFixed(1)}%</div>
      <div class="kpi-sub">Monthly Loss Rate</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Net Retention (NRR)</div>
      <div class="kpi-value" style="color: ${nrrColor};">${analyticsData.cohortMatrix.summary.overallNrrPct.toFixed(1)}%</div>
      <div class="kpi-sub">Revenue Expansion</div>
    </div>
    <div class="kpi-card spark-card">
      <div class="kpi-label">MCU Consumed</div>
      <div class="kpi-value">${analyticsData.totalMcuConsumed.toLocaleString()}</div>
      ${mcuSparklineSvg}
    </div>
  </div>`;
}
