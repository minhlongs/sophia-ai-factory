/**
 * Workspace Domain B Affiliate Reconciliation Engine
 *
 * Aggregates 100% Workspace-owned external affiliate revenue across CEX & SaaS networks.
 * Lifecycle: pending -> approved -> reversed -> paid_receipt
 * Platform fee: strictly 0 (BYOK policy).
 *
 * Immutable Ledger Event Sourcing:
 * Resolves the latest effective state per (network, external_tx_id) to prevent
 * double-counting multi-state progressions (e.g. pending + approved + paid_receipt).
 * Multi-Currency Grouping:
 * Segregates totals by currency (USD, USDT, EUR, etc.) when no source FX rate exists.
 *
 * Layer: land/affiliates/reconciliation (Business Workflow)
 * @module land/affiliates/reconciliation/workspace-domain-b-reconciliation
 */

import { success, failure, type Result } from '@/seed/types/result';

export interface DomainBCommissionRecord {
  id: string;
  tenantId: string;
  network: string;
  externalTxId: string;
  grossAmountCents: number;
  commissionCents: number;
  status: 'pending' | 'approved' | 'reversed' | 'paid_receipt';
  currency: string;
  occurredAt?: number;
}

export interface DomainBCurrencySummary {
  currency: string;
  pendingCents: number;
  approvedUnpaidCents: number;
  reversedCents: number;
  paidReceiptCents: number;
  totalGrossVolumeCents: number;
  effectiveCommissionCents: number;
}

export interface DomainBReconciliationSummary {
  workspaceId: string;
  pendingCents: number;
  approvedUnpaidCents: number;
  reversedCents: number;
  paidReceiptCents: number;
  totalGrossVolumeCents: number;
  platformFeeCents: 0;
  effectiveCommissionCents: number;
  byCurrency: Record<string, DomainBCurrencySummary>;
  byNetwork: Record<
    string,
    { grossCents: number; commissionCents: number; paidCents: number; count: number }
  >;
}

const STATUS_SEVERITY: Record<DomainBCommissionRecord['status'], number> = {
  pending: 1,
  approved: 2,
  reversed: 3,
  paid_receipt: 4,
};

export function computeDomainBReconciliation(
  workspaceId: string,
  records: DomainBCommissionRecord[],
): DomainBReconciliationSummary {
  // Deduplicate records to determine latest effective state per (network, externalTxId)
  // Higher lifecycle severity (pending < approved < reversed < paid_receipt) always wins
  // over out-of-order delayed retries of lower-severity states.
  const effectiveRecordMap = new Map<string, DomainBCommissionRecord>();

  for (const rec of records) {
    if (rec.tenantId !== workspaceId) continue;
    const dedupKey = `${rec.network}:${rec.externalTxId}`;
    const existing = effectiveRecordMap.get(dedupKey);

    if (!existing) {
      effectiveRecordMap.set(dedupKey, rec);
    } else {
      const existingRank = STATUS_SEVERITY[existing.status] ?? 0;
      const currentRank = STATUS_SEVERITY[rec.status] ?? 0;
      const existingOccurred = existing.occurredAt ?? 0;
      const currentOccurred = rec.occurredAt ?? 0;

      if (currentRank > existingRank) {
        effectiveRecordMap.set(dedupKey, rec);
      } else if (currentRank === existingRank && currentOccurred >= existingOccurred) {
        effectiveRecordMap.set(dedupKey, rec);
      }
    }
  }

  let totalPendingCents = 0;
  let totalApprovedUnpaidCents = 0;
  let totalReversedCents = 0;
  let totalPaidReceiptCents = 0;
  let totalGrossVolumeCents = 0;

  const byCurrency: Record<string, DomainBCurrencySummary> = {};
  const byNetwork: DomainBReconciliationSummary['byNetwork'] = {};

  for (const rec of effectiveRecordMap.values()) {
    const curr = (rec.currency || 'USD').toUpperCase();
    if (!byCurrency[curr]) {
      byCurrency[curr] = {
        currency: curr,
        pendingCents: 0,
        approvedUnpaidCents: 0,
        reversedCents: 0,
        paidReceiptCents: 0,
        totalGrossVolumeCents: 0,
        effectiveCommissionCents: 0,
      };
    }
    const currSummary = byCurrency[curr];

    if (!byNetwork[rec.network]) {
      byNetwork[rec.network] = { grossCents: 0, commissionCents: 0, paidCents: 0, count: 0 };
    }
    const netSummary = byNetwork[rec.network];
    netSummary.count += 1;

    totalGrossVolumeCents += rec.grossAmountCents;
    currSummary.totalGrossVolumeCents += rec.grossAmountCents;
    netSummary.grossCents += rec.grossAmountCents;

    switch (rec.status) {
      case 'pending':
        totalPendingCents += rec.commissionCents;
        currSummary.pendingCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        break;
      case 'approved':
        totalApprovedUnpaidCents += rec.commissionCents;
        currSummary.approvedUnpaidCents += rec.commissionCents;
        currSummary.effectiveCommissionCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        break;
      case 'reversed':
        totalReversedCents += rec.commissionCents;
        currSummary.reversedCents += rec.commissionCents;
        break;
      case 'paid_receipt':
        totalPaidReceiptCents += rec.commissionCents;
        currSummary.paidReceiptCents += rec.commissionCents;
        currSummary.effectiveCommissionCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        netSummary.paidCents += rec.commissionCents;
        break;
    }
  }

  const effectiveCommissionCents = totalApprovedUnpaidCents + totalPaidReceiptCents;

  return {
    workspaceId,
    pendingCents: totalPendingCents,
    approvedUnpaidCents: totalApprovedUnpaidCents,
    reversedCents: totalReversedCents,
    paidReceiptCents: totalPaidReceiptCents,
    totalGrossVolumeCents,
    platformFeeCents: 0,
    effectiveCommissionCents,
    byCurrency,
    byNetwork,
  };
}

export async function fetchWorkspaceDomainBReconciliation(
  db: D1Database,
  workspaceId: string,
): Promise<Result<DomainBReconciliationSummary, Error>> {
  try {
    const query = await db
      .prepare(
        `SELECT id, tenant_id as tenantId, network, external_tx_id as externalTxId,
                gross_amount_cents as grossAmountCents, commission_cents as commissionCents,
                status, currency, occurred_at as occurredAt
         FROM workspace_external_commissions
         WHERE tenant_id = ?
         ORDER BY occurred_at ASC`,
      )
      .bind(workspaceId)
      .all<DomainBCommissionRecord>();

    const summary = computeDomainBReconciliation(workspaceId, query.results ?? []);
    return success(summary);
  } catch (err) {
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}
