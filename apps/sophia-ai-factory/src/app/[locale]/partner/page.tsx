/**
 * Global Partner & Reseller Multi-Tier Portal (White-Label Agency Engine)
 *
 * Supports bilingual routing (/partner & /vi/partner), tier status progression,
 * commission ledger views, and sovereign white-label DNS/theming configuration.
 *
 * Layer: land (App Router Page)
 */

import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPartnerDashboardAction } from '@/land/partners/partner-actions';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';
import { PartnerPortalClient } from './partner-portal-client';
import { StitchAgencySubaccountStrip } from './stitch-agency-subaccount-strip';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function getPartnerMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi
      ? 'Cổng Đối Tác & Đại Lý Toàn Cầu — Sophia AI Factory'
      : 'Global Partner & White-Label Portal — Sophia AI Factory',
    description: isVi
      ? 'Chương trình đại lý và nhãn trắng độc quyền. Hoa hồng định kỳ lên đến 35%, tên miền riêng và thương hiệu tùy chỉnh.'
      : 'Sovereign white-label agency portal and partner program. Earn up to 35% recurring commissions with custom domains and branding.',
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getPartnerMeta(locale);
  return buildPublicPageMetadata({ locale, path: '/partner', title, description });
}

export default async function PartnerPortalPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';
  const { title, description } = getPartnerMeta(locale);

  const user = await getCurrentUser();
  let initialDashboard = null;

  if (user) {
    const dashboardResult = await getPartnerDashboardAction();
    if (dashboardResult.ok) {
      initialDashboard = dashboardResult.value;
    }
  }

  return (
    <>
      <WebPageJsonLd
        id="partner"
        title={title}
        description={description}
        path="/partner"
        locale={locale}
      />
      <StitchAgencySubaccountStrip isVi={isVi} />
      <PartnerPortalClient
        initialDashboard={initialDashboard}
        locale={locale}
        isVi={isVi}
        userEmail={user?.email}
        isAuthenticated={Boolean(user)}
      />
    </>
  );
}
