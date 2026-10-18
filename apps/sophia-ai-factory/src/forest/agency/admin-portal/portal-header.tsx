/**
 * Agency Admin Portal Header Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/portal-header
 */

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { AgencyAdminDashboardData } from './types';

export interface PortalHeaderProps {
  agencyContext: AgencyAdminDashboardData['agencyContext'];
  locale: 'en' | 'vi';
}

export function PortalHeader({ agencyContext, locale }: PortalHeaderProps) {
  const isVi = locale === 'vi';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary uppercase tracking-wide">
            {agencyContext.agencyName}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            @{agencyContext.agencySlug}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
          {isVi ? 'Bảng Điều Khiển Quản Trị Doanh Nghiệp' : 'Agency Operations Cockpit'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Quản lý khách hàng, chiến dịch sản xuất video, hạn mức điểm và doanh thu định kỳ.'
            : 'Manage your clients, video campaigns, credit quotas, and revenue attribution.'}
        </p>
      </div>

      <div>
        <Link
          href={`/${locale}/agency/onboarding`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {isVi ? 'Khởi Tạo Khách Hàng Mới' : 'Onboard New Client'}
        </Link>
      </div>
    </div>
  );
}
