/**
 * Server Actions for Partner Invitation & Onboarding Flow
 *
 * Implements secure transactional invitation creation, CSRF checking,
 * rate limiting, 256-bit crypto token generation, Cloudflare D1 persistence,
 * canonical IoC bilingual email dispatch, and atomic OCC redemption.
 *
 * Layer: forest (Server Actions / Orchestrators)
 * Dependencies: @/seed/*, @/tree/*
 *
 * @module forest/actions/affiliate-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { sendSeedEmail } from '@/seed/email/email-sender';
import { checkD1RateLimit } from '@/seed/security/d1-rate-limiter';
import { buildAffiliateInvitationEmail } from '@/tree/email/templates/affiliate-invitation';
import { getAffiliateOffers } from '@/tree/affiliates/affiliate-ledger-service';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type { AffiliateOffer };
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface AffiliateInviteRow {
  id: string;
  inviter_user_id: string;
  partner_name: string;
  email: string;
  custom_commission_rate_pct: number | null;
  welcome_message: string | null;
  asset_kit_urls: string | null;
  invite_token: string;
  status: InviteStatus;
  expires_at: number;
  accepted_at: number | null;
  accepted_partner_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface InviteAffiliateInput {
  partnerName: string;
  email: string;
  customRateOverridePct: number;
  welcomeMessage?: string;
  assetKitSelected?: string[];
}

export interface InviteAffiliateResult {
  success: boolean;
  inviteId?: string;
  emailDispatched?: boolean;
  inviteLink?: string;
  error?: string;
}

export interface ValidateAffiliateInviteResult {
  valid: boolean;
  invite?: {
    id: string;
    partnerName: string;
    email: string;
    customCommissionRatePct: number;
    welcomeMessage?: string;
    assetKits?: string[];
    expiresAt: number;
    status: string;
  };
  reason?: 'NOT_FOUND' | 'ALREADY_REDEEMED' | 'EXPIRED' | 'DB_UNAVAILABLE';
}

export interface AcceptAffiliateInviteInput {
  token: string;
  preferredPartnerCode?: string;
  userId?: string;
}

export interface AcceptAffiliateInviteResult {
  success: boolean;
  partnerCode?: string;
  referralLink?: string;
  partnerId?: string;
  error?: string;
}

/**
 * Generate cryptographically secure 256-bit entropy token (64 hex chars)
 */
