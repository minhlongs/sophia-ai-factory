/**
 * Global Partner & Reseller Multi-Tier Portal (White-Label Agency Engine)
 *
 * Supports bilingual routing (/partner & /vi/partner), tier status progression,
 * commission ledger views, and sovereign white-label DNS/theming configuration.
 *
 * Layer: land (App Router Page)
 */

import { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPartnerDashboardAction } from '@/land/partners/partner-actions';
import { PartnerPortalClient } from './partner-portal-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Cổng Đối Tác & Đại Lý Toàn Cầu — Sophia AI Factory'
      : 'Global Partner & White-Label Portal — Sophia AI Factory',
    description: isVi
      ? 'Chương trình đại lý và nhãn trắng độc quyền. Hoa hồng định kỳ lên đến 35%, tên miền riêng và thương hiệu tùy chỉnh.'
      : 'Sovereign white-label agency portal and partner program. Earn up to 35% recurring commissions with custom domains and branding.',
    alternates: {
      canonical: `/${resolved.locale}/partner`,
      languages: {
        en: '/en/partner',
        vi: '/vi/partner',
      },
    },
  };
}

export default async function PartnerPortalPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  const user = await getCurrentUser();
  let initialDashboard = null;

  if (user) {
    const dashboardResult = await getPartnerDashboardAction();
    if (dashboardResult.ok) {
      initialDashboard = dashboardResult.value;
    }
  }

  return (
    <PartnerPortalClient
      initialDashboard={initialDashboard}
      locale={locale}
      isVi={isVi}
      userEmail={user?.email}
      isAuthenticated={Boolean(user)}
    />
  );
}
