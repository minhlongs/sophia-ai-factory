/**
 * High-DPI Printable HTML Report Section Components
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-components
 */

import type { PartnerAnalyticsSummary } from '@/tree/partners/partner-analytics';
import { escapeHtml, formatCurrency } from './escaping-utils';

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

export function renderCohortTable(analyticsData: PartnerAnalyticsSummary): string {
  if (analyticsData.cohortMatrix.cohorts.length === 0) {
    return `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No cohort history available for this period.</td></tr>`;
  }

  return analyticsData.cohortMatrix.cohorts.map((c) => {
    const getRetentionSpan = (idx: number) => {
      const p = c.periods.find((x) => x.monthIndex === idx);
      if (!p) return '<span style="color:#94a3b8;">—</span>';
      const cls = p.logoRetentionPct >= 80 ? 'heat-high' : p.logoRetentionPct >= 50 ? 'heat-mid' : 'heat-low';
      return `<span class="heat-cell ${cls}">${p.logoRetentionPct.toFixed(0)}%</span>`;
    };

    const latestPeriod = c.periods[c.periods.length - 1];
    const nrrVal = latestPeriod ? latestPeriod.nrrPct : 100;
    const nrrColor = nrrVal >= 100 ? '#15803d' : '#b91c1c';

    return `<tr>
      <td><strong>${escapeHtml(c.cohortMonth)}</strong></td>
      <td class="text-center">${c.initialSize}</td>
      <td class="text-right">${escapeHtml(formatCurrency(c.initialMrrCents))}</td>
      <td class="text-center">${getRetentionSpan(0)}</td>
      <td class="text-center">${getRetentionSpan(1)}</td>
      <td class="text-center">${getRetentionSpan(2)}</td>
      <td class="text-center">${getRetentionSpan(3)}</td>
      <td class="text-right" style="font-weight:700; color:${nrrColor};">${nrrVal.toFixed(1)}%</td>
      <td class="text-right">${escapeHtml(formatCurrency(c.totalRealizedRevenueCents))}</td>
      <td class="text-right font-weight-bold"><strong>${escapeHtml(formatCurrency(c.realizedLtvCents))}</strong></td>
    </tr>`;
  }).join('');
}

export function renderSubClientTable(analyticsData: PartnerAnalyticsSummary): string {
  if (analyticsData.topSubClients.length === 0) {
    return `<tr><td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted);">No active sub-clients registered.</td></tr>`;
  }

  return analyticsData.topSubClients.map((sc) => {
    const badgeClass =
      sc.status === 'healthy' ? 'badge-healthy' :
      sc.status === 'warning' ? 'badge-warning' :
      sc.status === 'imminent' ? 'badge-imminent' : 'badge-dormant';

    const runwayText = sc.runwayDays === 999 ? '∞ (Dormant)' : `${sc.runwayDays} days`;

    return `<tr>
      <td><code>${escapeHtml(sc.clientId.slice(0, 10))}</code></td>
      <td><strong>${escapeHtml(sc.clientName)}</strong></td>
      <td>${escapeHtml(sc.tier)}</td>
      <td class="text-right">${escapeHtml(formatCurrency(sc.currentMrrCents))}</td>
      <td class="text-right">${sc.mcuBalance.toLocaleString()} MCU</td>
      <td class="text-right">${sc.mcuVelocityDaily.toFixed(1)} MCU/day</td>
      <td class="text-center font-weight-bold">${runwayText}</td>
      <td class="text-center">
        <span class="status-badge ${badgeClass}">${escapeHtml(sc.status)}</span>
      </td>
    </tr>`;
  }).join('');
}
