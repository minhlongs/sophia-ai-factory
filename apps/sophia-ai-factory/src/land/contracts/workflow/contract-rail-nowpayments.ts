/**
 * NOWPayments USDT rail for contract checkout.
 *
 * @module land/contracts/workflow/contract-rail-nowpayments
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createCheckout } from '@/tree/clients/nowpayments-client';
import type { EnterpriseContract } from '@/seed/types/enterprise/contracts';
import {
  linkContractToInvoice, linkProviderToOrder, persistContractIntent,
} from './contract-payment-intent-store';
import type { ContractPaymentInitiationResult, InitiatePaymentInput } from './types';
import type { ContractAmounts } from './contract-payment-amounts';

export async function runNowPaymentsRail(
  db: D1Database,
  contract: EnterpriseContract,
  input: InitiatePaymentInput,
  amounts: ContractAmounts,
  invoice: { id: string; totalAmountCents: number },
  orderId: string,
  now: number,
): Promise<ContractPaymentInitiationResult> {
  await persistContractIntent(db, 'NOWPAYMENTS', {
    orderId, userId: input.userId, contractId: contract.id, invoiceId: invoice.id,
    period: amounts.period, amountCents: invoice.totalAmountCents,
    customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
  });

  await linkContractToInvoice(db, {
    contractId: contract.id, invoiceId: invoice.id, rail: 'NOWPAYMENTS', now,
  }, orderId);

  try {
    const checkout = await createCheckout({
      tierId: 'ENTERPRISE',
      userId: input.userId,
      customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
      period: amounts.period,
      orderId,
      priceAmountOverride: invoice.totalAmountCents / 100,
    });

    await linkProviderToOrder(db, 'NOWPAYMENTS', orderId, checkout.invoiceId, checkout.invoiceUrl);

    return {
      paymentRail: 'NOWPAYMENTS',
      orderId,
      invoiceId: invoice.id,
      checkoutUrl: checkout.invoiceUrl,
      amountCents: invoice.totalAmountCents,
    };
  } catch (err) {
    throw new Error(`NOWPayments contract checkout failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
