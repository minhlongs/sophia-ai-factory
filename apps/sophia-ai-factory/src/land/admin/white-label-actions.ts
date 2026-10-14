/**
 * Server Actions for White-Label Branding Administration.
 *
 * Layer: land (Public business layer)
 * Dependencies: @/seed/*, @/tree/*, ./custom-domain-actions
 *
 * @module land/admin/white-label-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getOrgBranding,
  upsertOrgBranding,
  invalidateTenantBrandingCache,
} from '@/tree/branding/org-branding-repo';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import { assertMasterTierAndOrgAccess } from './custom-domain-actions';
import type {
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from '@/seed/types/custom-domains';
import {
  readTenantBrandingSettings,
  mergeAndSaveTenantBrandingSettings,
} from './white-label-settings-helpers';

export type {
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
};

/**
 * Retrieves the unified white-label branding configuration for an organization.
 */
export async function getWhiteLabelBrandingSettingsAction(
  orgId: string,
): Promise<Result<WhiteLabelBrandingSettings, WhiteLabelActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) {
      return failure({ code: auth.error.code, message: auth.error.message });
    }

    const orgBranding = await getOrgBranding(db, orgId);
    const tenantSettings = await readTenantBrandingSettings(db, orgId);

    const merged: WhiteLabelBrandingSettings = {
      orgId,
      agencyName: tenantSettings?.agencyName ?? orgBranding?.agency_name ?? null,
      logoUrl: tenantSettings?.logoUrl ?? orgBranding?.logo_url ?? null,
      faviconUrl: tenantSettings?.faviconUrl ?? DEFAULT_BRANDING.faviconUrl,
      primaryColor: tenantSettings?.primaryColor ?? orgBranding?.primary_color ?? DEFAULT_BRANDING.primaryColor,
      accentColor: tenantSettings?.accentColor ?? DEFAULT_BRANDING.accentColor ?? '#F59E0B',
      pageTitle: tenantSettings?.socialMeta?.title ?? null,
      footerText: tenantSettings?.emailFooter ?? null,
      welcomeMessage: tenantSettings?.welcomeMessage ?? DEFAULT_BRANDING.welcomeMessage,
    };

    return success(merged);
  } catch (err) {
    const error = toError(err);
    logger.error('[WhiteLabel] getWhiteLabelBrandingSettingsAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Persists updated white-label branding configuration for an organization.
 */
export async function saveWhiteLabelBrandingSettingsAction(
  orgId: string,
  input: SaveWhiteLabelBrandingInput,
): Promise<Result<WhiteLabelBrandingSettings, WhiteLabelActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) {
      return failure({ code: auth.error.code, message: auth.error.message });
    }

    await upsertOrgBranding(db, orgId, {
      agencyName: input.agencyName,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
    });

    const savedResult = await mergeAndSaveTenantBrandingSettings(db, orgId, input);
    invalidateTenantBrandingCache(undefined, orgId);

    logger.info('[WhiteLabel] Successfully updated white-label branding', {
      orgId,
      agencyName: savedResult.agencyName,
      primaryColor: savedResult.primaryColor,
    });

    return success(savedResult);
  } catch (err) {
    const error = toError(err);
    logger.error('[WhiteLabel] saveWhiteLabelBrandingSettingsAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
