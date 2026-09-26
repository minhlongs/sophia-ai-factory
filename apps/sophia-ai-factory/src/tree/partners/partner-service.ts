/**
 * Autonomous Multi-Tier Partner Commission Ledger & White-Label Agency Service
 *
 * Layer: tree (domain business logic, math models & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Guarantees:
 * 1. Zero Penny Leakage: Pure integer cent math with Math.floor((mrrCents * rate) / 100).
 * 2. Strict Anti-Self-Referral: Partners cannot earn commissions on their own orders.
 * 3. 90-Day Attribution Window: Attribution window checks prevent expired commission claims.
 * 4. Automatic Tier Escalation: Dynamically upgrades SILVER (20%) -> GOLD (28%) -> PLATINUM (35%).
 * 5. White-Label Isolation: Enforces tier permission before domain/branding provisioning.
 *
 * @module tree/partners/partner-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  PARTNER_TIERS,
  ATTRIBUTION_WINDOW_MS,
  MIN_PAYOUT_THRESHOLD_CENTS,
  type PartnerTier,
  type PartnerType,
  type PartnerProfile,
  type PartnerCommission,
  type PartnerWhitelabelConfig,
  type WhitelabelCssTheme,
  type RegisterPartnerInput,
  type AccrueCommissionInput,
  type CommissionResult,
  type EvaluateTierResult,
  type WhitelabelConfigInput,
  type PayoutRequestInput,
  type PayoutRequestResult,
  type PartnerDashboardData,
} from '@/tree/partners/types';

/**
 * Pure integer cent commission calculation.
 * Ensures zero penny leakage with mathematical floor.
 *
 * Invariant: commissionCents is always non-negative integer <= mrrCents.
 */
export function calculateCommissionCents(mrrCents: number, commissionRatePct: number): number {
  if (mrrCents <= 0 || commissionRatePct <= 0) {
    return 0;
  }
  return Math.floor((mrrCents * commissionRatePct) / 100);
}

/**
 * Evaluates Partner Tier qualifications based on active customers and MRR.
 * - PLATINUM (35%): >= 30 customers OR >= $20,000 (2,000,000 cents) MRR
 * - GOLD (28%): >= 10 customers OR >= $5,000 (500,000 cents) MRR
 * - SILVER (20%): Baseline
 */
export function determinePartnerTier(
  referredCustomers: number,
  referredMrrCents: number,
): { tier: PartnerTier; commissionRatePct: number; whitelabelEnabled: boolean } {
  if (referredCustomers >= 30 || referredMrrCents >= 2_000_000) {
    return {
      tier: 'PLATINUM',
      commissionRatePct: PARTNER_TIERS.PLATINUM.ratePct,
      whitelabelEnabled: true,
    };
  }

  if (referredCustomers >= 10 || referredMrrCents >= 500_000) {
    return {
      tier: 'GOLD',
      commissionRatePct: PARTNER_TIERS.GOLD.ratePct,
      whitelabelEnabled: false,
    };
  }

  return {
    tier: 'SILVER',
    commissionRatePct: PARTNER_TIERS.SILVER.ratePct,
    whitelabelEnabled: false,
  };
}

/**
 * Calculates progress towards next tier for partner gamification.
 */
export function calculateNextTierProgress(
  currentTier: PartnerTier,
  customers: number,
  mrrCents: number,
): {
  targetTier: PartnerTier | null;
  customersRemaining: number;
  mrrRemainingCents: number;
  progressPct: number;
} {
  if (currentTier === 'PLATINUM') {
    return {
      targetTier: null,
      customersRemaining: 0,
      mrrRemainingCents: 0,
      progressPct: 100,
    };
  }

  const target = currentTier === 'SILVER' ? PARTNER_TIERS.GOLD : PARTNER_TIERS.PLATINUM;
  const customersRemaining = Math.max(0, target.minCustomers - customers);
  const mrrRemainingCents = Math.max(0, target.minMrrCents - mrrCents);

  const customerPct = target.minCustomers > 0 ? (customers / target.minCustomers) * 100 : 0;
  const mrrPct = target.minMrrCents > 0 ? (mrrCents / target.minMrrCents) * 100 : 0;
  const progressPct = Math.min(100, Math.max(0, Math.floor(Math.max(customerPct, mrrPct))));

  return {
    targetTier: target.tier,
    customersRemaining,
    mrrRemainingCents,
    progressPct,
  };
}

