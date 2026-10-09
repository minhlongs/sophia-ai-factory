/**
 * Default Simulated Payment Rail Dispatcher
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/rail-dispatcher
 */

import type { PartnerPayoutBatch } from '@/tree/partners/types';

export async function defaultRailDispatcher(
  batch: PartnerPayoutBatch,
): Promise<{ success: boolean; externalReference?: string; txHash?: string; rawResponse?: Record<string, unknown>; error?: string }> {
  // USDT TRC-20 Rail Simulation
  if (batch.payout_rail === 'USDT') {
    const address = batch.destination_address?.trim();
    if (address && address.startsWith('FAIL_SIMULATION')) {
      return { success: false, error: 'NOWPAYMENTS_GATEWAY_TIMEOUT: 504' };
    }
    const simulatedTxHash = `trc20_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    return {
      success: true,
      externalReference: `np_payout_${batch.id.slice(-8)}`,
      txHash: simulatedTxHash,
      rawResponse: { rail: 'USDT_TRC20', txHash: simulatedTxHash, amountUsdt: batch.total_amount_cents / 100 },
    };
  }

  // VietQR PayOS Rail Simulation
  if (batch.payout_rail === 'VIETQR') {
    if (batch.destination_address && batch.destination_address.startsWith('FAIL_SIMULATION')) {
      return { success: false, error: 'PAYOS_BANK_RAIL_ERROR: Checksum failure or bank network unreachable' };
    }
    const simulatedTransRef = `payos_trans_${Date.now()}_${batch.id.slice(-6)}`;
    return {
      success: true,
      externalReference: simulatedTransRef,
      rawResponse: { rail: 'VIETQR_PAYOS', transactionRef: simulatedTransRef, amountVnd: batch.total_amount_local },
    };
  }

  // BANK_WIRE Rail Simulation
  if (batch.payout_rail === 'BANK_WIRE') {
    const wireRef = `wire_${Date.now()}_${batch.id.slice(-6)}`;
    return {
      success: true,
      externalReference: wireRef,
      rawResponse: { rail: 'BANK_WIRE', wireRef },
    };
  }

  return { success: false, error: `UNSUPPORTED_PAYOUT_RAIL: ${batch.payout_rail}` };
}
