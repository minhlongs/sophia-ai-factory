/**
 * Affiliate Actions Submodule: Invite Action.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/invite-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkD1RateLimit } from '@/seed/security/d1-rate-limiter';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { InviteAffiliateInput, InviteAffiliateResult } from './types';
import { generateSecureInviteToken, getAppBaseUrl } from './utils';
import {
  dispatchAffiliateInviteEmail,
  insertAffiliateInviteRow,
  validateInviteAffiliateInput,
} from './invite-action-helpers';

/**
 * Server Action: Invite Affiliate Partner
 *
 * Validates inputs, checks rate limits, creates atomic invite record in D1,
 * and dispatches bilingual invitation email via registered IoC email sender.
 */
export async function inviteAffiliateAction(
  input: InviteAffiliateInput,
): Promise<InviteAffiliateResult> {
  try {
    // 1. Input Sanitization & Validation
    const validated = validateInviteAffiliateInput(input);
    if (!validated.ok) {
      return {
        success: false,
        error: validated.error,
      };
    }
    const { partnerName, email, customRate, welcomeMessage, assetKits } = validated.data;

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
    await insertAffiliateInviteRow(db, {
      inviteId,
      inviterId,
      partnerName,
      email,
      customRate,
      welcomeMessage,
      assetKitsJson,
      token,
      expiresAt,
      now,
    });

    // 6-7. Generate Join URL & Dispatch Transactional Email via canonical IoC
    const baseUrl = getAppBaseUrl();
    const joinUrl = `${baseUrl}/affiliate/join?token=${token}`;

    const emailDispatched = await dispatchAffiliateInviteEmail({
      email,
      partnerName,
      customRate,
      joinUrl,
      welcomeMessage,
      assetKits,
      expiresInDays,
    });

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
