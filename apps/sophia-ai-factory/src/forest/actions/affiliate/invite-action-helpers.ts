/**
 * Affiliate Invite Action Internal Helpers — validation and D1 persistence.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/invite-action-helpers
 */

import type { InviteAffiliateInput } from './types';
import { clampCommissionRate, isValidEmail } from './utils';

export { dispatchAffiliateInviteEmail } from './invite-email-dispatcher';

export interface ValidatedInvitePayload {
  partnerName: string;
  email: string;
  customRate: number;
  welcomeMessage: string | undefined;
  assetKits: string[];
}

export function validateInviteAffiliateInput(
  input: InviteAffiliateInput,
): { ok: true; data: ValidatedInvitePayload } | { ok: false; error: string } {
  const partnerName = input.partnerName?.trim();
  if (!partnerName || partnerName.length < 2) {
    return { ok: false, error: 'Partner name is required (min 2 characters)' };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'Please enter a valid email address' };
  }

  return {
    ok: true,
    data: {
      partnerName,
      email,
      customRate: clampCommissionRate(input.customRateOverridePct),
      welcomeMessage: input.welcomeMessage?.trim(),
      assetKits: Array.isArray(input.assetKitSelected) ? input.assetKitSelected : [],
    },
  };
}

export async function insertAffiliateInviteRow(
  db: D1Database,
  params: {
    inviteId: string;
    inviterId: string;
    partnerName: string;
    email: string;
    customRate: number;
    welcomeMessage: string | undefined;
    assetKitsJson: string;
    token: string;
    expiresAt: number;
    now: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO affiliate_invites (
        id, inviter_user_id, partner_name, email, custom_commission_rate_pct,
        welcome_message, asset_kit_urls, invite_token, status, expires_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?10, ?10)`,
    )
    .bind(
      params.inviteId,
      params.inviterId,
      params.partnerName,
      params.email,
      params.customRate,
      params.welcomeMessage || null,
      params.assetKitsJson,
      params.token,
      params.expiresAt,
      params.now,
    )
    .run();
}
