export const dynamic = 'force-dynamic';

/**
 * Enterprise White-Label & Custom Domain Management Route (Admin Group)
 *
 * Route: /[locale]/(admin)/admin/white-label
 * (and /vi/admin/white-label, /en/admin/white-label)
 *
 * @module app/[locale]/(admin)/admin/white-label/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { listCustomDomainsByOrg } from '@/tree/custom-domains/verification-service';
import { getOrgBranding } from '@/tree/branding/org-branding-repo';
import { WhiteLabelManager } from '@/forest/admin/white-label-manager';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
} from '@/land/admin/custom-domain-actions';
import {
  saveWhiteLabelBrandingSettingsAction,
} from '@/land/admin/white-label-actions';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Quản Trị Nhãn Trắng Doanh Nghiệp & Tên Miền — Sophia Admin'
      : 'Enterprise White-Label & Custom Domains — Sophia Admin',
    description: isVi
      ? 'Cung cấp tên miền tùy chỉnh, chứng chỉ SSL Cloudflare tự động và quản lý nhận diện thương hiệu khách thuê.'
      : 'Provision custom domains, automated Cloudflare SSL certificates, and manage tenant branding.',
  };
}

export default async function AdminWhiteLabelPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/admin/white-label`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${locale}/dashboard?error=admin_required`);
  }

  const db = await getD1();
  let orgId = await resolveOrgId(user.id, db);

  // If platform admin has no assigned org, find or fallback to the first active organization in D1
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
  let initialBranding = null;

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

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <WhiteLabelManager
        orgId={effectiveOrgId}
        initialDomains={initialDomains}
        initialBranding={initialBranding}
        actions={{
          registerCustomDomain: registerCustomDomainAction,
          verifyCustomDomainStatus: verifyCustomDomainStatusAction,
          deleteCustomDomain: deleteCustomDomainAction,
          saveWhiteLabelBrandingSettings: saveWhiteLabelBrandingSettingsAction,
        }}
      />
    </main>
  );
}