/**
 * Checks if a conversion occurs within the 90-day referral attribution window.
 */
export function isWithinAttributionWindow(
  attributedAtMs: number,
  eventTimeMs = Date.now(),
  windowMs = ATTRIBUTION_WINDOW_MS,
): boolean {
  if (eventTimeMs < attributedAtMs) {
    return false;
  }
  return eventTimeMs - attributedAtMs <= windowMs;
}

/**
 * Generates a clean URL-friendly referral code for a partner.
 */
export function generateReferralCode(partnerName: string): string {
  const firstWord = partnerName.trim().split(/\s+/)[0] || 'PARTNER';
  const cleanPrefix = firstWord
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'PARTNER';
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${cleanPrefix}-${randomSuffix}`;
}

/**
 * Generates a DNS TXT record verification token for white-label custom domain.
 */
export function generateDnsTxtVerificationToken(partnerId: string, customDomain: string): string {
  const cleanDomain = customDomain.toLowerCase().trim();
  const tokenPayload = `${partnerId}:${cleanDomain}`;
  let hash = 0;
  for (let i = 0; i < tokenPayload.length; i++) {
    hash = (hash << 5) - hash + tokenPayload.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `sophia-verify=${hex}${nonce}`;
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates a hex color string (#RRGGBB). If invalid, returns the fallback color.
 */
export function validateHexColor(color: string | null | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

/**
 * Sanitizes a URL for safe embedding inside CSS url("...").
 * Prevents CSS injection, url() breakouts, quotes, parens, and javascript: protocols.
 */
export function sanitizeUrlForCss(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  const trimmed = rawUrl.trim();
  // Reject any string containing quotes, parentheses, backslashes, angle brackets, semicolons, or control whitespace
  if (/["'()\\<>;\s\r\n]/.test(trimmed)) {
    return '';
  }
  // Reject javascript:, vbscript:, data: URIs
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return '';
  }
  // Must start with https://, http://, or /
  if (!/^(https?:\/\/|\/)[^"'()\\<>;\s]+$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Resolves CSS theme custom properties from white-label config.
 * Sanitizes logo/favicon URLs and validates hex color codes to prevent CSS injection.
 */
export function resolveWhitelabelTheme(
  config: Partial<PartnerWhitelabelConfig> | null,
): WhitelabelCssTheme {
  const primary = validateHexColor(config?.primary_color, '#06b6d4');
  const accent = validateHexColor(config?.accent_color, '#3b82f6');
  const logoUrl = sanitizeUrlForCss(config?.logo_url);
  const faviconUrl = sanitizeUrlForCss(config?.favicon_url);
  const brandName = config?.brand_name?.trim() || 'Sophia AI Factory';
  const supportUrl = sanitizeUrlForCss(config?.support_url);

  return {
    brandPrimary: primary,
    brandAccent: accent,
    brandLogoUrl: logoUrl,
    brandFaviconUrl: faviconUrl,
    brandAgencyName: brandName,
    brandSupportUrl: supportUrl,
    customCssProperties: {
      '--brand-primary': primary,
      '--brand-accent': accent,
      '--brand-logo-url': logoUrl ? `url("${logoUrl}")` : 'none',
      '--brand-favicon-url': faviconUrl,
      '--brand-agency-name': brandName,
      '--brand-support-url': supportUrl,
    },
  };
}

/**
 * Register a new partner profile in D1.
 */
export async function registerPartner(
  db: D1Database,
  input: RegisterPartnerInput,
  nowMs = Date.now(),
): Promise<PartnerProfile> {
  const existing = await getPartnerByUserId(db, input.userId);
  if (existing) {
    return existing;
  }

  const id = `ptn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const partnerType: PartnerType = input.partnerType || 'agency';
  const referralCode = input.referralCode?.trim().toUpperCase() || generateReferralCode(input.partnerName);
  const payoutRail = input.payoutRail || 'USDT';
  const payoutDestination = input.payoutDestinationJson || '{}';

  await db
    .prepare(
      `INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier, commission_rate_pct,
        referral_code, custom_domain, whitelabel_enabled, total_referred_customers,
        total_mrr_cents, total_earnings_cents, pending_payout_cents, payout_rail,
        payout_destination_json, status, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'SILVER', 20.0, ?6, NULL, 0, 0, 0, 0, 0, ?7, ?8, 'active', ?9, ?9)`
    )
    .bind(
      id,
      input.userId,
      input.tenantId,
      input.partnerName.trim(),
      partnerType,
      referralCode,
      payoutRail,
      payoutDestination,
      nowMs,
    )
    .run();

  const created = await getPartnerById(db, id);
  if (!created) {
    throw new Error('Failed to retrieve newly registered partner profile');
  }
  return created;
}

