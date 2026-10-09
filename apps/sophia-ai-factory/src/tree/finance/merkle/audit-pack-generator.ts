/**
 * Cryptographic Merkle Audit Vault: Audit Pack Generator
 *
 * Generates complete SEC Form S-1 / VAS TT200 audit disclosure packs with
 * financial metrics, intercompany roll-ups, and SOX compliance attestation.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/audit-pack-generator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  FormS1AuditPack,
  PeriodType,
  CloseStatus,
  AuditOpinion,
  SoxControlId,
} from './types';
import { DEFAULT_AUDIT_SECRET } from './types';
import { verifyAuditLedgerChain } from './chain-verifier';

/**
 * Generate a complete, SEC Form S-1 / VAS TT200 audit disclosure pack
 */
export async function generateFormS1AuditPack(
  db: D1Database,
  periodKey: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<FormS1AuditPack> {
  const periodRow = await db
    .prepare(`SELECT * FROM financial_close_periods WHERE period_key = ?1 LIMIT 1`)
    .bind(periodKey)
    .first<{
      period_type: PeriodType;
      start_date: string;
      end_date: string;
      close_status: CloseStatus;
      audit_opinion: AuditOpinion;
      total_recognized_revenue_cents: number;
      total_deferred_revenue_cents: number;
      total_refunds_cents: number;
      net_revenue_cents: number;
      active_contracts_count: number;
      merkle_root_hash: string | null;
      digital_signature: string | null;
    }>();

  if (!periodRow) {
    throw new Error(`Financial close period ${periodKey} not found`);
  }

  // Intercompany roll-up
  const ictAggregates = await db
    .prepare(
      `SELECT
         COUNT(*) as total_transfers,
         COALESCE(SUM(gross_amount_cents), 0) as gross_cents,
         COALESCE(SUM(withholding_tax_amount_cents), 0) as wht_cents,
         COALESCE(SUM(net_settlement_cents), 0) as net_cents
       FROM intercompany_transfers
       WHERE transfer_date >= ?1 AND transfer_date <= ?2`
    )
    .bind(periodRow.start_date, periodRow.end_date)
    .first<{
      total_transfers: number;
      gross_cents: number;
      wht_cents: number;
      net_cents: number;
    }>();

  // Audit events for period
  const integrity = await verifyAuditLedgerChain(db, periodKey, secret);

  const controlsEvaluated: SoxControlId[] = [
    'CC-1.1',
    'CC-2.1',
    'CC-3.2',
    'CC-5.1',
    'AC-4.1',
    'AC-6.2',
  ];

  return {
    periodKey,
    periodType: periodRow.period_type,
    startDate: periodRow.start_date,
    endDate: periodRow.end_date,
    closeStatus: periodRow.close_status,
    auditOpinion: periodRow.audit_opinion,
    financialMetrics: {
      totalGrossContractValueCents:
        Number(periodRow.total_recognized_revenue_cents) + Number(periodRow.total_deferred_revenue_cents),
      recognizedRevenueCents: Number(periodRow.total_recognized_revenue_cents),
      deferredRevenueCents: Number(periodRow.total_deferred_revenue_cents),
      refundsCents: Number(periodRow.total_refunds_cents),
      netRevenueCents: Number(periodRow.net_revenue_cents),
      activeContractsCount: Number(periodRow.active_contracts_count),
    },
    intercompanySummary: {
      totalTransfersCount: Number(ictAggregates?.total_transfers ?? 0),
      grossTransfersCents: Number(ictAggregates?.gross_cents ?? 0),
      totalWithholdingTaxCents: Number(ictAggregates?.wht_cents ?? 0),
      netSettledCents: Number(ictAggregates?.net_cents ?? 0),
    },
    merkleVerification: {
      rootHash: periodRow.merkle_root_hash ?? integrity.computedMerkleRoot ?? '',
      digitalSignature: periodRow.digital_signature ?? '',
      totalAuditedEvents: integrity.totalRecordsChecked,
      integrityVerified: integrity.isValid,
    },
    soxComplianceAttestation: {
      controlsEvaluated,
      attestationTimestamp: Date.now(),
      signOffStatus: integrity.isValid ? 'CERTIFIED' : 'EXCEPTION_NOTED',
    },
  };
}
