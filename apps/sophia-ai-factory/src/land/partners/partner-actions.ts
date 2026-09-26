/**
 * Server Actions for Global Partner & White-Label Agency Engine
 *
 * Implements authenticated Server Actions with Cloudflare D1 persistence,
 * multi-tier commission ledgering, white-label branding, and payout management.
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/partners/*
 *
 * @module land/partners/partner-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  registerPartner,
  getPartnerByUserId,
  getPartnerDashboardData,
  requestCommissionPayout,
  upsertWhitelabelConfig,
  verifyCustomDomainDns,
  resolveWhitelabelByDomain,
  accruePartnerCommission,
} from '@/tree/partners/partner-service';
import type {
  PartnerProfile,
  PartnerDashboardData,
  PayoutRail,
  PayoutRequestResult,
  PartnerWhitelabelConfig,
  WhitelabelCssTheme,
  CommissionResult,
  PartnerType,
} from '@/tree/partners/types';

export interface PartnerActionError {
  code: string;
  message: string;
}

export interface RegisterPartnerActionInput {
  partnerName: string;
  partnerType?: PartnerType;
  referralCode?: string;
  payoutRail?: PayoutRail;
  payoutDestinationJson?: string;
}

export interface RequestPayoutActionInput {
  amountCents: number;
  payoutRail: PayoutRail;
  destinationDetails: Record<string, unknown>;
}

export interface ConfigureWhitelabelActionInput {
  brandName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  customDomain?: string | null;
  customEmailSender?: string | null;
  supportUrl?: string | null;
  footerHtml?: string | null;
}

export interface AccrueCommissionActionInput {
  partnerId: string;
  orderId: string;
  referredUserId: string;
  referredTenantId: string;
  mrrCents: number;
  isNewCustomer?: boolean;
  referredAtMs?: number;
}

/**
 * Register the authenticated user as an agency or reseller partner.
 */
export async function registerPartnerAction(
  input: RegisterPartnerActionInput,
): Promise<Result<PartnerProfile, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to register as partner' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partnerName = input.partnerName?.trim();
    if (!partnerName || partnerName.length < 2) {
      return failure({ code: 'INVALID_INPUT', message: 'Partner / Agency name must be at least 2 characters' });
    }

    const profile = await registerPartner(db, {
      userId: user.id,
      tenantId: `tenant_${user.id}`,
      partnerName,
      partnerType: input.partnerType || 'agency',
      referralCode: input.referralCode,
      payoutRail: input.payoutRail,
      payoutDestinationJson: input.payoutDestinationJson,
    });

    logger.info('Partner registered successfully', { partnerId: profile.id, userId: user.id });
    return success(profile);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to register partner', { error: error.message });
    return failure({ code: 'REGISTRATION_FAILED', message: error.message });
  }
}

/**
 * Retrieve the current partner dashboard metrics and history for the authenticated user.
 */
export async function getPartnerDashboardAction(): Promise<
  Result<PartnerDashboardData | null, PartnerActionError>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return success(null); // Not yet registered as partner
    }

    const dashboard = await getPartnerDashboardData(db, partner.id);
    return success(dashboard);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to fetch partner dashboard', { error: error.message });
    return failure({ code: 'DASHBOARD_FETCH_FAILED', message: error.message });
  }
}

/**
 * Request commission payout for accumulated pending earnings.
 */
export async function requestCommissionPayoutAction(
  input: RequestPayoutActionInput,
): Promise<Result<PayoutRequestResult, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found for user' });
    }

    const result = await requestCommissionPayout(db, {
      partnerId: partner.id,
      amountCents: input.amountCents,
      payoutRail: input.payoutRail,
      destinationDetails: input.destinationDetails,
    });

    if (!result.success) {
      return failure({ code: 'PAYOUT_REJECTED', message: result.error || 'Payout request rejected' });
    }

    logger.info('Partner payout requested', { partnerId: partner.id, amountCents: input.amountCents, batchId: result.payoutBatchId });
    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to request commission payout', { error: error.message });
    return failure({ code: 'PAYOUT_FAILED', message: error.message });
  }
}

/**
 * Configure white-label assets (PLATINUM tier exclusive).
 */
export async function configureWhitelabelAction(
  input: ConfigureWhitelabelActionInput,
): Promise<Result<PartnerWhitelabelConfig, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found' });
    }

    if (partner.tier !== 'PLATINUM' && partner.whitelabel_enabled !== 1) {
      return failure({
        code: 'TIER_LOCKED',
        message: 'White-label customization requires PLATINUM tier (30+ customers or $20k+ MRR)',
      });
    }

    const config = await upsertWhitelabelConfig(db, {
      partnerId: partner.id,
      brandName: input.brandName,
      logoUrl: input.logoUrl,
      faviconUrl: input.faviconUrl,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      customDomain: input.customDomain,
      customEmailSender: input.customEmailSender,
      supportUrl: input.supportUrl,
      footerHtml: input.footerHtml,
    });

    logger.info('White-label config updated', { partnerId: partner.id, domain: config.custom_domain });
    return success(config);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to configure white-label', { error: error.message });
    return failure({ code: 'CONFIG_FAILED', message: error.message });
  }
}

/**
 * Trigger DNS TXT verification for custom domain.
 */
export async function verifyCustomDomainDnsAction(
  customDomain: string,
): Promise<Result<{ verified: boolean; message: string; verifiedAt?: number }, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found' });
    }

    const result = await verifyCustomDomainDns(db, partner.id, customDomain);
    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to verify domain DNS', { error: error.message });
    return failure({ code: 'DNS_VERIFICATION_FAILED', message: error.message });
  }
}

/**
 * Public action: Resolve white-label theme by domain for edge / middleware injection.
 */
export async function getWhitelabelThemeByDomainAction(
  domain: string,
): Promise<Result<{ config: PartnerWhitelabelConfig; theme: WhitelabelCssTheme } | null, PartnerActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const resolved = await resolveWhitelabelByDomain(db, domain);
    return success(resolved);
  } catch (err) {
    const error = toError(err);
    return failure({ code: 'RESOLUTION_FAILED', message: error.message });
  }
}

/**
 * Accrue a commission for an order payment (called from payment IPN / order fulfillment).
 */
export async function recordAttributedCommissionAction(
  input: AccrueCommissionActionInput,
): Promise<Result<CommissionResult, PartnerActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await accruePartnerCommission(db, {
      partnerId: input.partnerId,
      referredUserId: input.referredUserId,
      referredTenantId: input.referredTenantId,
      orderId: input.orderId,
      mrrCents: input.mrrCents,
      isNewCustomer: input.isNewCustomer,
      referredAtMs: input.referredAtMs,
    });

    if (!result.success) {
      return failure({ code: 'COMMISSION_REJECTED', message: result.error || 'Commission accrual rejected' });
    }

    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to record commission', { error: error.message });
    return failure({ code: 'COMMISSION_FAILED', message: error.message });
  }
}
