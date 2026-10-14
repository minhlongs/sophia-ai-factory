export const dynamic = 'force-dynamic';

/**
 * Enterprise White-Label Settings Route Facade
 * Route: /[locale]/(app)/settings/white-label
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { WhiteLabelManager } from '@/forest/admin/white-label-manager';
import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
} from '@/land/admin/custom-domain-actions';
import { saveWhiteLabelBrandingSettingsAction } from '@/land/admin/white-label-actions';
import {
  type PageProps,
  UpgradePromoCard,
  loadWhiteLabelData,
} from './components';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Cài Đặt Nhãn Trắng & Tên Miền Tùy Chỉnh — Sophia AI Factory'
      : 'White-Label & Custom Domain Settings — Sophia AI Factory',
    description: isVi
      ? 'Tùy biến nhận diện thương hiệu, tên miền riêng và chứng chỉ SSL cho đại lý.'
      : 'Configure custom domain, automated SSL, and sovereign tenant branding for your agency.',
  };
}

export default async function SettingsWhiteLabelPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/settings/white-label`);
  }

  const db = await getD1();
  const { isMasterOrEnterprise, effectiveOrgId, initialDomains, initialBranding } =
    await loadWhiteLabelData(user, db);

  if (!isMasterOrEnterprise) {
    return <UpgradePromoCard locale={locale} />;
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
