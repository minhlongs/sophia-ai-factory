/**
 * Affiliate Actions Submodule: Accept Invite Action.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/accept-invite-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  AcceptAffiliateInviteInput,
  AcceptAffiliateInviteResult,
  AffiliateInviteRow,
} from './types';
import { getAppBaseUrl } from './utils';

/**
 * Server Action: Accept Affiliate Invitation & Activate Partner Account
 *
 * Atomic OCC redemption transition: pending -> accepted.
 * Creates active partner profile in affiliate_partners and generates referral link.
 */
export async function acceptAffiliateInviteAction(
  input: AcceptAffiliateInviteInput
): Promise<AcceptAffiliateInviteResult> {
  try {
    const cleanToken = input.token?.trim();
    if (!cleanToken) {
      return { success: false, error: 'Token is required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding unavailable' };
    }

    // 1. Fetch current invite record
    const invite = await db
      .prepare('SELECT * FROM affiliate_invites WHERE invite_token = ?1 LIMIT 1')
      .bind(cleanToken)
      .first<AffiliateInviteRow>();

    if (!invite) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invite.status !== 'pending') {
      return { success: false, error: 'Invitation has already been redeemed' };
    }

    const now = Date.now();
    if (invite.expires_at <= now) {
      return { success: false, error: 'Invitation link has expired' };
    }

    // 2. Generate partner ID & sanitized unique partner code
    const partnerId = `partner_${crypto.randomUUID().slice(0, 12)}`;
    let baseCode = (input.preferredPartnerCode || invite.partner_name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 16);

    if (!baseCode || baseCode.length < 3) {
      baseCode = 'PARTNER';
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const partnerCode = `${baseCode}_${randomSuffix}`;

    // 3. Atomic OCC Update to claim invite (prevents race condition / double-claiming)
    const updateResult = await db
      .prepare(
        `UPDATE affiliate_invites
         SET status = 'accepted', accepted_at = ?1, accepted_partner_id = ?2, updated_at = ?1
         WHERE invite_token = ?3 AND status = 'pending' AND expires_at > ?1`
      )
      .bind(now, partnerId, cleanToken)
      .run();

    const changes = updateResult.meta?.changes ?? 0;
    if (changes === 0) {
      return {
        success: false,
        error: 'Invitation was already claimed or expired during processing',
      };
    }

    // 4. Create active affiliate partner in affiliate_partners
    const customRate = invite.custom_commission_rate_pct ?? 20.0;
    const partnerUserId = input.userId || `user_${crypto.randomUUID().slice(0, 8)}`;

    await db
      .prepare(
        `INSERT OR REPLACE INTO affiliate_partners (
          id, user_id, partner_code, tier, commission_rate_pct, custom_rate_override_pct,
          tier2_rate_pct, status, total_earnings_cents, pending_payout_cents, settled_payout_cents,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, 'VIP', ?4, ?4, 5.0, 'active', 0, 0, 0, ?5, ?5)`
      )
      .bind(partnerId, partnerUserId, partnerCode, customRate, now)
      .run();

    const baseUrl = getAppBaseUrl();
    const referralLink = `${baseUrl}/r/${partnerCode}`;

    logger.info('[affiliate-actions] Affiliate invite successfully redeemed', {
      inviteId: invite.id,
      partnerId,
      partnerCode,
    });

    return {
      success: true,
      partnerId,
      partnerCode,
      referralLink,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Error redeeming affiliate invite', {
      error: error.message,
    });
    return {
      success: false,
      error: error.message || 'Failed to accept invitation. Please try again.',
    };
  }
}
