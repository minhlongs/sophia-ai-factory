/**
 * Refund processor types and error definitions
 * @module land/refunds/processor/types
 */

export interface RefundProcessInput {
  /** The refund_requests row id */
  refundRequestId: string;
  /** Admin user who approved and is executing the refund */
  reviewedByUserId: string;
  /** Blockchain transaction hash from NOWPayments refund */
  txHash: string;
  /** Optional admin notes */
  notes?: string;
}

export interface RefundProcessResult {
  refundRequestId: string;
  ledgerEntryId: string;
  tierBefore: string;
  tierAfter: string;
  mcuClawedBack: number;
  transactionHash: string;
}

export interface RefundError {
  code: 'DUPLICATE_REFUND' | 'NOT_FOUND' | 'NOWPAYMENTS_API_ERROR' | 'INTERNAL_ERROR';
  message: string;
}

export class RefundProcessError extends Error {
  constructor(
    public code: RefundError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'RefundProcessError';
  }
}

export interface SubscriptionRow {
  plan: string;
  status: string;
}
