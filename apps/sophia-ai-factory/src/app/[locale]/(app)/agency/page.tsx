export const dynamic = 'force-dynamic';

/**
 * Agency Operations Cockpit Page
 *
 * Route: /[locale]/(app)/agency
 *
 * Provides agency owners and managers with a full-stack cockpit:
 * - Real-time client subaccounts, video campaigns, MCU credit quotas, and MRR attribution
 * - Direct tenant isolation and white-label management
 *
 * Layer: app router (Presentation & Server Component)
 *
 * @module app/[locale]/(app)/agency/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import {
  getAgencyAdminOverviewAction,
  updateClientSubaccountStatusAction,
  reallocateClientMcuQuotaAction,
} from '@/land/agency/agency-portal-actions';
import { AgencyAdminPortal } from '@/forest/agency';

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
      ? 'Bảng Điều Khiển Doanh Nghiệp — Sophia AI Factory'
      : 'Agency Operations Cockpit — Sophia AI Factory',
    description: isVi
      ? 'Quản lý danh sách khách hàng, hạn mức điểm sản xuất video và doanh thu định kỳ.'
      : 'Manage your client subaccounts, video campaigns, credit quotas, and revenue attribution.',
  };
}

export default async function AgencyCockpitPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/agency`);
  }

  const db = await getD1();
  const orgId = (await resolveOrgId(user.id, db)) || user.id;

  // Resolve agency context details
  let agencyName = user.full_name ? `${user.full_name}'s Agency` : 'Enterprise Agency';
  let agencySlug = `agency-${user.id.substring(0, 6)}`;

  if (db && orgId) {
    try {
      const org = await db
        .prepare('SELECT name, slug FROM organizations WHERE id = ?1 LIMIT 1')
        .bind(orgId)
        .first<{ name: string | null; slug: string | null }>();

      if (org?.name) agencyName = org.name;
      if (org?.slug) agencySlug = org.slug;
    } catch {
      // Fallback to defaults
    }
  }

  const dashboardData = await getAgencyAdminOverviewAction(orgId, {
    agencyId: orgId,
    agencyName,
    agencySlug,
  });

  return (
    <main className="min-h-screen bg-background py-8">
      <AgencyAdminPortal
        initialData={dashboardData}
        locale={locale}
        actions={{
          updateClientStatus: updateClientSubaccountStatusAction,
          reallocateQuota: reallocateClientMcuQuotaAction,
        }}
      />
    </main>
  );
}
