/**
 * White-Label Customization & Domain Verification Server Actions
 *
 * Layer: land/partners/partner-ops
 *
 * @module land/partners/partner-ops/partner-whitelabel-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getPartnerByUserId,
  upsertWhitelabelConfig,
  verifyCustomDomainDns,
  resolveWhitelabelByDomain,
} from '@/tree/partners/partner-service';
import type {
  PartnerWhitelabelConfig,
  WhitelabelCssTheme,
  PartnerActionError,
  ConfigureWhitelabelActionInput,
} from './types';

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
