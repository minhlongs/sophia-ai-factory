/**
 * E-Invoice creation for a contract checkout.
 *
 * The rail decides denomination: PayOS records the VND amount and the FX rate
 * actually applied, NOWPayments records the USD amount at parity.
 *
 * @module land/contracts/workflow/contract-invoice-builder
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createInvoiceRecord } from '@/tree/billing/invoice-generator';
import type { EnterpriseContract } from '@/seed/types/enterprise/contracts';
import type { PaymentRail } from './contract-payment-intent-store';
import type { ContractAmounts } from './contract-payment-amounts';

export type ContractInvoiceInput = {
  customerName?: string;
  customerEmail?: string;
};

export async function createContractInvoice(
  db: D1Database,
  contract: EnterpriseContract,
  rail: PaymentRail,
  amounts: ContractAmounts,
  input: ContractInvoiceInput,
) {
  return createInvoiceRecord(db, {
    orgId: contract.orgId,
    tier: 'ENTERPRISE',
    billingCycle: amounts.isAnnual ? 'annual' : 'monthly',
    amountCents: rail === 'PAYOS' ? amounts.netAmountVnd : amounts.amountCents,
    currency: rail === 'PAYOS' ? 'VND' : 'USD',
    fxRate: rail === 'PAYOS' ? amounts.usdToVnd : 1,
    legalName: input.customerName || contract.customerSignerName || 'Enterprise Customer',
    billingAddress: 'Enterprise Registered Address',
    paymentRail: rail,
    taxFormType: 'NONE',
  });
}
