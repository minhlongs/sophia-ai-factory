/**
 * Server Actions for Cross-Border Partner Commission Ledger & Withholding Tax Operations
 *
 * Implements authenticated Server Actions for cross-border multi-currency commission tracking,
 * statutory withholding tax calculation, and payout settlements.
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/partners/*
 *
 * @module land/partners/partner-cross-border-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getPartnerByUserId } from '@/tree/partners/partner-service';
import {
  calculateCrossBorderPayout,
  recordCrossBorderCommission,
  getCrossBorderLedgerByPartner,
  getCrossBorderLedgerSummary,
  settleCrossBorderPayout,
} from '@/tree/partners/cross-border-ledger';
import type {
  WithholdingJurisdiction,
  LedgerPayoutCurrency,
  TaxCertificateStatus,
  TaxCalculationResult,
  CrossBorderPayoutCalculation,
  PartnerCrossBorderLedgerEntry,
  CrossBorderPartnerSummary,
} from '@/seed/types/cross-border-ledger';

export interface CrossBorderActionError {
  code: string;
  message: string;
}

export interface PreviewCrossBorderPayoutInput {
  grossCents: number;
  jurisdiction: WithholdingJurisdiction;
  targetCurrency: LedgerPayoutCurrency;
  baseFxRate?: number;
  hedgingBufferPct?: number;
  isIndividual?: boolean;
  certificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
  taxIdNumber?: string | null;
}

export interface RecordCrossBorderCommissionActionInput {
  partnerId: string;
  orderId: string;
  grossCents: number;
  whtJurisdiction: WithholdingJurisdiction;
  payoutCurrency: LedgerPayoutCurrency;
  baseFxRate?: number;
  hedgingBufferPct?: number;
  isIndividual?: boolean;
  taxIdNumber?: string | null;
  taxCertificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
}

export interface SettleCrossBorderPayoutActionInput {
  ledgerId: string;
  batchId: string;
}

/**
 * Preview withholding tax deduction and hedged local currency payout without persisting to D1.
 * Available to authenticated users for transparent fee and tax estimation.
 */
export async function previewCrossBorderPayoutAction(
  input: PreviewCrossBorderPayoutInput,
): Promise<Result<{ tax: TaxCalculationResult; payout: CrossBorderPayoutCalculation }, CrossBorderActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to preview cross-border payout' });
    }

    if (typeof input.grossCents !== 'number' || input.grossCents < 0) {
      return failure({ code: 'INVALID_AMOUNT', message: 'Gross amount must be a positive integer in cents' });
    }

    const result = calculateCrossBorderPayout(input);
    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to preview cross-border payout', { error: error.message });
    return failure({ code: 'PREVIEW_FAILED', message: error.message });
  }
}

/**
 * Record an attributed cross-border commission and calculate withholding tax + FX reserve.
 */
export async function recordCrossBorderCommissionAction(
  input: RecordCrossBorderCommissionActionInput,
): Promise<Result<PartnerCrossBorderLedgerEntry, CrossBorderActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    if (!input.partnerId || !input.orderId) {
      return failure({ code: 'INVALID_INPUT', message: 'Partner ID and Order ID are required' });
    }

    if (typeof input.grossCents !== 'number' || input.grossCents <= 0) {
      return failure({ code: 'INVALID_AMOUNT', message: 'Commission amount must be greater than zero' });
    }

    const entry = await recordCrossBorderCommission(db, {
      partnerId: input.partnerId,
      orderId: input.orderId,
      grossCents: input.grossCents,
      whtJurisdiction: input.whtJurisdiction,
      payoutCurrency: input.payoutCurrency,
      baseFxRate: input.baseFxRate,
      hedgingBufferPct: input.hedgingBufferPct,
      isIndividual: input.isIndividual,
      taxIdNumber: input.taxIdNumber,
      taxCertificateStatus: input.taxCertificateStatus,
      customTreatyRatePct: input.customTreatyRatePct,
    });

    logger.info('Recorded cross-border partner commission', {
      ledgerId: entry.id,
      partnerId: entry.partner_id,
      netCents: entry.net_commission_cents,
      payoutCurrency: entry.payout_currency,
      localPayout: entry.net_payout_local_amount,
    });

    return success(entry);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to record cross-border commission', { error: error.message });
    return failure({ code: 'RECORD_COMMISSION_FAILED', message: error.message });
  }
}

/**
 * Retrieve cross-border commission ledger entries for the authenticated partner.
 */
export async function getPartnerCrossBorderLedgerAction(
  limit = 50,
): Promise<Result<PartnerCrossBorderLedgerEntry[], CrossBorderActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found for user' });
    }

    const entries = await getCrossBorderLedgerByPartner(db, partner.id, limit);
    return success(entries);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to fetch cross-border ledger', { error: error.message });
    return failure({ code: 'FETCH_LEDGER_FAILED', message: error.message });
  }
}

/**
 * Retrieve cross-border financial summary (gross, withholding, net, settled) for the authenticated partner.
 */
export async function getPartnerCrossBorderSummaryAction(): Promise<
  Result<CrossBorderPartnerSummary, CrossBorderActionError>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found for user' });
    }

    const summary = await getCrossBorderLedgerSummary(db, partner.id);
    return success(summary);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to fetch cross-border summary', { error: error.message });
    return failure({ code: 'FETCH_SUMMARY_FAILED', message: error.message });
  }
}

/**
 * Settle a cross-border commission ledger entry upon disbursement confirmation.
 */
export async function settleCrossBorderPayoutAction(
  input: SettleCrossBorderPayoutActionInput,
): Promise<Result<PartnerCrossBorderLedgerEntry, CrossBorderActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    if (!input.ledgerId || !input.batchId) {
      return failure({ code: 'INVALID_INPUT', message: 'Ledger ID and Batch ID are required' });
    }

    const updated = await settleCrossBorderPayout(db, input.ledgerId, input.batchId);
    logger.info('Cross-border commission settled', {
      ledgerId: updated.id,
      batchId: input.batchId,
      status: updated.status,
    });

    return success(updated);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to settle cross-border payout', { error: error.message });
    return failure({ code: 'SETTLE_FAILED', message: error.message });
  }
}
