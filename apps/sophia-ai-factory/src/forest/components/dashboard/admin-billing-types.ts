/**
 * Type definitions for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-types
 */

export interface BillingSummary {
  mrr: number;
  activeLicensesCount: number;
  dunningStates: Record<string, number>;
  unbilledOverageTotal: number;
  totalRevenue30d: number;
  refundCount30d: number;
  refundTotal30d: number;
}

export interface OverageEvent {
  id: string;
  userId: string;
  licenseNonce: string;
  eventType: string;
  creditsDelta: number;
  description: string;
  createdAt: string;
  billed: boolean;
}

export interface DunningState {
  nonce: string;
  state: string;
  allowed: boolean;
  gracePeriodEndsAt: string | null;
  nextRetryAt: string | null;
  failedPaymentCount: number;
  blockReason: string | null;
  history: {
    attemptNumber: number;
    attemptType: string;
    success: boolean;
    failureReason: string | null;
    createdAt: string;
  }[];
}
