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
import { PayOsDefinitiveError } from '@/land/payments/payos-gateway/types';
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

  {
    const pendingIntent = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE contract_id = ?1 AND purpose = 'contract' AND status = 'pending' LIMIT 1`)
      .bind(contract.id).first<{ order_id: string }>();
    if (pendingIntent) {
      throw new Error('A contract checkout is already pending; reconcile it before creating another checkout');
    }
  }

  const isAnnual = contract.billingCycle === 'annual';
  const amountCents = isAnnual ? contract.annualCommitmentCents : contract.monthlyCommitmentCents;
  const amountUsd = amountCents / 100;
  const configuredFx = process.env.USD_TO_VND;
  const usdToVnd = configuredFx ? Number(configuredFx) : 25400;
  if (!Number.isFinite(usdToVnd) || usdToVnd <= 0) throw new Error('USD_TO_VND must be a positive finite number');
  const netAmountVnd = Math.round((amountUsd * usdToVnd) / 1000) * 1000;

  // PayOS invoices are issued in VND and include the invoice engine's 10% VAT.
  // NOWPayments remains billed in USD.
  const invoice = await createInvoiceRecord(db, {
    orgId: contract.orgId,
    tier: 'ENTERPRISE',
    billingCycle: isAnnual ? 'annual' : 'monthly',
    amountCents: input.paymentRail === 'PAYOS' ? netAmountVnd : amountCents,
    currency: input.paymentRail === 'PAYOS' ? 'VND' : 'USD',
    fxRate: input.paymentRail === 'PAYOS' ? usdToVnd : 1,
    legalName: input.customerName || contract.customerSignerName || 'Enterprise Customer',
    billingAddress: 'Enterprise Registered Address',
    paymentRail: input.paymentRail,
    taxFormType: 'NONE',
  });

  const now = Math.floor(Date.now() / 1000);
  const orderId = `sophia_contract_${contract.id}_${crypto.randomUUID()}`;

  // 2. Invoke designated payment rail gateway
  if (input.paymentRail === 'NOWPAYMENTS') {
    const orderResult = await db.prepare(`INSERT INTO pending_orders (
        order_id, user_id, tier, period, payment_method, amount_usd_cents,
        customer_email, purpose, contract_id, invoice_id, status
      ) VALUES (?1, ?2, 'ENTERPRISE', ?3, 'nowpayments', ?4, ?5,
        'contract', ?6, ?7, 'pending')`)
      .bind(orderId, input.userId, isAnnual ? 'yearly' : 'monthly',
        invoice.totalAmountCents, input.customerEmail || contract.customerSignerEmail || null,
        contract.id, invoice.id)
      .run();
    if (!orderResult.success || orderResult.meta?.changes !== 1) {
      throw new Error('Could not persist NOWPayments contract payment correlation');
    }
    const contractUpdate = await db
      .prepare(`UPDATE enterprise_contracts SET last_invoice_id = ?1, payment_rail = ?2,
        updated_at = ?3 WHERE id = ?4 AND status IN ('signed', 'active')`)
      .bind(invoice.id, input.paymentRail, now, contract.id)
      .run();
    if (!contractUpdate.success || contractUpdate.meta?.changes !== 1) {
      await db.prepare("UPDATE pending_orders SET status = 'failed' WHERE order_id = ?1 AND status = 'pending'")
        .bind(orderId).run();
      throw new Error('Contract changed before payment checkout could be linked');
    }
    try {
      const checkout = await createCheckout({
        tierId: 'ENTERPRISE',
        userId: input.userId,
        customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
        period: isAnnual ? 'yearly' : 'monthly',
        orderId,
        priceAmountOverride: invoice.totalAmountCents / 100,
      });

      const linked = await db.prepare(`UPDATE pending_orders SET provider_payment_id = ?1,
        invoice_url = ?2 WHERE order_id = ?3 AND status = 'pending'`)
        .bind(checkout.invoiceId, checkout.invoiceUrl, orderId).run();
      if (!linked.success || linked.meta?.changes !== 1) {
        logger.warn('[QuoteToCash] NOWPayments invoice link will be reconciled from order ID', { orderId });
      }

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

  // Save a recoverable order code before creating the provider link. If the
  // paymentLinkId write fails, the signed webhook can still correlate by code.
  let providerOrderCode = 0;
  let orderPersisted = false;
  for (let attempt = 0; attempt < 5 && !orderPersisted; attempt += 1) {
    const randomCode = crypto.getRandomValues(new Uint32Array(1))[0];
    providerOrderCode = 100_000_000 + (randomCode % 900_000_000);
    try {
      const orderResult = await db.prepare(`INSERT INTO pending_orders (
          order_id, user_id, tier, period, payment_method, amount_usd_cents, amount_vnd,
          customer_email, purpose, contract_id,
          invoice_id, provider_order_code, status
        ) VALUES (?1, ?2, 'ENTERPRISE', ?3, 'payos', ?4, ?5, ?6,
          'contract', ?7, ?8, ?9, 'pending')`)
        .bind(orderId, input.userId, isAnnual ? 'yearly' : 'monthly', amountCents,
          invoice.totalAmountCents, input.customerEmail || contract.customerSignerEmail || null,
          contract.id, invoice.id, providerOrderCode)
        .run();
      orderPersisted = orderResult.success && orderResult.meta?.changes === 1;
    } catch {
      const competingIntent = await db.prepare(`SELECT order_id FROM pending_orders
        WHERE contract_id = ?1 AND purpose = 'contract' AND status = 'pending' LIMIT 1`)
        .bind(contract.id).first<{ order_id: string }>();
      if (competingIntent) {
        throw new Error('A PayOS contract checkout is already pending; reconcile it before creating another checkout');
      }
    }
  }
  if (!orderPersisted) {
    throw new Error('Could not persist a unique PayOS contract payment correlation after five attempts');
  }

  const contractUpdate = await db
    .prepare(`UPDATE enterprise_contracts SET last_invoice_id = ?1, payment_rail = ?2,
      updated_at = ?3 WHERE id = ?4 AND status IN ('signed', 'active')`)
    .bind(invoice.id, input.paymentRail, now, contract.id)
    .run();
  if (!contractUpdate.success || contractUpdate.meta?.changes !== 1) {
    await db.prepare("UPDATE pending_orders SET status = 'failed' WHERE order_id = ?1 AND status = 'pending'")
      .bind(orderId).run();
    throw new Error('Contract changed before payment checkout could be linked');
  }

  let payOsResult;
  try {
    payOsResult = await createPayOsInvoice({
      tier: 'ENTERPRISE',
      period: isAnnual ? 'yearly' : 'monthly',
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
      await db.prepare("UPDATE pending_orders SET status = 'failed' WHERE order_id = ?1 AND status = 'pending'")
        .bind(orderId).run();
    }
    // The provider may have created a payment link before the request timed out.
    // Keep the durable intent pending so a signed IPN can reconcile by order code.
    throw new Error(`PayOS contract checkout failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const linked = await db.prepare(`UPDATE pending_orders
      SET provider_payment_id = ?1, invoice_url = ?2
      WHERE order_id = ?3 AND provider_order_code = ?4 AND status = 'pending'`)
      .bind(payOsResult.paymentLinkId, payOsResult.checkoutUrl, orderId, providerOrderCode)
      .run();
    if (!linked.success || linked.meta?.changes !== 1) {
      logger.warn('[QuoteToCash] PayOS link ID will be reconciled from signed order code', { orderId, providerOrderCode });
    }
  } catch (error) {
    logger.warn('[QuoteToCash] PayOS link ID persistence failed; signed order code remains correlatable', {
      orderId, providerOrderCode, error: String(error),
    });
  }

  return {
    paymentRail: 'PAYOS',
    orderId,
    invoiceId: invoice.id,
    checkoutUrl: payOsResult.checkoutUrl,
    qrUrl: payOsResult.qrUrl,
    amountCents,
    providerPaymentId: payOsResult.paymentLinkId,
    providerOrderCode: payOsResult.orderCode,
    amountVnd: invoice.totalAmountCents,
  };
}