/**
 * Fetch partner profile by user ID.
 */
export async function getPartnerByUserId(
  db: D1Database,
  userId: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE user_id = ?1 LIMIT 1')
    .bind(userId)
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Fetch partner profile by partner ID.
 */
export async function getPartnerById(
  db: D1Database,
  partnerId: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE id = ?1 LIMIT 1')
    .bind(partnerId)
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Fetch partner profile by referral code.
 */
export async function getPartnerByReferralCode(
  db: D1Database,
  referralCode: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE referral_code = ?1 LIMIT 1')
    .bind(referralCode.trim().toUpperCase())
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Evaluates and executes partner tier promotion if thresholds are reached.
 */
export async function evaluatePartnerTierPromotion(
  db: D1Database,
  partnerId: string,
  nowMs = Date.now(),
): Promise<EvaluateTierResult> {
  const partner = await getPartnerById(db, partnerId);
  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const evaluation = determinePartnerTier(
    partner.total_referred_customers,
    partner.total_mrr_cents,
  );

  const tierRank: Record<PartnerTier, number> = { SILVER: 1, GOLD: 2, PLATINUM: 3 };
  const promoted = tierRank[evaluation.tier] > tierRank[partner.tier];

  if (promoted || evaluation.tier !== partner.tier) {
    await db
      .prepare(
        `UPDATE partner_profiles
         SET tier = ?1,
             commission_rate_pct = ?2,
             whitelabel_enabled = ?3,
             updated_at = ?4
         WHERE id = ?5`
      )
      .bind(
        evaluation.tier,
        evaluation.commissionRatePct,
        evaluation.whitelabelEnabled ? 1 : partner.whitelabel_enabled,
        nowMs,
        partnerId,
      )
      .run();
  }

  return {
    partnerId,
    currentTier: partner.tier,
    newTier: evaluation.tier,
    promoted,
    commissionRatePct: evaluation.commissionRatePct,
    whitelabelEnabled: evaluation.whitelabelEnabled,
  };
}

/**
 * Accrues a partner commission for an order payment.
 *
 * Rules:
 * 1. Anti-self-referral: Rejects with 'SELF_REFERRAL_PROHIBITED' if partner.user_id === referredUserId.
 * 2. Attribution window: Rejects with 'ATTRIBUTION_WINDOW_EXPIRED' if referral was > 90 days ago.
 * 3. Idempotency: Returns existing record if (partner_id, order_id) already processed.
 * 4. Zero penny leakage: integer cent calculation.
 * 5. Automatic promotion: Evaluates tier upgrade on customer/MRR increase.
 */
export async function accruePartnerCommission(
  db: D1Database,
  input: AccrueCommissionInput,
  nowMs = Date.now(),
): Promise<CommissionResult> {
  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: 0,
      tierAtTime: 'SILVER',
      error: `Partner profile ${input.partnerId} does not exist`,
    };
  }

  // 1. Anti-Self-Referral Check (User-level)
  if (partner.user_id === input.referredUserId) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'SELF_REFERRAL_PROHIBITED: Referrer cannot be the same user as the customer',
    };
  }

  // 2. Anti-Self-Referral Collusion Check (Tenant-level)
  if (Boolean(input.referredTenantId) && partner.tenant_id === input.referredTenantId) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'SELF_TENANT_REFERRAL_PROHIBITED: Referrer cannot earn commissions on orders from their own tenant organization',
    };
  }

  // 2. 90-Day Referral Window Attribution Check
  if (input.referredAtMs !== undefined && !isWithinAttributionWindow(input.referredAtMs, nowMs)) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'ATTRIBUTION_WINDOW_EXPIRED: Referral occurred outside the 90-day attribution window',
    };
  }

  // 3. Idempotency Check on (partner_id, order_id)
  const existing = await db
    .prepare('SELECT * FROM partner_commissions WHERE partner_id = ?1 AND order_id = ?2 LIMIT 1')
    .bind(input.partnerId, input.orderId)
    .first<PartnerCommission>();

  if (existing) {
    return {
      success: true,
      commissionId: existing.id,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: existing.commission_cents,
      commissionRatePct: existing.commission_rate_pct,
      tierAtTime: existing.tier_at_time,
      duplicate: true,
    };
  }

  // 4. Calculate Commission Amount with integer floor
  const commissionCents = calculateCommissionCents(input.mrrCents, partner.commission_rate_pct);
  const commissionId = `com_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // 5. Insert Commission Entry
  await db
    .prepare(
      `INSERT INTO partner_commissions (
        id, partner_id, referred_user_id, referred_tenant_id, order_id, mrr_cents,
        commission_rate_pct, commission_cents, tier_at_time, status, payout_batch_id,
        period_start, period_end, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', NULL, ?10, ?11, ?12)`
    )
    .bind(
      commissionId,
      input.partnerId,
      input.referredUserId,
      input.referredTenantId,
      input.orderId,
      input.mrrCents,
      partner.commission_rate_pct,
      commissionCents,
      partner.tier,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      nowMs,
    )
    .run();

  // 6. Update Partner Profile Totals
  const addedCustomer = input.isNewCustomer ? 1 : 0;
  await db
    .prepare(
      `UPDATE partner_profiles
       SET total_referred_customers = total_referred_customers + ?1,
           total_mrr_cents = total_mrr_cents + ?2,
           total_earnings_cents = total_earnings_cents + ?3,
           pending_payout_cents = pending_payout_cents + ?3,
           updated_at = ?4
       WHERE id = ?5`
    )
    .bind(
      addedCustomer,
      input.mrrCents,
      commissionCents,
      nowMs,
      input.partnerId,
    )
    .run();

  // 7. Evaluate Tier Promotion after update
  const promo = await evaluatePartnerTierPromotion(db, input.partnerId, nowMs);

  return {
    success: true,
    commissionId,
    partnerId: input.partnerId,
    orderId: input.orderId,
    commissionCents,
    commissionRatePct: partner.commission_rate_pct,
    tierAtTime: partner.tier,
    tierPromoted: promo.promoted,
    newTier: promo.newTier,
  };
}

