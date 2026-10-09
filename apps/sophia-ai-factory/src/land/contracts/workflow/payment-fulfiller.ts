/**
 * Enterprise Contract Payment Fulfiller
 *
 * Implements payment fulfillment, E-Invoice marking, MCU provisioning, and deal closing.
 *
 * Layer: land (Business domain workflow)
 *
 * @module land/contracts/workflow/payment-fulfiller
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { markInvoicePaid } from '@/tree/billing/invoice-generator';
import { addCredits } from '@/tree/mcu/credits-repo';
import { getContractById } from './contract-converter';
import type { FulfillPaymentInput, FulfillPaymentResult } from './types';

/**
 * Fulfill payment completion for an enterprise contract.
 * Marks invoice paid, updates contract to 'active', provisions MCU compute credits,
 * and updates associated enterprise deal to 'closed_won'.
 */
export async function fulfillContractPayment(
  db: D1Database,
  input: FulfillPaymentInput,
): Promise<FulfillPaymentResult> {
  const contract = await getContractById(db, input.contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${input.contractId}`);
  }

  // Idempotency check: if contract is already active, return without double-provisioning
  if (contract.status === 'active') {
    logger.info(`[QuoteToCash] Contract ${contract.id} already active. Skipping duplicate fulfillment.`);
    return {
      success: true,
      contractId: contract.id,
      status: contract.status,
      creditsProvisioned: contract.mcuCapacityMonthly,
      invoiceId: contract.lastInvoiceId ?? null,
    };
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. Mark E-Invoice as paid
  if (contract.lastInvoiceId) {
    try {
      await markInvoicePaid(
        db,
        contract.lastInvoiceId,
        now,
        input.paymentRail,
        input.paymentReference,
      );
    } catch (err) {
      logger.error('[QuoteToCash] Error marking invoice paid', err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 2. Provision committed monthly MCU compute credits to the user/org balance
  try {
    await addCredits(
      input.paidByUserId,
      contract.mcuCapacityMonthly,
      'ENTERPRISE_CONTRACT_ACTIVATION',
      {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        billingCycle: contract.billingCycle,
        capacityMcu: contract.mcuCapacityMonthly,
        paymentRail: input.paymentRail,
        paymentReference: input.paymentReference,
      },
    );
  } catch (err) {
    logger.error('[QuoteToCash] Error provisioning MCU credits', err instanceof Error ? err : new Error(String(err)));
  }

  // 3. Update contract status to 'active'
  await db
    .prepare('UPDATE enterprise_contracts SET status = ?1, payment_rail = ?2, updated_at = ?3 WHERE id = ?4')
    .bind('active', input.paymentRail, now, contract.id)
    .run();

  // 4. Update associated enterprise deal to 'closed_won' if deal_id exists
  if (contract.dealId) {
    try {
      await db
        .prepare("UPDATE enterprise_deals SET deal_stage = 'closed_won', updated_at = ?1 WHERE id = ?2")
        .bind(Date.now(), contract.dealId)
        .run();
    } catch {
      // Table may not exist yet if M1 runs concurrently — fail soft
      logger.info(`[QuoteToCash] Loose deal update skipped for dealId: ${contract.dealId}`);
    }
  }

  return {
    success: true,
    contractId: contract.id,
    status: 'active',
    creditsProvisioned: contract.mcuCapacityMonthly,
    invoiceId: contract.lastInvoiceId ?? null,
  };
}
