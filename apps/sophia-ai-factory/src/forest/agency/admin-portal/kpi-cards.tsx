/**
 * Agency Admin Portal Header & KPI Cards Grid
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/kpi-cards
 */

import React from 'react';
import {
  Users,
  Video,
  DollarSign,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { AgencyAdminDashboardData } from './types';

export { PortalHeader, type PortalHeaderProps } from './portal-header';

export interface KpiCardsGridProps {
  kpi: AgencyAdminDashboardData['kpi'];
  isVi: boolean;
}

export function KpiCardsGrid({ kpi, isVi }: KpiCardsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Clients */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {isVi ? 'Khách Hàng Đang Hoạt Động' : 'Active Client Workspaces'}
          </p>
          <h3 className="text-2xl font-bold text-foreground mt-1">
            {kpi.totalActiveClients}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isVi ? 'Không gian làm việc riêng biệt' : 'Isolated client spaces'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* MCU Quota Utilization */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
        <div className="flex-1 mr-3">
          <p className="text-xs font-medium text-muted-foreground">
            {isVi ? 'Tỷ Lệ Tiêu Hao Điểm' : 'Credit Quota Utilization'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">
              {kpi.mcuUtilizationRate}%
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {kpi.totalUsedMcu}/{kpi.totalAllocatedMcu} MCU
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                kpi.mcuUtilizationRate > 80
                  ? 'bg-rose-500'
                  : kpi.mcuUtilizationRate > 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, kpi.mcuUtilizationRate)}%` }}
            />
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          <Zap className="w-6 h-6" />
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {isVi ? 'Chiến Dịch Đang Thực Hiện' : 'Active Video Deliverables'}
          </p>
          <h3 className="text-2xl font-bold text-foreground mt-1">
            {kpi.activeCampaigns}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isVi ? 'Bản thảo video đang duyệt' : 'Review links in flight'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
          <Video className="w-6 h-6" />
        </div>
      </div>

      {/* Attributed MRR */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {isVi ? 'Doanh Thu Định Kỳ Ước Tính' : 'Attributed Monthly Value'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">
              ${kpi.attributedMrrUsd.toLocaleString()}
            </h3>
            <span className="inline-flex items-center text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-3 h-3 mr-0.5" />+{kpi.growthRatePercent}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isVi ? 'Doanh thu danh mục quản lý' : 'Portfolio attributed MRR'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <DollarSign className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
