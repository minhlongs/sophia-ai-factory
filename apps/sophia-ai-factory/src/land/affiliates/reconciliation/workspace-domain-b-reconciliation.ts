/**
 * Workspace Domain B Affiliate Reconciliation Engine
 *
 * Aggregates 100% Workspace-owned external affiliate revenue across CEX & SaaS
 * networks. Lifecycle: pending -> approved -> paid_receipt, with `reversed`
 * able to arrive AFTER a paid receipt. Platform fee is strictly 0 (BYOK policy).
 *
 * Invariants:
 *  - One effective lifecycle state per (network, external_tx_id). A delayed
 *    retry of an older state never downgrades a newer terminal state; a
 *    reversal always wins even if it arrives after `paid_receipt`.
 *  - Partial refunds / adjustments are immutable rows whose external_tx_id
 *    carries the `#adj:` marker. They are retained as adjustment history and
 *    subtracted from effective commission instead of being deduplicated away.
 *  - No FX conversion exists here. When more than one currency is present,
 *    the single-number top-level totals are explicitly unavailable (0 +
 *    totalsAvailable:false); `byCurrency` is the only valid aggregate.
 *
 * Layer: land/affiliates/reconciliation (Business Workflow)
 * @module land/affiliates/reconciliation/workspace-domain-b-reconciliation
 */

import { success, failure, type Result } from '@/seed/types/result';

/** Deterministic suffix appended by postback ingestion for adjustment rows. */
export const ADJUSTMENT_MARKER = '#adj:';

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
  adjustmentCents: number;
  totalGrossVolumeCents: number;
  effectiveCommissionCents: number;
}

export interface DomainBReconciliationSummary {
  workspaceId: string;
  pendingCents: number;
  approvedUnpaidCents: number;
  reversedCents: number;
  paidReceiptCents: number;
  adjustmentCents: number;
  totalGrossVolumeCents: number;
  platformFeeCents: 0;
  effectiveCommissionCents: number;
  /** Optional for backward compatibility with previously persisted snapshots. */
  currencies?: string[];
  isSingleCurrency?: boolean;
  /** False when a single-number total would mix currencies/assets. */
  totalsAvailable?: boolean;
  byCurrency: Record<string, DomainBCurrencySummary>;
  byNetwork: Record<
    string,
    { grossCents: number; commissionCents: number; paidCents: number; count: number; currencies?: string[]; mixedCurrencies?: boolean }
  >;
}

/**
 * paid_receipt outranks approved, but `reversed` outranks paid_receipt: a
 * chargeback/refund is a later fact that must not be hidden by an already
 * recorded cash receipt.
 */
const STATUS_SEVERITY: Record<DomainBCommissionRecord['status'], number> = {
  pending: 1,
  approved: 2,
  paid_receipt: 3,
  reversed: 4,
};

interface WeightedRecord {
  rec: DomainBCommissionRecord;
  seq: number;
}

function emptyCurrency(currency: string): DomainBCurrencySummary {
  return {
    currency,
    pendingCents: 0,
    approvedUnpaidCents: 0,
    reversedCents: 0,
    paidReceiptCents: 0,
    adjustmentCents: 0,
    totalGrossVolumeCents: 0,
    effectiveCommissionCents: 0,
  };
}

