/**
 * E-commerce Commission Reconciliation & Return Risk Engine
 *
 * Implements net commission reconciliation and return risk mitigation
 * for TikTok Shop and Shopee affiliate orders.
 *
 * Financial Invariant:
 * Net Commission = Gross Commission - Refunded Amount - Risk Reserve (Holdback).
 * Commissions are only unlocked after the statutory return window expires.
 *
 * Layer: land/affiliates/reconciliation (Business Workflow)
 * @module land/affiliates/reconciliation/ecommerce-reconciliation-engine
 */

import type { NormalizedEcommercePostbackEvent } from '../postbacks/ecommerce-postback-types';

export interface ReconciliationBatchInput {
  tenantId: string;
  orders: NormalizedEcommercePostbackEvent[];
  defaultHoldbackRatePercent?: number; // e.g. 10% risk holdback
}

export interface ReconciledLedgerEntry {
  orderId: string;
  network: string;
  grossCommissionCents: number;
  refundedCommissionCents: number;
  holdbackCents: number;
  netPayableCommissionCents: number;
  isUnlockedForPayout: boolean;
  status: 'PENDING_CLEARANCE' | 'RECONCILED_MATURED' | 'VOIDED_REFUNDED';
}

export interface ReconciliationSummary {
  tenantId: string;
  totalOrdersProcessed: number;
  totalGrossCommissionCents: number;
  totalRefundedCents: number;
  totalHoldbackCents: number;
  totalNetPayableCents: number;
  highRiskRefundRate: boolean;
  entries: ReconciledLedgerEntry[];
}

/**
 * Reconciles a batch of e-commerce affiliate conversions.
 */
export function reconcileEcommerceBatch(
  input: ReconciliationBatchInput,
  currentTimestampMs = Date.now(),
): ReconciliationSummary {
  const { tenantId, orders } = input;
  const holdbackRate = (input.defaultHoldbackRatePercent ?? 10) / 100;

  let totalGross = 0;
  let totalRefunded = 0;
  let totalHoldback = 0;
  let totalNetPayable = 0;
  let refundedOrdersCount = 0;

  const entries: ReconciledLedgerEntry[] = [];

  for (const order of orders) {
    const isRefunded = order.status === 'ORDER_REFUNDED' || order.status === 'ORDER_CANCELLED';
    const gross = order.commissionCents;
    totalGross += gross;

    if (isRefunded) {
      refundedOrdersCount++;
      totalRefunded += gross;

      entries.push({
        orderId: order.orderId,
        network: order.network,
        grossCommissionCents: gross,
        refundedCommissionCents: gross,
        holdbackCents: 0,
        netPayableCommissionCents: 0,
        isUnlockedForPayout: false,
        status: 'VOIDED_REFUNDED',
      });
      continue;
    }

    const holdback = Math.round(gross * holdbackRate);
    const net = gross - holdback;
    const isMatured = currentTimestampMs >= order.clearanceDueMs;

    totalHoldback += holdback;
    totalNetPayable += net;

    entries.push({
      orderId: order.orderId,
      network: order.network,
      grossCommissionCents: gross,
      refundedCommissionCents: 0,
      holdbackCents: holdback,
      netPayableCommissionCents: net,
      isUnlockedForPayout: isMatured,
      status: isMatured ? 'RECONCILED_MATURED' : 'PENDING_CLEARANCE',
    });
  }

  const refundRate = orders.length > 0 ? refundedOrdersCount / orders.length : 0;
  // Trigger warning if refund/cancellation rate exceeds 15%
  const highRiskRefundRate = refundRate > 0.15;

  return {
    tenantId,
    totalOrdersProcessed: orders.length,
    totalGrossCommissionCents: totalGross,
    totalRefundedCents: totalRefunded,
    totalHoldbackCents: totalHoldback,
    totalNetPayableCents: totalNetPayable,
    highRiskRefundRate,
    entries,
  };
}
