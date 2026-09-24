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
  type OrgBrandingRow,
} from '@/tree/branding/org-branding-repo';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import { assertMasterTierAndOrgAccess } from './custom-domain-actions';
import type {
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from '@/seed/types/custom-domains';

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

    // Read namespaced tenant_settings
    let tenantSettings: Partial<BrandingSettings> | null = null;
    try {
      const row = await db
        .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'branding' LIMIT 1`)
        .bind(orgId)
        .first<{ value: string }>();

      if (row?.value) {
        tenantSettings = JSON.parse(row.value) as Partial<BrandingSettings>;
      }
    } catch {
      // Fallback gracefully
    }

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

    // 1. Update org_branding table (legacy & watermark compatibility)
    await upsertOrgBranding(db, orgId, {
      agencyName: input.agencyName,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
    });

    // 2. Read existing tenant_settings to merge
    let currentSettings: BrandingSettings = { ...DEFAULT_BRANDING };
    try {
      const row = await db
        .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'branding' LIMIT 1`)
        .bind(orgId)
        .first<{ value: string }>();

      if (row?.value) {
        currentSettings = { ...DEFAULT_BRANDING, ...JSON.parse(row.value) };
      }
    } catch {
      // Keep defaults
    }

    const updatedSettings: BrandingSettings = {
      ...currentSettings,
      agencyName: input.agencyName !== undefined ? input.agencyName : currentSettings.agencyName,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl : currentSettings.logoUrl,
      faviconUrl: input.faviconUrl !== undefined ? input.faviconUrl : currentSettings.faviconUrl,
      primaryColor: input.primaryColor || currentSettings.primaryColor || DEFAULT_BRANDING.primaryColor,
      accentColor: input.accentColor || currentSettings.accentColor || '#F59E0B',
      emailFooter: input.footerText !== undefined ? input.footerText : currentSettings.emailFooter,
      welcomeMessage: input.welcomeMessage !== undefined ? input.welcomeMessage : currentSettings.welcomeMessage,
      socialMeta: {
        title: input.pageTitle !== undefined ? input.pageTitle : currentSettings.socialMeta?.title ?? null,
        description: currentSettings.socialMeta?.description ?? null,
        imageUrl: input.logoUrl !== undefined ? input.logoUrl : currentSettings.socialMeta?.imageUrl ?? null,
      },
    };

    // 3. Upsert tenant_settings table
    const settingId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    await db
      .prepare(
        `INSERT INTO tenant_settings (id, tenant_id, namespace, value, schema_version, updated_at)
         VALUES (?1, ?2, 'branding', ?3, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(tenant_id, namespace) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(settingId, orgId, JSON.stringify(updatedSettings))
      .run();

    // 4. Invalidate edge branding caches
    invalidateTenantBrandingCache(undefined, orgId);

    const savedResult: WhiteLabelBrandingSettings = {
      orgId,
      agencyName: updatedSettings.agencyName,
      logoUrl: updatedSettings.logoUrl,
      faviconUrl: updatedSettings.faviconUrl,
      primaryColor: updatedSettings.primaryColor,
      accentColor: updatedSettings.accentColor ?? '#F59E0B',
      pageTitle: updatedSettings.socialMeta?.title ?? null,
      footerText: updatedSettings.emailFooter ?? null,
      welcomeMessage: updatedSettings.welcomeMessage,
    };

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
