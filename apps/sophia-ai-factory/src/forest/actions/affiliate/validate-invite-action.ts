/**
 * Affiliate Actions Submodule: Validate Invite Action.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/validate-invite-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  AffiliateInviteRow,
  ValidateAffiliateInviteResult,
} from './types';

/**
 * Server Action: Validate Affiliate Invitation Token
 *
 * Checks token existence, pending status, and expiration in D1.
 */
export async function validateAffiliateInviteAction(
  token: string
): Promise<ValidateAffiliateInviteResult> {
  try {
    const cleanToken = token?.trim();
    if (!cleanToken) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const db = await getD1();
    if (!db) {
      return { valid: false, reason: 'DB_UNAVAILABLE' };
    }

    const row = await db
      .prepare('SELECT * FROM affiliate_invites WHERE invite_token = ?1 LIMIT 1')
      .bind(cleanToken)
      .first<AffiliateInviteRow>();

    if (!row) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (row.status !== 'pending') {
      return { valid: false, reason: 'ALREADY_REDEEMED' };
    }

    if (row.expires_at <= Date.now()) {
      return { valid: false, reason: 'EXPIRED' };
    }

    let parsedAssetKits: string[] = [];
    if (row.asset_kit_urls) {
      try {
        parsedAssetKits = JSON.parse(row.asset_kit_urls) as string[];
      } catch {
        parsedAssetKits = [];
      }
    }

    return {
      valid: true,
      invite: {
        id: row.id,
        partnerName: row.partner_name,
        email: row.email,
        customCommissionRatePct: row.custom_commission_rate_pct ?? 20.0,
        welcomeMessage: row.welcome_message || undefined,
        assetKits: parsedAssetKits,
        expiresAt: row.expires_at,
        status: row.status,
      },
    };
  } catch (err) {
    logger.error('[affiliate-actions] Error validating invite token', {
      error: toError(err).message,
    });
    return { valid: false, reason: 'NOT_FOUND' };
  }
}