/**
 * Configure or update white-label branding assets.
 * Requires partner to have whitelabel_enabled = 1 (PLATINUM tier).
 */
export async function upsertWhitelabelConfig(
  db: D1Database,
  input: WhitelabelConfigInput,
  nowMs = Date.now(),
): Promise<PartnerWhitelabelConfig> {
  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    throw new Error(`Partner not found: ${input.partnerId}`);
  }

  if (partner.whitelabel_enabled !== 1 && partner.tier !== 'PLATINUM') {
    throw new Error(
      'WHITELABEL_NOT_PERMITTED: White-label customization is exclusive to PLATINUM tier partners (30+ customers or $20k+ MRR)',
    );
  }

  const cleanDomain = input.customDomain?.trim().toLowerCase() || null;
  const verificationToken = cleanDomain
    ? generateDnsTxtVerificationToken(input.partnerId, cleanDomain)
    : null;

  const existingConfig = await getWhitelabelConfigByPartnerId(db, input.partnerId);

  if (existingConfig) {
    const isNewDomain = cleanDomain && cleanDomain !== existingConfig.custom_domain;
    const isSslActive = isNewDomain ? 0 : existingConfig.is_ssl_active;
    const dnsVerifiedAt = isNewDomain ? null : existingConfig.dns_verified_at;
    const token = isNewDomain ? verificationToken : existingConfig.dns_txt_verification_token;

    await db
      .prepare(
        `UPDATE partner_whitelabel_configs
         SET brand_name = ?1,
             logo_url = ?2,
             favicon_url = ?3,
             primary_color = ?4,
             accent_color = ?5,
             custom_domain = ?6,
             custom_email_sender = ?7,
             support_url = ?8,
             footer_html = ?9,
             is_ssl_active = ?10,
             dns_txt_verification_token = ?11,
             dns_verified_at = ?12,
             updated_at = ?13
         WHERE id = ?14`
      )
      .bind(
        input.brandName.trim(),
        input.logoUrl ?? null,
        input.faviconUrl ?? null,
        input.primaryColor || '#06b6d4',
        input.accentColor || '#3b82f6',
        cleanDomain,
        input.customEmailSender ?? null,
        input.supportUrl ?? null,
        input.footerHtml ?? null,
        isSslActive,
        token,
        dnsVerifiedAt,
        nowMs,
        existingConfig.id,
      )
      .run();

    if (cleanDomain) {
      await db
        .prepare('UPDATE partner_profiles SET custom_domain = ?1, updated_at = ?2 WHERE id = ?3')
        .bind(cleanDomain, nowMs, input.partnerId)
        .run();
    }

    const updated = await getWhitelabelConfigByPartnerId(db, input.partnerId);
    if (!updated) throw new Error('Failed to retrieve updated white-label config');
    return updated;
  }

  const id = `wlc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await db
    .prepare(
      `INSERT INTO partner_whitelabel_configs (
        id, partner_id, brand_name, logo_url, favicon_url, primary_color, accent_color,
        custom_domain, custom_email_sender, support_url, footer_html, is_ssl_active,
        dns_txt_verification_token, dns_verified_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, NULL, ?13, ?13)`
    )
    .bind(
      id,
      input.partnerId,
      input.brandName.trim(),
      input.logoUrl ?? null,
      input.faviconUrl ?? null,
      input.primaryColor || '#06b6d4',
      input.accentColor || '#3b82f6',
      cleanDomain,
      input.customEmailSender ?? null,
      input.supportUrl ?? null,
      input.footerHtml ?? null,
      verificationToken,
      nowMs,
    )
    .run();

  if (cleanDomain) {
    await db
      .prepare('UPDATE partner_profiles SET custom_domain = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(cleanDomain, nowMs, input.partnerId)
      .run();
  }

  const created = await getWhitelabelConfigByPartnerId(db, input.partnerId);
  if (!created) throw new Error('Failed to retrieve newly created white-label config');
  return created;
}

/**
 * Fetch white-label config by partner ID.
 */
export async function getWhitelabelConfigByPartnerId(
  db: D1Database,
  partnerId: string,
): Promise<PartnerWhitelabelConfig | null> {
  const row = await db
    .prepare('SELECT * FROM partner_whitelabel_configs WHERE partner_id = ?1 LIMIT 1')
    .bind(partnerId)
    .first<PartnerWhitelabelConfig>();
  return row ?? null;
}

/**
 * Queries DNS TXT records for a given domain using standard DNS-over-HTTPS (DoH).
 * Compatible with Cloudflare Workers edge runtime and Node.js.
 */
export async function queryDnsTxtRecords(domain: string): Promise<string[]> {
  const clean = domain.trim().toLowerCase();
  if (!clean || !clean.includes('.')) {
    return [];
  }

  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(clean)}&type=TXT`;
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as {
      Status: number;
      Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
    };

    if (data.Status !== 0 || !Array.isArray(data.Answer)) {
      return [];
    }

    // DNS type 16 = TXT
    return data.Answer
      .filter((record) => record.type === 16)
      .map((record) => record.data.replace(/^"|"$/g, '').trim());
  } catch {
    // If DoH query fails (e.g. offline unit test environment), fallback to Node.js dns/promises if available
    try {
      const dns = await import('node:dns/promises');
      const records = await dns.resolveTxt(clean);
      return records.map((chunks) => chunks.join(''));
    } catch {
      return [];
    }
  }
}