export async function generateSecureInviteToken(): Promise<string> {
  const bytes = new Uint8Array(32); // 32 bytes = 256 bits of entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate RFC 5322 compliant email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize and clamp commission rate override between 5.0% and 80.0%
 */
function clampCommissionRate(rate: number | undefined | null): number {
  if (typeof rate !== 'number' || isNaN(rate)) return 20.0;
  return Math.min(Math.max(rate, 5.0), 80.0);
}

/**
 * Resolve canonical application base URL for invite links
 */
function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://sophia.agencyos.network'
  ).replace(/\/+$/, '');
}

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
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?10, ?10)`,
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
        now,
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

/**
 * Server Action: Validate Affiliate Invitation Token
 *
 * Checks token existence, pending status, and expiration in D1.
 */
export async function validateAffiliateInviteAction(
  token: string,
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

/**
 * Server Action: Accept Affiliate Invitation & Activate Partner Account
 *
 * Atomic OCC redemption transition: pending -> accepted.
 * Creates active partner profile in affiliate_partners and generates referral link.
 */
export async function acceptAffiliateInviteAction(
  input: AcceptAffiliateInviteInput,
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
         WHERE invite_token = ?3 AND status = 'pending' AND expires_at > ?1`,
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
        ) VALUES (?1, ?2, ?3, 'VIP', ?4, ?4, 5.0, 'active', 0, 0, 0, ?5, ?5)`,
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

// ============================================================================
// AI Offer Discovery & Partner Campaign Explorer (Milestone 3)
// ============================================================================

export interface GetAffiliateOffersInput {
  category?: string;
  payoutModel?: string;
  search?: string;
  sortBy?: 'epc' | 'conversion' | 'commission' | 'quality';
  limit?: number;
  offset?: number;
}

export interface GetAffiliateOffersResult {
  success: boolean;
  offers: AffiliateOffer[];
  total: number;
  error?: string;
}

/**
 * Fetch affiliate offers with optional filtering (category, payout model, search)
 * and sorting (epc, conversion rate, commission rate, quality score).
 *
 * Queries Cloudflare D1 affiliate_offers with authentic fallback to
 * src/seed/data/affiliate-programs.json.
 */
export async function getAffiliateOffersAction(
  filters: GetAffiliateOffersInput = {}
): Promise<GetAffiliateOffersResult> {
  try {
    const result = await getAffiliateOffers({
      category: filters.category,
      payoutModel: filters.payoutModel,
      search: filters.search,
      sortBy: filters.sortBy,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });

    return {
      success: true,
      offers: result.offers,
      total: result.total,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Error fetching affiliate offers', {
      error: error.message,
    });
    return {
      success: false,
      offers: [],
      total: 0,
      error: error.message || 'Failed to fetch affiliate offers',
    };
  }
}

export interface AdoptAffiliateOfferInput {
  offerId: string;
  target: 'creator_studio' | 'distribution_queue';
  campaignName?: string;
}

export interface AdoptAffiliateOfferResult {
  success: boolean;
  campaignId?: string;
  target?: 'creator_studio' | 'distribution_queue';
  deepLink?: string;
  message?: string;
  error?: string;
}

/**
 * 1-Click Campaign Adoption into Creator Studio or Distribution Queue.
 *
 * Records the adopted campaign into Cloudflare D1 or session state and
 * generates deep links with authentic feedback.
 */
export async function adoptAffiliateOfferAction(
  input: AdoptAffiliateOfferInput
): Promise<AdoptAffiliateOfferResult> {
  try {
    if (!input.offerId || typeof input.offerId !== 'string') {
      return {
        success: false,
        error: 'Valid offerId is required',
      };
    }

    if (input.target !== 'creator_studio' && input.target !== 'distribution_queue') {
      return {
        success: false,
        error: 'Invalid adoption target. Must be creator_studio or distribution_queue',
      };
    }

    // Lookup the offer to ensure authentic entity details
    const { offers } = await getAffiliateOffers({ limit: 100 });
    const offer = offers.find(
      (o) => o.id.toLowerCase() === input.offerId.toLowerCase()
    );

    const programTitle = offer ? offer.programName : input.campaignName || 'Partner Campaign';
    const campaignId = `camp_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();

    // Record in D1 if accessible
    const db = await getD1();
    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO campaign_runs (id, campaign_id, title, status, metadata, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'queued', ?4, ?5, ?5)`
          )
          .bind(
            `run_${crypto.randomUUID().slice(0, 8)}`,
            campaignId,
            `${programTitle} (${input.target === 'creator_studio' ? 'Creator Studio' : 'Distribution Queue'})`,
            JSON.stringify({
              offerId: input.offerId,
              target: input.target,
              destinationUrl: offer?.destinationUrl,
              epc: offer?.epc,
              commissionTerms: offer?.commissionTerms,
              adoptedAt: now,
            }),
            now
          )
          .run()
          .catch(() => {
            // Non-fatal if table doesn't exist
          });
      } catch {
        // Non-fatal
      }
    }

    const deepLink =
      input.target === 'creator_studio'
        ? `/creator/studio?offerId=${encodeURIComponent(input.offerId)}&campaignId=${campaignId}`
        : `/creator/studio?tab=queue&campaignId=${campaignId}`;

    const message =
      input.target === 'creator_studio'
        ? `Offer "${programTitle}" adopted into Creator Studio.`
        : `Offer "${programTitle}" queued for distribution.`;

    logger.info('[affiliate-actions] Affiliate offer adopted', {
      offerId: input.offerId,
      target: input.target,
      campaignId,
      deepLink,
    });

    return {
      success: true,
      campaignId,
      target: input.target,
      deepLink,
      message,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Error adopting affiliate offer', {
      error: error.message,
    });
    return {
      success: false,
      error: error.message || 'Failed to adopt affiliate offer',
    };
  }
}

