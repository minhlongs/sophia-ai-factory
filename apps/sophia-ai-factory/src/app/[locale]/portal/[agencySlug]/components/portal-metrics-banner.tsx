'use client';

/**
 * White-Label Client Portal Banner & Metrics Section
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-metrics-banner
 */

import React from 'react';
import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';

export interface PortalMetricsBannerProps {
  agency: UnbrandedAgencyPortalConfig;
  isVi: boolean;
  deliverablesCount: number;
}

export function PortalMetricsBanner({ agency, isVi, deliverablesCount }: PortalMetricsBannerProps) {
  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-cyan-400 border border-slate-700/60">
            <span className="w-2 h-2 rounded-full animate-pulse bg-cyan-400" />
            {isVi ? 'Hệ Thống Sáng Tạo Đang Hoạt Động' : 'AI Production Engine Active'}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            {agency.loginHeadline ||
              (isVi
                ? `Chào mừng đến với Cổng Sản Xuất Video của ${agency.brandName}`
                : `Welcome to the ${agency.brandName} Creative Portal`)}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            {agency.loginSubheading ||
              (isVi
                ? 'Theo dõi tiến độ bàn giao video ngắn, quản lý chiến dịch đa nền tảng và khởi tạo yêu cầu sản xuất nội dung tức thì.'
                : 'Track short-form video deliverables, manage multi-platform campaigns, and launch autonomous video requests with high-fidelity voice dubbing.')}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isVi ? 'Chiến dịch Đang chạy' : 'Active Campaigns'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">8</div>
          <div className="text-xs text-emerald-400 font-medium">
            {isVi ? '✓ 100% Đúng tiến độ' : '✓ 100% On Schedule'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isVi ? 'Video Bàn giao' : 'Videos Rendered'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">{deliverablesCount + 124}</div>
          <div className="text-xs text-slate-400">
            {isVi ? '+18 video trong tháng này' : '+18 this month'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isVi ? 'Hạn mức MCU Còn lại' : 'MCU Compute Quota'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">6,850</div>
          <div className="text-xs text-cyan-400 font-medium">
            {isVi ? '68.5% Dung lượng khả dụng' : '68.5% Available'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isVi ? 'Trạng thái Dịch vụ' : 'Service SLA Status'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400">99.9%</div>
          <div className="text-xs text-emerald-500 font-medium">
            {isVi ? 'Edge Node 0ms Độ trễ' : 'Edge Node 0ms Latency'}
          </div>
        </div>
      </section>
    </>
  );
}
