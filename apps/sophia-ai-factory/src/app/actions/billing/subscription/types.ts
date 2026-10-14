/**
 * Subscription action types.
 */

export interface CancelSubscriptionResult {
  success: boolean;
  error?: string;
  /** Epoch seconds when the cancellation takes effect (end-of-cycle) */
  effectiveAt?: number;
}

export interface RefundablePurchase {
  id: string;
  sku: string;
  amount_cents: number;
  status: string;
  created_at: number;
  paid_at: number | null;
  days_remaining: number;
}

export interface ReinstateSubscriptionResult {
  success: boolean;
  error?: string;
}
