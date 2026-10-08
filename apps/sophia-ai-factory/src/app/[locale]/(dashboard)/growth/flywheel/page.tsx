import React from 'react';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getFlywheelStatsAction } from '@/land/growth/flywheel-actions';
import { FlywheelCard } from '@/components/growth/flywheel-card';
import type { FlywheelSummaryStats } from '@/seed/types/growth-triad-v12';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Bánh đà Tự động Hóa Doanh thu (Flywheel v12) | Sophia AI Factory'
      : 'Autonomous Monetization Flywheel (v12) | Sophia AI Factory',
    description: isVi
      ? 'Giám sát chỉ số lan truyền Z-Score, phân mảnh biến dị Hook Darwin và đối soát doanh thu liên kết affiliate.'
      : 'Monitor retention Z-Score spikes, Darwinian hook mutations, and cross-platform affiliate attribution.',
  };
}

const DEFAULT_EMPTY_STATS: FlywheelSummaryStats = {
  totalReseedJobs: 0,
  alphaViralDetected: 0,
  reseededCount: 0,
  totalAttributedRevenueUsd: 0,
  totalCommissionUsd: 0,
};

export default async function FlywheelDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();

  let stats: FlywheelSummaryStats = DEFAULT_EMPTY_STATS;
  if (user?.id) {
    const res = await getFlywheelStatsAction();
    if (res.ok) {
      stats = res.value;
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {locale === 'vi' ? 'Hệ thống Tăng trưởng v12' : 'Growth Triad v12'}
        </h1>
        <p className="mt-2 text-neutral-400">
          {locale === 'vi'
            ? 'Vòng lặp tự động hóa khép kín: Tỷ lệ giữ chân người xem → Đột biến Hook → Xuất bản đa nền tảng → Doanh thu đối soát.'
            : 'Closed-loop autonomous cycle: Video retention rates → Hook mutations → Cross-platform distribution → Affiliate attribution.'}
        </p>
      </div>

      <FlywheelCard stats={stats} locale={locale} />
    </div>
  );
}
