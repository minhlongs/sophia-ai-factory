export const dynamic = 'force-dynamic';

/**
 * Autonomous Enterprise Sales & B2B AI Fleet Route (Admin Group)
 *
 * Route: /[locale]/(admin)/admin/deals
 * (and /vi/admin/deals, /en/admin/deals)
 *
 * Layer: land (Next.js App Router Page)
 *
 * @module app/[locale]/(admin)/admin/deals/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { DealsAdminDashboard } from '@/app/components/deals/deals-admin-dashboard';
import {
  queryEnterpriseDeals,
  getDealsPipelineMetrics,
} from '@/tree/sales/enterprise-deal-repo';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

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
      ? 'Quản Trị Cơ Hội Bán Hàng B2B & Làm Giàu Dữ Liệu AI — Sophia Admin'
      : 'Autonomous Enterprise Sales & B2B AI Fleet — Sophia Admin',
    description: isVi
      ? 'Cỗ máy thu nạp khách hàng doanh nghiệp, chấm điểm BANT 4 yếu tố, tạo đề xuất song ngữ và kích hoạt workspace demo 1-chạm.'
      : 'Enterprise lead ingestion, deterministic BANT scoring, bilingual proposal generation, and 1-click sandboxed demo provisioning.',
  };
}

export default async function AdminDealsPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/admin/deals`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${locale}/dashboard?error=admin_required`);
  }

  const db = await getD1();
  let initialDeals: EnterpriseDeal[] = [];
  let initialMetrics: {
    totalDeals: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    totalEstimatedValueCents: number;
    avgBantScore: number;
    wonDeals: number;
  } | undefined = undefined;

  if (db) {
    try {
      const dealsRes = await queryEnterpriseDeals(db, { limit: 50 });
      initialDeals = dealsRes.deals;
    } catch {
      initialDeals = [];
    }

    try {
      initialMetrics = await getDealsPipelineMetrics(db);
    } catch {
      initialMetrics = undefined;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <DealsAdminDashboard
        initialDeals={initialDeals}
        initialMetrics={initialMetrics}
        locale={locale}
      />
    </main>
  );
}
