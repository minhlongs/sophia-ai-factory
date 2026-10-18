/**
 * Email dispatcher for affiliate invitations.
 * Layer: forest/actions/affiliate
 * @module forest/actions/affiliate/invite-email-dispatcher
 */

import { sendSeedEmail } from '@/seed/email/email-sender';
import { buildAffiliateInvitationEmail } from '@/tree/email/templates/affiliate-invitation';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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
