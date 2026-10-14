/**
 * Tenant settings read/merge/upsert helpers for White-Label Branding Administration.
 * @module land/admin/white-label-settings-helpers
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type {
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
} from '@/seed/types/custom-domains';

export async function readTenantBrandingSettings(
  db: D1Database,
  orgId: string,
): Promise<Partial<BrandingSettings> | null> {
  try {
    const row = await db
      .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'branding' LIMIT 1`)
      .bind(orgId)
      .first<{ value: string }>();

    if (row?.value) {
      return JSON.parse(row.value) as Partial<BrandingSettings>;
    }
  } catch {
    // Fallback gracefully
  }
  return null;
}

export async function mergeAndSaveTenantBrandingSettings(
  db: D1Database,
  orgId: string,
  input: SaveWhiteLabelBrandingInput,
): Promise<WhiteLabelBrandingSettings> {
  const existing = await readTenantBrandingSettings(db, orgId);
  const currentSettings: BrandingSettings = { ...DEFAULT_BRANDING, ...(existing ?? {}) };

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

  return {
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
}
