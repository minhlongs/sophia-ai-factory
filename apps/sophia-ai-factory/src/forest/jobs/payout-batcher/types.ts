export const MIN_PAYOUT_THRESHOLD_CENTS = 100; // $1.00 threshold

export type PayoutRail = 'nowpayments_usdt' | 'stripe_connect';

export interface PayoutBatchResult {
  success: boolean;
  batchId: string;
  totalAmountCents: number;
  recipientCount: number;
  claimedRowIds: string[];
  externalPaymentId?: string;
  error?: string;
}

export interface PayableCommissionRow {
  id: string;
  affiliate_id: string;
  commission_cents: number;
}
