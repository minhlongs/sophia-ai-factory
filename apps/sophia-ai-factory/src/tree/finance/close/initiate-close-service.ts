/**
 * Initiate Pre-Close Audit Service
 * Layer: tree/finance
 *
 * @module tree/finance/close/initiate-close-service
 */

import type { D1Database } from '@/seed/db/client';
import type { FinancialClosePeriod, PeriodType } from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';
import { inferPeriodDates } from './period-mappers';
import { getPeriodStatus } from './period-query-service';

/**
 * Initiate pre-close audit for an accounting period (FSM: open -> closing)
 */
export async function initiatePeriodClose(
  db: D1Database,
  periodKey: string,
  periodType: PeriodType,
  closedBy: string,
  orgId?: string | null,
  startDateStr?: string,
  endDateStr?: string
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);

  const dates = startDateStr && endDateStr
    ? { startDate: startDateStr, endDate: endDateStr }
    : inferPeriodDates(periodKey, periodType);

  const now = Date.now();

  if (!period) {
    const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
    await db
      .prepare(
        `INSERT INTO financial_close_periods (
          id, org_id, period_key, period_type, start_date, end_date,
          close_status, closed_by, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'closing', ?7, ?8, ?9)`
      )
      .bind(
        id,
        orgId ?? null,
        periodKey,
        periodType,
        dates.startDate,
        dates.endDate,
        closedBy,
        now,
        now
      )
      .run();
  } else {
    if (period.closeStatus === 'locked') {
      throw new Error(`PERIOD_LOCKED: Cannot close period ${periodKey} because it is permanently locked.`);
    }
    if (period.closeStatus === 'audited') {
      throw new Error(`PERIOD_ALREADY_AUDITED: Period ${periodKey} has received final auditor sign-off.`);
    }

    await db
      .prepare(
        `UPDATE financial_close_periods
         SET close_status = 'closing',
             closed_by = ?1,
             updated_at = ?2
         WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
      )
      .bind(closedBy, now, periodKey, orgId ?? null)
      .run();
  }

  // Audit event log
  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_PRE_CLOSE_AUDIT',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId: closedBy,
    actorRole: 'CONTROLLER',
    payload: { action: 'initiate_period_close', periodKey, periodType, initiatedAt: now },
    soxControlId: 'CC-1.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) {
    throw new Error(`Failed to retrieve initiated period: ${periodKey}`);
  }
  return updated;
}
