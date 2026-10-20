/**
 * PayOS VietQR rail for contract checkout.
 *
 * A unique order code is generated and persisted BEFORE the provider call so a
 * payment link created during a timeout can still be correlated by code.
 *
 * @module land/contracts/workflow/contract-rail-payos
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createPayOsInvoice } from '@/land/payments/payos';
import { PayOsDefinitiveError } from '@/land/payments/payos-gateway/types';
import type { EnterpriseContract } from '@/seed/types/enterprise/contracts';
import {
  assertNoPendingIntent, linkContractToInvoice, linkProviderToOrder,
  markContractOrderFailed, persistContractIntent, type ContractIntentInput,
} from './contract-payment-intent-store';
import type { ContractPaymentInitiationResult, InitiatePaymentInput } from './types';
import type { ContractAmounts } from './contract-payment-amounts';

const PENDING_INTENT_MESSAGE =
  'A PayOS contract checkout is already pending; reconcile it before creating another checkout';

export async function runPayOsRail(
  db: D1Database,
  contract: EnterpriseContract,
  input: InitiatePaymentInput,
  amounts: ContractAmounts,
  invoice: { id: string; totalAmountCents: number },
  orderId: string,
  now: number,
): Promise<ContractPaymentInitiationResult> {
  const providerOrderCode = await persistUniqueOrderCode(db, orderId, {
    userId: input.userId, contractId: contract.id, invoiceId: invoice.id,
    period: amounts.period, amountCents: amounts.amountCents,
    amountVnd: invoice.totalAmountCents,
    customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
  });

  await linkContractToInvoice(db, {
    contractId: contract.id, invoiceId: invoice.id, rail: 'PAYOS', now,
  }, orderId);

  let payOsResult;
  try {
    payOsResult = await createPayOsInvoice({
      tier: 'ENTERPRISE',
      period: amounts.period,
      userId: input.userId,
      orderId,
      customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
      amountVndOverride: invoice.totalAmountCents,
      orderCodeOverride: providerOrderCode,
    });
    if (payOsResult.orderCode !== providerOrderCode) {
      throw new Error('PayOS returned an order code different from the persisted checkout intent');
    }
  } catch (error) {
    if (error instanceof PayOsDefinitiveError) {
      await markContractOrderFailed(db, orderId);
    }
    // The provider may have created a payment link before the request timed out.
    // Keep the durable intent pending so a signed IPN can reconcile by order code.
    throw new Error(`PayOS contract checkout failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  await linkProviderToOrder(db, 'PAYOS', orderId, payOsResult.paymentLinkId,
    payOsResult.checkoutUrl, providerOrderCode);

  return {
    paymentRail: 'PAYOS',
    orderId,
    invoiceId: invoice.id,
    checkoutUrl: payOsResult.checkoutUrl,
    qrUrl: payOsResult.qrUrl,
    amountCents: amounts.amountCents,
    providerPaymentId: payOsResult.paymentLinkId,
    providerOrderCode: payOsResult.orderCode,
    amountVnd: invoice.totalAmountCents,
  };
}

/**
 * Generate and persist a unique code, retrying on the collision that a
 * competing request produced the same value. `providerOrderCode` stays in this
 * scope so the persisted row and the provider request always agree.
 */
async function persistUniqueOrderCode(
  db: D1Database,
  orderId: string,
  input: Omit<ContractIntentInput, 'orderId' | 'providerOrderCode'>,
): Promise<number> {
  let providerOrderCode = 0;
  let orderPersisted = false;
  for (let attempt = 0; attempt < 5 && !orderPersisted; attempt += 1) {
    const randomCode = crypto.getRandomValues(new Uint32Array(1))[0];
    providerOrderCode = 100_000_000 + (randomCode % 900_000_000);
    try {
      await persistContractIntent(db, 'PAYOS', { ...input, orderId, providerOrderCode });
      orderPersisted = true;
    } catch {
      // The insert may have failed because a competing checkout already holds a
      // pending intent for this contract, which must abort rather than retry.
      await assertNoPendingIntent(db, input.contractId, PENDING_INTENT_MESSAGE);
    }
  }
  if (!orderPersisted) {
    throw new Error('Could not persist a unique PayOS contract payment correlation after five attempts');
  }
  return providerOrderCode;
}