/**
 * Verifies DNS TXT record for custom domain and activates SSL status.
 */
export async function verifyCustomDomainDns(
  db: D1Database,
  partnerId: string,
  customDomain: string,
  dnsResolverMock?: (domain: string, expectedToken: string) => Promise<boolean>,
  nowMs = Date.now(),
): Promise<{ verified: boolean; message: string; verifiedAt?: number }> {
  const config = await getWhitelabelConfigByPartnerId(db, partnerId);
  if (!config) {
    return { verified: false, message: 'White-label config not found' };
  }

  const cleanDomain = customDomain.trim().toLowerCase();
  if (config.custom_domain?.toLowerCase() !== cleanDomain) {
    return { verified: false, message: 'Domain does not match configured custom domain' };
  }

  const expectedToken = config.dns_txt_verification_token;
  if (!expectedToken) {
    return { verified: false, message: 'No verification token generated for this domain' };
  }

  let verified = false;
  if (dnsResolverMock) {
    verified = await dnsResolverMock(cleanDomain, expectedToken);
  } else {
    // Authentic DNS TXT query via DoH / DNS resolver
    const txtRecords = await queryDnsTxtRecords(cleanDomain);
    verified = txtRecords.some((txt) => txt.includes(expectedToken) || txt === expectedToken);
  }

  if (verified) {
    await db
      .prepare(
        `UPDATE partner_whitelabel_configs
         SET is_ssl_active = 1,
             dns_verified_at = ?1,
             updated_at = ?1
         WHERE partner_id = ?2`
      )
      .bind(nowMs, partnerId)
      .run();

    return {
      verified: true,
      message: 'DNS TXT verification successful. SSL certificate provisioned.',
      verifiedAt: nowMs,
    };
  }

  return {
    verified: false,
    message: `Verification token '${expectedToken}' not detected in TXT records for ${cleanDomain}`,
  };
}

