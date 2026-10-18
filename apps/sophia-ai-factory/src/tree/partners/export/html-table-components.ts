/**
 * High-DPI Printable HTML Table Report Components
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-table-components
 */

import type { PartnerAnalyticsSummary } from '@/tree/partners/partner-analytics';
import { escapeHtml, formatCurrency } from './escaping-utils';

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
