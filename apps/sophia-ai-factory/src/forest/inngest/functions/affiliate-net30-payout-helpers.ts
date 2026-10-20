/**
 * Affiliate NET-30 Payout — Pure Aggregation & Routing Helpers
 *
 * Threshold and grouping logic kept separate from the D1-touching runner so
 * the money rules are unit-testable without a database.
 *
 * @module forest/inngest/functions/affiliate-net30-payout-helpers
 */

import {
  AFFILIATE_MIN_PAYOUT_CENTS,
  AFFILIATE_AUTO_APPROVE_MAX_CENTS,
} from '@/seed/config/revenue-share';

/** One partner's aggregated mature commissions. */
export interface PartnerPayoutPlan {
  partnerId: string;
  amountCents: number;
  commissionCount: number;
}

/** Outcome for one partner in a run. */
export interface PartnerPayoutOutcome extends PartnerPayoutPlan {
  status: 'pending_approval' | 'auto_approved' | 'skipped_below_minimum' | 'failed';
  payoutId?: string;
  payoutReference?: string;
  reason?: string;
}

export interface Net30PayoutResult {
  partnerCount: number;
  createdCount: number;
  pendingApprovalCount: number;
  autoApprovedCount: number;
  skippedCount: number;
  failedCount: number;
  totalAmountCents: number;
  outcomes: PartnerPayoutOutcome[];
}

interface MatureCommissionRow {
  partner_id: string;
  commission_count: number;
  total_cents: number | null;
}

/** Groups mature payable totals by partner. */
export function aggregateByPartner(rows: MatureCommissionRow[]): PartnerPayoutPlan[] {
  const totals = new Map<string, PartnerPayoutPlan>();

  for (const row of rows) {
    const plan = totals.get(row.partner_id) ?? {
      partnerId: row.partner_id,
      amountCents: 0,
      commissionCount: 0,
    };
    plan.amountCents += row.total_cents ?? 0;
    plan.commissionCount += row.commission_count ?? 0;
    totals.set(row.partner_id, plan);
  }

  return [...totals.values()];
}

/** Whether a partner's mature total clears the minimum payout threshold. */
export function isAboveMinimum(amountCents: number): boolean {
  return amountCents >= AFFILIATE_MIN_PAYOUT_CENTS;
}

/** Whether an approved payout needs admin sign-off. */
export function needsAdminApproval(amountCents: number): boolean {
  return amountCents > AFFILIATE_AUTO_APPROVE_MAX_CENTS;
}

/** Folds a list of partner outcomes into the run summary. */
export function summarizePayoutRun(
  outcomes: PartnerPayoutOutcome[],
  partnerCount: number,
): Net30PayoutResult {
  const created = outcomes.filter(
    (o) => o.status === 'pending_approval' || o.status === 'auto_approved',
  );

  return {
    partnerCount,
    createdCount: created.length,
    pendingApprovalCount: outcomes.filter((o) => o.status === 'pending_approval').length,
    autoApprovedCount: outcomes.filter((o) => o.status === 'auto_approved').length,
    skippedCount: outcomes.filter((o) => o.status === 'skipped_below_minimum').length,
    failedCount: outcomes.filter((o) => o.status === 'failed').length,
    totalAmountCents: created.reduce((sum, o) => sum + o.amountCents, 0),
    outcomes,
  };
}
