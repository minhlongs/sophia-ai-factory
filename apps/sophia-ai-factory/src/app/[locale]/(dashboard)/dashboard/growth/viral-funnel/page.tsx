export const dynamic = 'force-dynamic';

import React from 'react';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getViralFunnelOverview } from '@/land/growth/viral-funnel-service';
import { ViralFunnelView } from '@/forest/growth/viral-funnel-view';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Phễu Video Viral & Phân Phối Đa Kênh | Sophia AI Factory'
      : 'Viral Video Funnel & Multi-Channel Distribution | Sophia AI Factory',
    description: isVi
      ? 'Theo dõi lượt xem, tỷ lệ nhấp CTA và lượng khách hàng tiềm năng tạo ra từ video TikTok, YouTube Shorts và X.'
      : 'Track real-time views, CTA CTR, and qualified leads generated per video across TikTok, YouTube Shorts, and X.',
  };
}

export default async function ViralFunnelDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const user = await getCurrentUser();

  const overview = await getViralFunnelOverview(user?.id);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ViralFunnelView initialOverview={overview} locale={isVi ? 'vi' : 'en'} />
    </main>
  );
}
