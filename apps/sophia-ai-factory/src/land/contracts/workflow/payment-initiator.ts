/**
 * Enterprise Contract Payment Initiator
 *
 * Implements dual-rail checkout initiation (NOWPayments USDT & PayOS VietQR).
 *
 * Layer: land (Business domain workflow)
 *
 * @module land/contracts/workflow/payment-initiator
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getContractById } from './contract-converter';
import { resolveContractAmounts } from './contract-payment-amounts';
import { createContractInvoice } from './contract-invoice-builder';
import { assertNoPendingIntent } from './contract-payment-intent-store';
import { runNowPaymentsRail } from './contract-rail-nowpayments';
import { runPayOsRail } from './contract-rail-payos';
import type { InitiatePaymentInput, ContractPaymentInitiationResult } from './types';

const GENERIC_PENDING_INTENT_MESSAGE =
  'A contract checkout is already pending; reconcile it before creating another checkout'

/**
 * Initiate payment checkout for a signed enterprise contract.
 * Bridges to NOWPayments USDT or PayOS VietQR with dynamic pricing overrides.
 */
export async function initiateContractPayment(
  db: D1Database,
  input: InitiatePaymentInput,
): Promise<ContractPaymentInitiationResult> {
  const contract = await getContractById(db, input.contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${input.contractId}`);
  }

  if (contract.status !== 'signed' && contract.status !== 'active') {
    throw new Error(`Contract must be signed before initiating payment. Current status: ${contract.status}`);
  }

  await assertNoPendingIntent(db, contract.id, GENERIC_PENDING_INTENT_MESSAGE);

  const amounts = resolveContractAmounts(contract);
  const invoice = await createContractInvoice(db, contract, input.paymentRail, amounts, input);

  const now = Math.floor(Date.now() / 1000);
  const orderId = `sophia_contract_${contract.id}_${crypto.randomUUID()}`;

  return input.paymentRail === 'NOWPAYMENTS'
    ? runNowPaymentsRail(db, contract, input, amounts, invoice, orderId, now)
    : runPayOsRail(db, contract, input, amounts, invoice, orderId, now);
}
