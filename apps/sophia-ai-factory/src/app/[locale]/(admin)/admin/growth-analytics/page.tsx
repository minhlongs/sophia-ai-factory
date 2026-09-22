export const dynamic = 'force-dynamic';

/**
 * Admin Growth Analytics Route (Localized Admin Group)
 *
 * Route: /[locale]/(admin)/admin/growth-analytics
 * (and /vi/admin/growth-analytics, /en/admin/growth-analytics)
 *
 * @module app/[locale]/(admin)/admin/growth-analytics/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getGrowthAnalyticsSummary } from '@/land/growth/growth-analytics-service';
import { GrowthAnalyticsDashboard } from '@/forest/growth/growth-analytics-dashboard';

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
      ? 'Bảng Điều Khiển Tăng Trưởng Doanh Thu — Sophia Admin'
      : 'Growth & Revenue Analytics — Sophia Admin',
    description: isVi
      ? 'Theo dõi thời gian thực cột mốc $5K MRR, 10 khách hàng đầu tiên và phễu chuyển đổi 4 giai đoạn'
      : 'Real-time $5,000 MRR milestone tracker and 4-stage omnichannel conversion funnel',
  };
}

export default async function LocalizedAdminGrowthAnalyticsPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const summary = await getGrowthAnalyticsSummary(30);

  return (
    <main className="min-h-screen bg-zinc-950">
      <GrowthAnalyticsDashboard initialData={summary} locale={locale} />
    </main>
  );
}
