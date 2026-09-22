export const dynamic = 'force-dynamic';

/**
 * Localized Admin Unit Economics Route
 *
 * Route: /[locale]/(admin)/admin/unit-economics
 * (and /vi/admin/unit-economics, /en/admin/unit-economics)
 *
 * @module app/[locale]/(admin)/admin/unit-economics/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getUnitEconomicsSummary } from '@/land/economics/unit-economics-service';
import { UnitEconomicsDashboard } from '@/forest/economics/unit-economics-dashboard';

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
      ? 'Quản Trị Hiệu Quả Kinh Tế Đơn Vị & Lợi Nhuận Gộp — Sophia Admin'
      : 'Unit Economics & Gross Margin — Sophia Admin',
    description: isVi
      ? 'Theo dõi thời gian thực biên lợi nhuận gộp, giá vốn trên mỗi video, tỷ lệ LTV:CAC và tối ưu hóa hạ tầng đa mô hình'
      : 'Real-time Gross Margin %, video COGS, LTV:CAC ratio and multimodal AI cost arbitrage',
  };
}

export default async function LocalizedAdminUnitEconomicsPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const summary = await getUnitEconomicsSummary(30);

  return (
    <main className="min-h-screen bg-zinc-950">
      <UnitEconomicsDashboard initialData={summary} locale={locale} />
    </main>
  );
}
