/**
 * CSV Section Builders for Partner Export Engine
 *
 * @module tree/partners/export/csv-section-builders
 */

import type { PartnerAnalyticsSummary } from '@/tree/partners/partner-analytics';
import { formatCurrency } from './escaping-utils';

export type CsvRowPusher = (...cells: Array<string | number | null | undefined>) => void;

export function appendCohortAndSubClientSections(
  analyticsData: PartnerAnalyticsSummary,
  pushRow: CsvRowPusher,
  rows: string[],
): void {
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
}