export function computeDomainBReconciliation(
  workspaceId: string,
  records: DomainBCommissionRecord[],
): DomainBReconciliationSummary {
  const lifecycle = new Map<string, WeightedRecord>();
  const adjustments: DomainBCommissionRecord[] = [];
  const currencies = new Set<string>();

  records.forEach((rec, seq) => {
    if (rec.tenantId !== workspaceId) return;
    const currency = (rec.currency || 'USD').toUpperCase();
    currencies.add(currency);

    if (rec.externalTxId.includes(ADJUSTMENT_MARKER)) {
      adjustments.push(rec);
      return;
    }

    const dedupKey = `${rec.network}:${rec.externalTxId}:${currency}`;
    const existing = lifecycle.get(dedupKey);
    if (!existing) {
      lifecycle.set(dedupKey, { rec, seq });
      return;
    }
    const existingRank = STATUS_SEVERITY[existing.rec.status] ?? 0;
    const currentRank = STATUS_SEVERITY[rec.status] ?? 0;
    const existingTime = existing.rec.occurredAt ?? 0;
    const currentTime = rec.occurredAt ?? 0;

    // Higher lifecycle rank wins. Same rank: the later provider event time
    // wins; identical time: later ingest sequence wins (stable replay).
    if (
      currentRank > existingRank ||
      (currentRank === existingRank && currentTime > existingTime) ||
      (currentRank === existingRank && currentTime === existingTime && seq > existing.seq)
    ) {
      lifecycle.set(dedupKey, { rec, seq });
    }
  });

  const byCurrency: Record<string, DomainBCurrencySummary> = {};
  const byNetwork: DomainBReconciliationSummary['byNetwork'] = {};
  const currencySets: Record<string, Set<string>> = {};

  const currencyFor = (rec: DomainBCommissionRecord) => (rec.currency || 'USD').toUpperCase();
  const ensureCurrency = (curr: string) => {
    if (!byCurrency[curr]) byCurrency[curr] = emptyCurrency(curr);
    return byCurrency[curr];
  };
  const ensureNetwork = (network: string, curr: string) => {
    if (!byNetwork[network]) {
      byNetwork[network] = { grossCents: 0, commissionCents: 0, paidCents: 0, count: 0, currencies: [], mixedCurrencies: false };
    }
    if (!currencySets[network]) currencySets[network] = new Set<string>();
    currencySets[network].add(curr);
    return byNetwork[network];
  };

  for (const { rec } of lifecycle.values()) {
    const curr = currencyFor(rec);
    const currSummary = ensureCurrency(curr);
    const netSummary = ensureNetwork(rec.network, curr);
    netSummary.count += 1;

    currSummary.totalGrossVolumeCents += rec.grossAmountCents;
    netSummary.grossCents += rec.grossAmountCents;

    switch (rec.status) {
      case 'pending':
        currSummary.pendingCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        break;
      case 'approved':
        currSummary.approvedUnpaidCents += rec.commissionCents;
        currSummary.effectiveCommissionCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        break;
      case 'paid_receipt':
        currSummary.paidReceiptCents += rec.commissionCents;
        currSummary.effectiveCommissionCents += rec.commissionCents;
        netSummary.commissionCents += rec.commissionCents;
        netSummary.paidCents += rec.commissionCents;
        break;
      case 'reversed':
        // A fully reversed transaction contributes nothing to effective commission.
        currSummary.reversedCents += rec.commissionCents;
        break;
    }
  }

  // Partial refunds / adjustments: keep the history and reduce the commission
  // of the currency they belong to. Never mutate the original lifecycle row.
  for (const rec of adjustments) {
    const curr = currencyFor(rec);
    const amount = Math.abs(rec.commissionCents);
    const currSummary = ensureCurrency(curr);
    currSummary.adjustmentCents += amount;
    currSummary.reversedCents += amount;
    currSummary.effectiveCommissionCents -= amount;
    const netSummary = ensureNetwork(rec.network, curr);
    netSummary.commissionCents -= amount;
  }

  for (const [network, set] of Object.entries(currencySets)) {
    const entry = byNetwork[network];
    if (entry) {
      entry.currencies = [...set].sort();
      entry.mixedCurrencies = set.size > 1;
    }
  }

  const isSingleCurrency = currencies.size <= 1;
  const single = isSingleCurrency ? byCurrency[[...currencies][0] ?? 'USD'] : undefined;

  // A single-number total that mixes USD + USDT + EUR is a false balance. When
  // mixed, expose zeros plus an explicit availability flag; byCurrency is truth.
  const totals = single ?? emptyCurrency('MIXED');
  return {
    workspaceId,
    pendingCents: isSingleCurrency ? totals.pendingCents : 0,
    approvedUnpaidCents: isSingleCurrency ? totals.approvedUnpaidCents : 0,
    reversedCents: isSingleCurrency ? totals.reversedCents : 0,
    paidReceiptCents: isSingleCurrency ? totals.paidReceiptCents : 0,
    adjustmentCents: isSingleCurrency ? totals.adjustmentCents : 0,
    totalGrossVolumeCents: isSingleCurrency ? totals.totalGrossVolumeCents : 0,
    platformFeeCents: 0,
    effectiveCommissionCents: isSingleCurrency ? totals.effectiveCommissionCents : 0,
    currencies: [...currencies].sort(),
    isSingleCurrency,
    totalsAvailable: isSingleCurrency,
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
