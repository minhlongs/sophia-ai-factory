/**
 * Unit Economics Dashboard Submodule: Dashboard Header.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/dashboard-header
 */

import React from 'react';
import { Calculator } from 'lucide-react';
import type { DashboardTab } from './types';

interface DashboardHeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  locale: 'vi' | 'en';
}

export function DashboardHeader({
  activeTab,
  onTabChange,
  locale,
}: DashboardHeaderProps) {
  const isVi = locale === 'vi';

  const tabs: { id: DashboardTab; labelVi: string; labelEn: string }[] = [
    { id: 'overview', labelVi: 'Tổng Quan', labelEn: 'Overview' },
    { id: 'providers', labelVi: 'Nhà Cung Cấp', labelEn: 'AI Providers' },
    { id: 'tiers', labelVi: 'Gói Dịch Vụ', labelEn: 'Tier Margins' },
    { id: 'simulator', labelVi: 'Mô Phỏng Giá Vốn', labelEn: 'Arbitrage Simulator' },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {isVi ? 'Quản Trị Hiệu Quả Kinh Tế Đơn Vị' : 'Unit Economics & Margin Dashboard'}
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {isVi
                ? 'Theo dõi lợi nhuận gộp thực tế, COGS video, LTV:CAC và tối ưu hóa hạ tầng đa mô hình'
                : 'Real-time gross margin, infrastructure COGS per video, LTV:CAC and multi-model arbitrage'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isVi ? tab.labelVi : tab.labelEn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