/**
 * Resolves white-label config & CSS theme by host/domain for edge branding injection.
 */
export async function resolveWhitelabelByDomain(
  db: D1Database,
  domain: string,
): Promise<{ config: PartnerWhitelabelConfig; theme: WhitelabelCssTheme } | null> {
  const cleanDomain = domain.toLowerCase().trim();
  const row = await db
    .prepare(
      `SELECT * FROM partner_whitelabel_configs
       WHERE custom_domain = ?1 AND is_ssl_active = 1
       LIMIT 1`
    )
    .bind(cleanDomain)
    .first<PartnerWhitelabelConfig>();

  if (!row) {
    return null;
  }

  return {
    config: row,
    theme: resolveWhitelabelTheme(row),
  };
}

/**
 * Request commission payout for partner pending earnings.
 * Enforces $50.00 (5,000 cents) minimum threshold and pending balance check.
 */
export async function requestCommissionPayout(
  db: D1Database,
  input: PayoutRequestInput,
  nowMs = Date.now(),
): Promise<PayoutRequestResult> {
  if (input.amountCents < MIN_PAYOUT_THRESHOLD_CENTS) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: 0,
      payoutRail: input.payoutRail,
      error: `Payout amount must be at least $${(MIN_PAYOUT_THRESHOLD_CENTS / 100).toFixed(2)} (5,000 cents)`,
    };
  }

  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: 0,
      payoutRail: input.payoutRail,
      error: `Partner profile ${input.partnerId} not found`,
    };
  }

  if (partner.pending_payout_cents < input.amountCents) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: partner.pending_payout_cents,
      payoutRail: input.payoutRail,
      error: `Insufficient pending payout balance (${partner.pending_payout_cents} cents available, requested ${input.amountCents} cents)`,
    };
  }

  const payoutBatchId = `payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // Atomic database-level balance deduction with CAS constraint (pending_payout_cents >= amountCents)
  const updateRes = await db
    .prepare(
      `UPDATE partner_profiles
       SET pending_payout_cents = pending_payout_cents - ?1,
           payout_rail = ?2,
           payout_destination_json = ?3,
           updated_at = ?4
       WHERE id = ?5 AND pending_payout_cents >= ?1`
    )
    .bind(
      input.amountCents,
      input.payoutRail,
      JSON.stringify(input.destinationDetails),
      nowMs,
      input.partnerId,
    )
    .run();

  const changes = Number(
    (updateRes as { changes?: number })?.changes ??
    (updateRes as { meta?: { changes?: number } })?.meta?.changes ??
    0
  );

  if (changes === 0) {
    // CAS check failed (insufficient balance or concurrent deduction)
    const currentPartner = await getPartnerById(db, input.partnerId);
    const currentPending = currentPartner ? currentPartner.pending_payout_cents : 0;
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: currentPending,
      payoutRail: input.payoutRail,
      error: `Insufficient pending payout balance (${currentPending} cents available, requested ${input.amountCents} cents)`,
    };
  }

  // Mark pending commissions as approved / linked to payout batch
  await db
    .prepare(
      `UPDATE partner_commissions
       SET status = 'approved',
           payout_batch_id = ?1
       WHERE partner_id = ?2 AND status = 'pending'`
    )
    .bind(payoutBatchId, input.partnerId)
    .run();

  // Query updated partner to return verified remaining balance
  const updatedPartner = await getPartnerById(db, input.partnerId);
  const remainingPending = updatedPartner ? updatedPartner.pending_payout_cents : 0;

  return {
    success: true,
    partnerId: input.partnerId,
    payoutBatchId,
    amountCents: input.amountCents,
    remainingPendingCents: remainingPending,
    payoutRail: input.payoutRail,
  };
}

/**
 * Alias for requestCommissionPayout to support partner payout operations.
 */
export const requestPartnerPayout = requestCommissionPayout;

/**
 * Aggregates complete partner dashboard metrics, commissions, and progress.
 */
export async function getPartnerDashboardData(
  db: D1Database,
  partnerId: string,
): Promise<PartnerDashboardData> {
  const profile = await getPartnerById(db, partnerId);
  if (!profile) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const whitelabelConfig = await getWhitelabelConfigByPartnerId(db, partnerId);

  const commissionsResult = await db
    .prepare(
      `SELECT * FROM partner_commissions
       WHERE partner_id = ?1
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(partnerId)
    .all<PartnerCommission>();

  const nextTier = calculateNextTierProgress(
    profile.tier,
    profile.total_referred_customers,
    profile.total_mrr_cents,
  );

  return {
    profile,
    whitelabelConfig,
    recentCommissions: commissionsResult.results ?? [],
    nextTier,
  };
}
