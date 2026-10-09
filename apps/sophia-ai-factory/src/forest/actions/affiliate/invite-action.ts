/**
 * Affiliate Actions Submodule: Invite Action.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/invite-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { sendSeedEmail } from '@/seed/email/email-sender';
import { checkD1RateLimit } from '@/seed/security/d1-rate-limiter';
import { buildAffiliateInvitationEmail } from '@/tree/email/templates/affiliate-invitation';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { InviteAffiliateInput, InviteAffiliateResult } from './types';
import {
  clampCommissionRate,
  generateSecureInviteToken,
  getAppBaseUrl,
  isValidEmail,
} from './utils';

/**
 * Server Action: Invite Affiliate Partner
 *
 * Validates inputs, checks rate limits, creates atomic invite record in D1,
 * and dispatches bilingual invitation email via registered IoC email sender.
 */
export async function inviteAffiliateAction(
  input: InviteAffiliateInput
): Promise<InviteAffiliateResult> {
  try {
    // 1. Input Sanitization & Validation
    const partnerName = input.partnerName?.trim();
    if (!partnerName || partnerName.length < 2) {
      return {
        success: false,
        error: 'Partner name is required (min 2 characters)',
      };
    }

    const email = input.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return {
        success: false,
        error: 'Please enter a valid email address',
      };
    }

    const customRate = clampCommissionRate(input.customRateOverridePct);
    const welcomeMessage = input.welcomeMessage?.trim();
    const assetKits = Array.isArray(input.assetKitSelected) ? input.assetKitSelected : [];

    // 2. Authentication & Rate Limiting
    const user = await getCurrentUser().catch(() => null);
    const inviterId = user?.id || 'system_admin';

    const rateLimit = await checkD1RateLimit(inviterId, {
      maxRequests: 20,
      windowSeconds: 60,
    }).catch(() => ({ allowed: true }));

    if (!rateLimit.allowed) {
      logger.warn('[affiliate-actions] Invite rate limit exceeded', { inviterId });
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait a moment before sending more invitations.',
      };
    }

    // 3. Database connection
    const db = await getD1();
    if (!db) {
      logger.error('[affiliate-actions] D1 database unavailable for affiliate invite');
      return {
        success: false,
        error: 'Database connection currently unavailable. Please try again later.',
      };
    }

    // 4. Token Generation & Expiration (14 days)
    const token = await generateSecureInviteToken();
    const inviteId = `aff_inv_${crypto.randomUUID()}`;
    const now = Date.now();
    const expiresInDays = 14;
    const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;
    const assetKitsJson = JSON.stringify(assetKits);

    // 5. Atomic Insertion into D1 affiliate_invites
    await db
      .prepare(
        `INSERT INTO affiliate_invites (
          id, inviter_user_id, partner_name, email, custom_commission_rate_pct,
          welcome_message, asset_kit_urls, invite_token, status, expires_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?10, ?10)`
      )
      .bind(
        inviteId,
        inviterId,
        partnerName,
        email,
        customRate,
        welcomeMessage || null,
        assetKitsJson,
        token,
        expiresAt,
        now
      )
      .run();

    // 6. Generate Join URL & Render Bilingual Email Template
    const baseUrl = getAppBaseUrl();
    const joinUrl = `${baseUrl}/affiliate/join?token=${token}`;

    const { html, subject } = buildAffiliateInvitationEmail({
      partnerName,
      customCommissionRatePct: customRate,
      joinUrl,
      welcomeMessage: welcomeMessage || undefined,
      assetKits,
      expiresInDays,
    });

    // 7. Dispatch Transactional Email via canonical IoC
    let emailDispatched = false;
    try {
      const emailResult = await sendSeedEmail({
        to: email,
        subject,
        html,
      });
      emailDispatched = emailResult.success;
      if (!emailResult.success) {
        logger.warn('[affiliate-actions] Email dispatch warning', {
          email,
          error: emailResult.error,
        });
      }
    } catch (emailErr) {
      logger.warn('[affiliate-actions] Failed to dispatch invitation email', {
        email,
        error: toError(emailErr).message,
      });
    }

    logger.info('[affiliate-actions] Affiliate invitation created successfully', {
      inviteId,
      email,
      inviterId,
      customRate,
      emailDispatched,
    });

    return {
      success: true,
      inviteId,
      emailDispatched,
      inviteLink: joinUrl,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Failed to create affiliate invite', {
      error: error.message,
    });
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while creating invitation.',
    };
  }
}
