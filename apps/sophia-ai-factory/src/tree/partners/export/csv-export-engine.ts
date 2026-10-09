/**
 * RFC-4180 Compliant Partner CSV Export Engine
 * Layer: tree/partners
 *
 * @module tree/partners/export/csv-export-engine
 */

import type {
  PartnerAnalyticsSummary,
  CohortRow,
} from '@/tree/partners/partner-analytics';
import type { PartnerExportBranding } from './types';
import { escapeCsvCell, formatCurrency } from './escaping-utils';
import { normalizeAnalyticsArgs } from './args-normalizer';

/**
 * Generates an RFC-4180 compliant CSV analytics report.
 * Starts with UTF-8 BOM (﻿) for seamless opening in Microsoft Excel.
 */
export function formatPartnerCsvReport(
  analyticsDataOrCohorts: PartnerAnalyticsSummary | CohortRow[],
  partnerInfoOrSummary?: PartnerExportBranding | Record<string, unknown>,
  brandingIfThreeArgs?: PartnerExportBranding,
): string {
  const { analyticsData, partnerInfo } = normalizeAnalyticsArgs(
    analyticsDataOrCohorts,
    partnerInfoOrSummary,
    brandingIfThreeArgs,
  );
  const brandName = partnerInfo?.brandName || partnerInfo?.agencyName || analyticsData.partnerName || 'Partner Agency';
  const period = partnerInfo?.reportPeriod || analyticsData.period || 'All-Time';
  const generatedDate = new Date(analyticsData.generatedAt || Date.now()).toISOString().slice(0, 10);
  const CRLF = '\r\n';

  const rows: string[] = [];

  const pushRow = (...cells: Array<string | number | null | undefined>) => {
    rows.push(cells.map(escapeCsvCell).join(','));
  };

  // Header metadata
  pushRow('EXECUTIVE PARTNER PERFORMANCE & CLIENT REPORT');
  pushRow('Partner Brand', brandName);
  pushRow('Partner Tier', analyticsData.tier);
  pushRow('Report Period', period);
  pushRow('Generated Date', generatedDate);
  rows.push('');

  // 1. Executive Summary Table
  pushRow('EXECUTIVE KPI SUMMARY');
  pushRow('Metric', 'Value');
  pushRow('Total Sub-Clients', analyticsData.totalSubClients);
  pushRow('Active Sub-Clients', analyticsData.activeSubClients);
  pushRow('Monthly MRR', formatCurrency(analyticsData.totalMrrCents));
  pushRow('Monthly Commission', formatCurrency(analyticsData.monthlyCommissionCents));
  pushRow('Lifetime Earnings', formatCurrency(analyticsData.lifetimeEarningsCents));
  pushRow('Average Client LTV', formatCurrency(analyticsData.avgLtvCents));
  pushRow('Projected Client LTV', formatCurrency(analyticsData.cohortMatrix.summary.projectedLtvCents));
  pushRow('Blended Churn Rate (%)', `${analyticsData.blendedChurnPct.toFixed(2)}%`);
  pushRow('Overall Net Revenue Retention (%)', `${analyticsData.cohortMatrix.summary.overallNrrPct.toFixed(2)}%`);
  pushRow('Total MCU Consumed', analyticsData.totalMcuConsumed.toLocaleString());
  pushRow('Total MCU Allocated', analyticsData.totalMcuAllocated.toLocaleString());
  pushRow('Average Daily MCU Velocity', `${analyticsData.avgMcuVelocityDaily.toFixed(1)} MCU/day`);
  pushRow('Revenue Growth (%)', `${analyticsData.revenueGrowthPct.toFixed(1)}%`);
  rows.push('');

  // 2. Cohort Retention Matrix Table
  pushRow('CUSTOMER COHORT RETENTION & NRR MATRIX');
  pushRow(
    'Cohort Month',
    'Initial Clients',
    'Initial MRR',
    'Month 0 Retention (%)',
    'Month 1 Retention (%)',
    'Month 2 Retention (%)',
    'Month 3 Retention (%)',
    'Current NRR (%)',
    'Realized Cohort Revenue',
    'Realized LTV',
  );

  for (const c of analyticsData.cohortMatrix.cohorts) {
    const getRetention = (idx: number): string => {
      const p = c.periods.find((x) => x.monthIndex === idx);
      return p ? `${p.logoRetentionPct.toFixed(1)}%` : 'N/A';
    };

    const latestPeriod = c.periods[c.periods.length - 1];
    const nrrStr = latestPeriod ? `${latestPeriod.nrrPct.toFixed(1)}%` : '100.0%';

    pushRow(
      c.cohortMonth,
      c.initialSize,
      formatCurrency(c.initialMrrCents),
      getRetention(0),
      getRetention(1),
      getRetention(2),
      getRetention(3),
      nrrStr,
      formatCurrency(c.totalRealizedRevenueCents),
      formatCurrency(c.realizedLtvCents),
    );
  }
  rows.push('');

  // 3. Sub-Client MCU Consumption & Runway Ledger
  pushRow('SUB-CLIENT MCU CONSUMPTION & RUNWAY LEDGER');
  pushRow(
    'Client ID',
    'Client Name',
    'Package Tier',
    'Current MRR',
    'Remaining MCU Balance',
    'Daily Velocity (7d)',
    'Runway Days',
    'Health Status',
  );

  for (const sc of analyticsData.topSubClients) {
    pushRow(
      sc.clientId,
      sc.clientName,
      sc.tier,
      formatCurrency(sc.currentMrrCents),
      sc.mcuBalance.toLocaleString(),
      `${sc.mcuVelocityDaily.toFixed(1)} MCU/day`,
      sc.runwayDays === 999 ? 'Infinite (Dormant)' : `${sc.runwayDays} days`,
      sc.status.toUpperCase(),
    );
  }

  // Prepend UTF-8 Byte Order Mark (﻿) and join with CRLF
  return '﻿' + rows.join(CRLF) + CRLF;
}
