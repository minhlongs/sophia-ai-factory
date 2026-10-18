/**
 * Data loader for Enterprise White-Label & Custom Domain Management Route
 *
 * @module app/[locale]/(admin)/admin/white-label/white-label-loader
 */

import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { listCustomDomainsByOrg } from '@/tree/custom-domains/verification-service';
import { getOrgBranding } from '@/tree/branding/org-branding-repo';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';

export interface WhiteLabelInitialBranding {
  orgId: string;
  agencyName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  pageTitle: string | null;
  footerText: string | null;
  welcomeMessage: string | null;
}

export interface AdminWhiteLabelContext {
  effectiveOrgId: string;
  initialDomains: CustomDomainRecord[];
  initialBranding: WhiteLabelInitialBranding | null;
}

export async function loadAdminWhiteLabelContext(userId: string): Promise<AdminWhiteLabelContext> {
  const db = await getD1();
  let orgId = await resolveOrgId(userId, db);

  if (!orgId && db) {
    try {
      const firstOrg = await db
        .prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1')
        .first<{ id: string }>();
      if (firstOrg?.id) {
        orgId = firstOrg.id;
      }
    } catch {
      // ignore
    }
  }

  const effectiveOrgId = orgId || 'platform-default-org';
  let initialDomains: CustomDomainRecord[] = [];
  let initialBranding: WhiteLabelInitialBranding | null = null;

  if (db && orgId) {
    try {
      initialDomains = await listCustomDomainsByOrg(db, orgId);
    } catch {
      initialDomains = [];
    }

    try {
      const orgBranding = await getOrgBranding(db, orgId);
      const row = await db
        .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'branding' LIMIT 1`)
        .bind(orgId)
        .first<{ value: string }>();

      let tenantSettings: Partial<BrandingSettings> | null = null;
      if (row?.value) {
        try {
          tenantSettings = JSON.parse(row.value) as Partial<BrandingSettings>;
        } catch {
          // ignore
        }
      }

      initialBranding = {
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
    } catch {
      initialBranding = null;
    }
  }

  return {
    effectiveOrgId,
    initialDomains,
    initialBranding,
  };
}
