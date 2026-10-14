/**
 * Tier-1 and Tier-2 commission calculation and ledger insertion helper for affiliate webhooks.
 * @module land/affiliates/verifier/affiliate-ledger-recorder
 */

import { calculatePartnerCommission } from '../affiliate-partner-service';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import type {
  CommissionWebhookPayload,
  CommissionLedgerEntry,
} from './types';
import { calculatePayableTimestamp } from './replay-guard';
import { insertLedgerRecord } from './ledger-writer';

export async function recordTieredCommissionEntries(params: {
  db: D1Database;
  partnerRow: AffiliatePartnerRow;
  payload: CommissionWebhookPayload;
  activeSalesCount: number;
}): Promise<{ entries: CommissionLedgerEntry[]; payableAt: number }> {
  const { db, partnerRow, payload, activeSalesCount } = params;
  const now = payload.timestamp ?? Date.now();
  const payableAt = calculatePayableTimestamp(now);
  const nowSec = Math.floor(now / 1000);
  const tenantId = payload.tenantId || 'sophia-global';
  const offerId = payload.offerId || 'sophia_subscription';
  const entries: CommissionLedgerEntry[] = [];

  const tier1Calc = calculatePartnerCommission({
    orderAmountCents: payload.orderAmountCents,
    activeSalesCount,
    isTier2: false,
    partnerTier: partnerRow.tier,
    customRatePct: Number(partnerRow.commission_rate_pct),
  });

  const tier1LedgerId = `led_t1_${payload.conversionEventId}`;
  await insertLedgerRecord({
    db,
    ledgerId: tier1LedgerId,
    tenantId,
    partnerId: partnerRow.id,
    conversionEventId: payload.conversionEventId,
    offerId,
    orderAmountCents: payload.orderAmountCents,
    ratePct: tier1Calc.ratePct,
    commissionCents: tier1Calc.commissionCents,
    payableAt,
    nowSec,
  });

  entries.push({
    ledgerId: tier1LedgerId,
    affiliateId: partnerRow.id,
    partnerCode: partnerRow.partner_code,
    tier: tier1Calc.tier,
    ratePct: tier1Calc.ratePct,
    commissionCents: tier1Calc.commissionCents,
    payableAt,
    status: 'pending',
    isTier2: false,
  });

  if (partnerRow.parent_partner_id) {
    const parentRow = await db
      .prepare('SELECT * FROM affiliate_partners WHERE id = ?')
      .bind(partnerRow.parent_partner_id)
      .first<AffiliatePartnerRow>();

    if (parentRow && parentRow.status === 'active') {
      const tier2Calc = calculatePartnerCommission({
        orderAmountCents: payload.orderAmountCents,
        activeSalesCount: 0,
        isTier2: true,
      });

      const tier2LedgerId = `led_t2_${payload.conversionEventId}`;
      await insertLedgerRecord({
        db,
        ledgerId: tier2LedgerId,
        tenantId,
        partnerId: parentRow.id,
        conversionEventId: `${payload.conversionEventId}_t2`,
        offerId,
        orderAmountCents: payload.orderAmountCents,
        ratePct: tier2Calc.ratePct,
        commissionCents: tier2Calc.commissionCents,
        payableAt,
        nowSec,
        parentConversionId: tier1LedgerId,
      });

      entries.push({
        ledgerId: tier2LedgerId,
        affiliateId: parentRow.id,
        partnerCode: parentRow.partner_code,
        tier: 'TIER2',
        ratePct: tier2Calc.ratePct,
        commissionCents: tier2Calc.commissionCents,
        payableAt,
        status: 'pending',
        isTier2: true,
      });
    }
  }

  return { entries, payableAt };
}
