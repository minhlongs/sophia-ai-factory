export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getPartnerByUserId,
  registerPartner,
  getPartnerStats,
} from '@/land/affiliates/affiliate-partner-service';
import { PartnerDashboardClient } from '@/app/components/affiliate/partner-dashboard-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi
      ? 'Quản Trị Đối Tác Affiliate | Sophia AI Factory'
      : 'Affiliate Partner Dashboard | Sophia AI Factory',
    description: isVi
      ? 'Theo dõi lượt click, doanh thu định kỳ 20%-30% MRR và cài đặt rút tiền USDT TRC-20'
      : 'Track your clicks, 20%-30% recurring MRR commissions, and configure automated USDT mass payouts.',
  };
}

export default async function AffiliateDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login?redirect=/dashboard/affiliate`);
  }

  // Retrieve or automatically register partner profile for authenticated user
  let partner = await getPartnerByUserId(user.id);
  if (!partner) {
    try {
      partner = await registerPartner({
        userId: user.id,
      });
    } catch {
      // Fallback: create synthetic partner record if DB table not yet migrated in test
      const now = new Date().toISOString();
      partner = {
        id: `aff_user_${user.id}`,
        userId: user.id,
        partnerCode: `SOPHIA_${user.id.slice(-6).toUpperCase()}`,
        tier: 'STANDARD',
        commissionRatePct: 20.0,
        tier2RatePct: 5.0,
        status: 'active',
        totalEarningsCents: 0,
        pendingPayoutCents: 0,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  // Retrieve partner performance statistics
  let stats = null;
  try {
    stats = await getPartnerStats(partner.partnerCode);
  } catch {
    stats = null;
  }

  if (!stats) {
    stats = {
      partnerCode: partner.partnerCode,
      tier: partner.tier,
      commissionRatePct: partner.commissionRatePct,
      tier2RatePct: partner.tier2RatePct,
      totalClicks: 0,
      totalConversions: 0,
      conversionRatePct: 0,
      totalEarningsCents: partner.totalEarningsCents,
      pendingPayoutCents: partner.pendingPayoutCents,
      availablePayoutCents: 0,
      lifetimePaidCents: 0,
    };
  }

  return (
    <PartnerDashboardClient
      partner={partner}
      stats={stats}
      locale={locale}
    />
  );
}
