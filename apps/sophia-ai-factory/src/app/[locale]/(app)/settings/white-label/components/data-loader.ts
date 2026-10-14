import type { User } from '@/seed/db/client';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { listCustomDomainsByOrg } from '@/tree/custom-domains/verification-service';
import { getOrgBranding } from '@/tree/branding/org-branding-repo';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import type { InitialBrandingData, WhiteLabelLoaderResult } from './types';

export async function loadWhiteLabelData(
  user: User,
  db: D1Database | null,
): Promise<WhiteLabelLoaderResult> {
  const { isAdmin } = await isUserAdminWithRole(user);
  const userTier = await getUserTier(user.id);
  const orgId = await resolveOrgId(user.id, db);

  let isMasterOrEnterprise =
    isAdmin || user.role === 'admin' || userTier === 'MASTER' || userTier === 'ENTERPRISE';

  if (!isMasterOrEnterprise && db && orgId) {
    try {
      const orgSub = await db
        .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
        .bind(orgId)
        .first<{ tier: string | null; plan: string | null }>();

      if (
        orgSub?.tier === 'MASTER' ||
        orgSub?.tier === 'ENTERPRISE' ||
        orgSub?.plan?.toLowerCase() === 'master' ||
        orgSub?.plan?.toLowerCase() === 'enterprise'
      ) {
        isMasterOrEnterprise = true;
      }
    } catch {
      // ignore
    }
  }

  const effectiveOrgId = orgId || `org-${user.id}`;
  let initialDomains: CustomDomainRecord[] = [];
  let initialBranding: InitialBrandingData | null = null;

  if (isMasterOrEnterprise && db && orgId) {
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
        accentColor: (tenantSettings?.accentColor ?? DEFAULT_BRANDING.accentColor ?? '#F59E0B') ?? '#F59E0B',
        pageTitle: tenantSettings?.socialMeta?.title ?? null,
        footerText: tenantSettings?.emailFooter ?? null,
        welcomeMessage: tenantSettings?.welcomeMessage ?? DEFAULT_BRANDING.welcomeMessage,
      };
    } catch {
      initialBranding = null;
    }
  }

  return {
    isMasterOrEnterprise,
    effectiveOrgId,
    initialDomains,
    initialBranding,
  };
}
