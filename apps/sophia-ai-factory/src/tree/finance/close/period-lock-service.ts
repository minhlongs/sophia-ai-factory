/**
 * Period Lock, Reopen & State Transitions
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-lock-service
 */

import type { D1Database } from '@/seed/db/client';
import type { FinancialClosePeriod } from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';
import { getPeriodStatus } from './period-query-service';

/**
 * Permanently lock an accounting period (FSM: closed -> locked)
 */
export async function lockPeriod(
  db: D1Database,
  periodKey: string,
  lockReason: string,
  actorId: string,
  orgId?: string | null
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus !== 'closed') {
    throw new Error(`INVALID_STATE_TRANSITION: Can only lock a closed period (current: ${period.closeStatus})`);
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'locked',
           lock_reason = ?1,
           updated_at = ?2
       WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
    )
    .bind(lockReason, now, periodKey, orgId ?? null)
    .run();

  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_LOCKED',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId,
    actorRole: 'SOX_COMPLIANCE_OFFICER',
    payload: { lockReason, lockedAt: now },
    soxControlId: 'CC-5.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) throw new Error(`Period ${periodKey} not found after lock`);
  return updated;
}

/**
 * Reopen an accounting period (only allowed if not locked or audited)
 */
export async function reopenPeriod(
  db: D1Database,
  periodKey: string,
  reason: string,
  actorId: string,
  orgId?: string | null
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus === 'locked') {
    throw new Error('LOCKED_PERIOD_CANNOT_BE_REOPENED');
  }

  if (period.closeStatus === 'audited') {
    throw new Error('AUDITED_PERIOD_CANNOT_BE_REOPENED');
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'reopened',
           lock_reason = ?1,
           updated_at = ?2
       WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
    )
    .bind(reason, now, periodKey, orgId ?? null)
    .run();

  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_PRE_CLOSE_AUDIT',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId,
    actorRole: 'CONTROLLER',
    payload: { action: 'reopen_period', reason, reopenedAt: now },
    soxControlId: 'CC-2.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) throw new Error(`Period ${periodKey} not found after reopen`);
  return updated;
}
