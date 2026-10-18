'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { recordCrossBorderCommission } from '@/tree/partners/cross-border-ledger';
import type { PartnerCrossBorderLedgerEntry, CrossBorderPartnerSummary } from '@/seed/types/cross-border-ledger';
import type { CrossBorderActionError, RecordCrossBorderCommissionActionInput } from './types';
import { getCrossBorderLedgerByPartner, getCrossBorderLedgerSummary } from '@/tree/partners/cross-border-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolveCrossBorderAuth, handleCrossBorderError } from './ledger-helpers';

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
  const authResult = await resolveCrossBorderAuth();
  if (!authResult.ok) return authResult;

  try {
    const entries = await getCrossBorderLedgerByPartner(authResult.value.db, authResult.value.partnerId, limit);
    return success(entries);
  } catch (err) {
    return failure(handleCrossBorderError('fetch cross-border ledger', err));
  }
}

/**
 * Retrieve cross-border financial summary (gross, withholding, net, settled) for the authenticated partner.
 */
export async function getPartnerCrossBorderSummaryAction(): Promise<
  Result<CrossBorderPartnerSummary, CrossBorderActionError>
> {
  const authResult = await resolveCrossBorderAuth();
  if (!authResult.ok) return authResult;

  try {
    const summary = await getCrossBorderLedgerSummary(authResult.value.db, authResult.value.partnerId);
    return success(summary);
  } catch (err) {
    return failure(handleCrossBorderError('fetch cross-border summary', err));
  }
}