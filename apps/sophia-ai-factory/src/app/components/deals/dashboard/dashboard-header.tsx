'use client';

/**
 * Deals Admin Dashboard Top Header Component
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/dashboard-header
 */

import React from 'react';
import { Briefcase, Plus } from 'lucide-react';

export interface DashboardHeaderProps {
  isVi: boolean;
  onOpenNewDeal: () => void;
}

export function DashboardHeader({ isVi, onOpenNewDeal }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Briefcase className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isVi ? 'Quản Trị Cơ Hội Bán Hàng B2B & Làm Giàu Dữ Liệu AI' : 'Autonomous Enterprise Sales & B2B AI Fleet'}
          </h1>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          {isVi
            ? 'Cỗ máy thu nạp khách hàng doanh nghiệp, chấm điểm BANT 4 yếu tố, tạo đề xuất song ngữ và kích hoạt workspace demo 1-chạm.'
            : 'Enterprise lead ingestion, deterministic BANT scoring, bilingual proposal generation, and 1-click sandboxed demo provisioning.'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenNewDeal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition"
        >
          <Plus className="w-4 h-4" />
          {isVi ? 'Thêm Deal Mới' : 'Ingest New Deal'}
        </button>
      </div>
    </div>
  );
}
