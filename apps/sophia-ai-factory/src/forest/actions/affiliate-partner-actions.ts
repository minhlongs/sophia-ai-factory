/**
 * Server Actions for Affiliate Partner Onboarding and Ledger Metrics
 *
 * Implements atomic invite redemption, referral profile activation, and KPI retrieval.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/affiliate-partner-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  redeemInviteSchema,
  type RedeemInviteInput,
  type PartnerLedgerKpiData,
  type CommissionLedgerItem,
} from './affiliate-payout-actions-schema';
import {
  buildDemoPartnerLedgerKpi,
  queryPartnerLedgerFromD1,
} from './affiliate-partner-ledger-helper';

export async function redeemAffiliateInviteAction(
  rawInput: RedeemInviteInput
): Promise<{ success: boolean; partnerId?: string; partnerCode?: string; error?: string }> {
  try {
    const parsed = redeemInviteSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid invite input' };
    const input = parsed.data;

    const db = await getD1();
    if (!db) return { success: false, error: 'Database binding unavailable' };

    const invite = await db
      .prepare('SELECT * FROM affiliate_invites WHERE invite_token = ?1 LIMIT 1')
      .bind(input.token)
      .first<{ id: string; status: string; expires_at: number; custom_commission_rate_pct: number | null }>();

    if (!invite) return { success: false, error: 'Invite token not found' };
    if (invite.status !== 'pending') return { success: false, error: 'Invite has already been redeemed' };
    if (invite.expires_at <= Date.now()) return { success: false, error: 'Invite token has expired' };

    const now = Date.now();
    const partnerId = `partner_${crypto.randomUUID().slice(0, 12)}`;
    const baseCode = input.fullName.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 12) || 'PARTNER';
    const partnerCode = `${baseCode}_${Math.floor(100 + Math.random() * 900)}`;

    const updateRes = await db
      .prepare(`UPDATE affiliate_invites SET status = 'accepted', accepted_at = ?1, accepted_partner_id = ?2, updated_at = ?1
                WHERE invite_token = ?3 AND status = 'pending' AND expires_at > ?1`)
      .bind(now, partnerId, input.token)
      .run();

    if ((updateRes.meta?.changes ?? 0) === 0) {
      return { success: false, error: 'Invite claimed by another request' };
    }

    const rate = invite.custom_commission_rate_pct ?? 20.0;
    await db
      .prepare(`INSERT OR REPLACE INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, custom_rate_override_pct,
        payout_rail, status, total_earnings_cents, pending_payout_cents, settled_payout_cents,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, 'VIP', ?4, ?4, ?5, 'active', 0, 0, 0, ?6, ?6)`)
      .bind(partnerId, `user_${crypto.randomUUID().slice(0, 8)}`, partnerCode, rate, input.preferredRail, now)
      .run();

    return { success: true, partnerId, partnerCode };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-partner] Failed to redeem invite', { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function fetchPartnerLedgerDataAction(
  partnerId?: string
): Promise<{ success: boolean; kpi?: PartnerLedgerKpiData; items?: CommissionLedgerItem[]; error?: string }> {
  try {
    const db = await getD1();
    if (!db) {
      return {
        success: true,
        kpi: buildDemoPartnerLedgerKpi(),
        items: [],
      };
    }

    const { kpi, items } = await queryPartnerLedgerFromD1(db, partnerId);
    return { success: true, kpi, items };
  } catch (err) {
    const error = toError(err);
    return { success: false, error: error.message };
  }
}
