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
import { WhiteLabelManager } from '@/forest/admin/white-label-manager';
import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
} from '@/land/admin/custom-domain-actions';
import {
  saveWhiteLabelBrandingSettingsAction,
} from '@/land/admin/white-label-actions';
import { loadAdminWhiteLabelContext } from './white-label-loader';

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

  const { effectiveOrgId, initialDomains, initialBranding } =
    await loadAdminWhiteLabelContext(user.id);

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
