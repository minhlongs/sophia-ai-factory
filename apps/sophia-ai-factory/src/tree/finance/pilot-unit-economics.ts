/**
 * Pilot Unit-Economics Merkle Reconciler
 * Layer: tree (Domain reusable)
 * @module tree/finance/pilot-unit-economics
 */

import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import {
  appendIpoAuditEvent,
  verifyAuditLedgerChain,
  DEFAULT_AUDIT_SECRET,
} from './merkle';
import {
  DEFAULT_FOUNDER_HOURLY_RATE_CENTS,
  validateUnitEconomicsInput,
  type PilotTier,
  type PilotUnitEconomicsInput,
  type PilotUnitEconomicsSummary,
  type PilotCloseLedgerResult,
  type UnitEconomicsErrorCode,
} from './pilot-unit-economics-types';

export type {
  PilotTier,
  PilotUnitEconomicsInput,
  PilotUnitEconomicsSummary,
  PilotCloseLedgerResult,
  UnitEconomicsErrorCode,
} from './pilot-unit-economics-types';

export function calculatePilotUnitEconomics(
  input: PilotUnitEconomicsInput
): Result<PilotUnitEconomicsSummary, { code: UnitEconomicsErrorCode; message: string }> {
  const hourlyRateCents = input?.founderHourlyRateCents ?? DEFAULT_FOUNDER_HOURLY_RATE_CENTS;
  const val = validateUnitEconomicsInput(input, hourlyRateCents);
  if (!val.ok) return failure(val.error);
  const founderSupportCostCents = Math.round((input.founderSupportMinutes * hourlyRateCents) / 60);
  const totalDirectCostCents = input.paymentGatewayFeeCents + input.cloudflareEdgeCostCents + founderSupportCostCents;
  const netContributionCents = input.collectedSubscriptionCents - totalDirectCostCents;
  const unitMarginBasisPoints = Math.round((netContributionCents * 10000) / input.collectedSubscriptionCents);
  return success({
    pilotId: input.pilotId.trim(), orgId: input.orgId.trim(), periodKey: input.periodKey, tier: input.tier,
    collectedSubscriptionCents: input.collectedSubscriptionCents, paymentGatewayFeeCents: input.paymentGatewayFeeCents,
    cloudflareEdgeCostCents: input.cloudflareEdgeCostCents, founderSupportMinutes: input.founderSupportMinutes,
    founderHourlyRateCents: hourlyRateCents, founderSupportCostCents, totalDirectCostCents, netContributionCents,
    unitMarginBasisPoints, unitMarginPercent: unitMarginBasisPoints / 100,
  });
}

export async function recordAndVerifyPilotClosePeriod(
  db: D1Database,
  input: PilotUnitEconomicsInput,
  actorId: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<Result<PilotCloseLedgerResult, { code: UnitEconomicsErrorCode; message: string }>> {
  if (!actorId?.trim()) return failure({ code: 'INVALID_IDENTIFIER', message: 'actorId is required' });
  const calcRes = calculatePilotUnitEconomics(input);
  if (!calcRes.ok) return failure(calcRes.error);
  const s = calcRes.value;
  try {
    const auditRecord = await appendIpoAuditEvent(
      db,
      {
        periodKey: s.periodKey, orgId: s.orgId, eventType: 'MERKLE_ROOT_ANCHORED',
        eventScope: 'entity_level', actorId, actorRole: 'CFO',
        amountCents: s.netContributionCents, payload: { ...s }, soxControlId: 'CC-1.1', vasAccountCode: '511',
      },
      secret
    );
    const preliminary = await verifyAuditLedgerChain(db, s.periodKey, secret);
    const [year, month] = s.periodKey.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDate = `${s.periodKey}-01`;
    const endDate = `${s.periodKey}-${String(lastDay).padStart(2, '0')}`;
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO financial_close_periods (
          org_id, period_key, period_type, start_date, end_date, close_status,
          closed_by, closed_at, total_recognized_revenue_cents, total_deferred_revenue_cents,
          total_refunds_cents, net_revenue_cents, active_contracts_count, merkle_root_hash,
          compliance_frameworks, audit_opinion, created_at, updated_at
        ) VALUES (?1, ?2, 'monthly', ?3, ?4, 'closed', ?5, ?6, ?7, 0, 0, ?8, 1, ?9, 'ASC_606,VAS_TT200,SOX_404', 'unqualified', ?10, ?10)
        ON CONFLICT(org_id, period_key) DO UPDATE SET
          merkle_root_hash = excluded.merkle_root_hash, total_recognized_revenue_cents = excluded.total_recognized_revenue_cents,
          net_revenue_cents = excluded.net_revenue_cents, close_status = 'closed', closed_by = excluded.closed_by,
          closed_at = excluded.closed_at, updated_at = excluded.updated_at`
      )
      .bind(s.orgId, s.periodKey, startDate, endDate, actorId, now, s.collectedSubscriptionCents, s.netContributionCents, preliminary.computedMerkleRoot, now)
      .run();
    const integrity = await verifyAuditLedgerChain(db, s.periodKey, secret);
    if (!integrity.isValid) {
      return failure({ code: 'MERKLE_CHAIN_TAMPERED', message: `Audit chain failed: ${integrity.discrepancies.join('; ')}` });
    }
    return success({ summary: s, auditRecord, integrity });
  } catch (err) {
    return failure({ code: 'D1_LEDGER_ERROR', message: err instanceof Error ? err.message : String(err) });
  }
}
