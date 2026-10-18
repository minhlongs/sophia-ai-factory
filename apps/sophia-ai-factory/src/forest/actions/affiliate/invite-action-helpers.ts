/**
 * Affiliate Invite Action Internal Helpers — validation, D1 persistence, email dispatch.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/invite-action-helpers
 */

import { sendSeedEmail } from '@/seed/email/email-sender';
import { buildAffiliateInvitationEmail } from '@/tree/email/templates/affiliate-invitation';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { InviteAffiliateInput } from './types';
import { clampCommissionRate, isValidEmail } from './utils';

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
    return {
      ok: false,
      error: 'Partner name is required (min 2 characters)',
    };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return {
      ok: false,
      error: 'Please enter a valid email address',
    };
  }

  const customRate = clampCommissionRate(input.customRateOverridePct);
  const welcomeMessage = input.welcomeMessage?.trim();
  const assetKits = Array.isArray(input.assetKitSelected) ? input.assetKitSelected : [];

  return {
    ok: true,
    data: {
      partnerName,
      email,
      customRate,
      welcomeMessage,
      assetKits,
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

export async function dispatchAffiliateInviteEmail(params: {
  email: string;
  partnerName: string;
  customRate: number;
  joinUrl: string;
  welcomeMessage: string | undefined;
  assetKits: string[];
  expiresInDays: number;
}): Promise<boolean> {
  const { html, subject } = buildAffiliateInvitationEmail({
    partnerName: params.partnerName,
    customCommissionRatePct: params.customRate,
    joinUrl: params.joinUrl,
    welcomeMessage: params.welcomeMessage || undefined,
    assetKits: params.assetKits,
    expiresInDays: params.expiresInDays,
  });

  try {
    const emailResult = await sendSeedEmail({
      to: params.email,
      subject,
      html,
    });
    if (!emailResult.success) {
      logger.warn('[affiliate-actions] Email dispatch warning', {
        email: params.email,
        error: emailResult.error,
      });
    }
    return emailResult.success;
  } catch (emailErr) {
    logger.warn('[affiliate-actions] Failed to dispatch invitation email', {
      email: params.email,
      error: toError(emailErr).message,
    });
    return false;
  }
}
