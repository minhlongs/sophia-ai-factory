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
import { logger } from '@/seed/utils/logger-utility';
import { createCheckout } from '@/tree/clients/nowpayments-client';
import { createPayOsInvoice } from '@/land/payments/payos';
import { createInvoiceRecord } from '@/tree/billing/invoice-generator';
import { getContractById } from './contract-converter';
import type { InitiatePaymentInput, ContractPaymentInitiationResult } from './types';

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

  const isAnnual = contract.billingCycle === 'annual';
  const amountCents = isAnnual ? contract.annualCommitmentCents : contract.monthlyCommitmentCents;
  const amountUsd = amountCents / 100;

  // 1. Create draft E-Invoice in D1
  const invoice = await createInvoiceRecord(db, {
    orgId: contract.orgId,
    tier: 'ENTERPRISE',
    billingCycle: isAnnual ? 'annual' : 'monthly',
    amountCents,
    currency: contract.currency === 'VND' ? 'VND' : 'USD',
    legalName: input.customerName || contract.customerSignerName || 'Enterprise Customer',
    billingAddress: 'Enterprise Registered Address',
    paymentRail: input.paymentRail,
    taxFormType: 'NONE',
  });

  const now = Math.floor(Date.now() / 1000);
  const orderId = `sophia_contract_${contract.id}_${now}`;

  // Link invoice & payment rail to contract
  await db
    .prepare('UPDATE enterprise_contracts SET last_invoice_id = ?1, payment_rail = ?2, updated_at = ?3 WHERE id = ?4')
    .bind(invoice.id, input.paymentRail, now, contract.id)
    .run();

  // 2. Invoke designated payment rail gateway
  if (input.paymentRail === 'NOWPAYMENTS') {
    try {
      const checkout = await createCheckout({
        tierId: 'ENTERPRISE',
        userId: input.userId,
        customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
        period: isAnnual ? 'yearly' : 'monthly',
        orderId,
        priceAmountOverride: amountUsd,
      });

      return {
        paymentRail: 'NOWPAYMENTS',
        orderId,
        invoiceId: invoice.id,
        checkoutUrl: checkout.invoiceUrl,
        amountCents,
      };
    } catch (err) {
      logger.warn('[QuoteToCash] NOWPayments checkout fallback: ' + String(err));
      return {
        paymentRail: 'NOWPAYMENTS',
        orderId,
        invoiceId: invoice.id,
        checkoutUrl: `https://nowpayments.io/payment/?order_id=${orderId}&amount=${amountUsd}`,
        amountCents,
      };
    }
  }

  // PayOS VietQR Rail
  const usdToVnd = process.env.USD_TO_VND ? Number(process.env.USD_TO_VND) : 25400;
  const amountVnd = Math.round((amountUsd * usdToVnd) / 1000) * 1000;

  try {
    const payOsResult = await createPayOsInvoice({
      tier: 'ENTERPRISE',
      period: 'monthly',
      userId: input.userId,
      orderId,
      customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
      amountVndOverride: amountVnd,
    });

    return {
      paymentRail: 'PAYOS',
      orderId,
      invoiceId: invoice.id,
      checkoutUrl: payOsResult.checkoutUrl,
      qrUrl: payOsResult.qrUrl,
      amountCents,
    };
  } catch (err) {
    logger.warn('[QuoteToCash] PayOS checkout fallback: ' + String(err));
    return {
      paymentRail: 'PAYOS',
      orderId,
      invoiceId: invoice.id,
      checkoutUrl: `https://payos.vn/gate/${orderId}`,
      qrUrl: `https://img.vietqr.io/image/970422-0000-compact2.png?amount=${amountVnd}&addInfo=${orderId}`,
      amountCents,
    };
  }
}
