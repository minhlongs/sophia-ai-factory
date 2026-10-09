'use client';

import React from 'react';
import { DollarSign, TrendingUp, Wallet, Star, Plus, Sparkles } from 'lucide-react';
import type { CreatorStudioStats, CreatorTemplate } from '@/seed/types/creator-marketplace';
import { formatUsd } from './constants';

interface StudioStatsHeaderProps {
  isVi: boolean;
  stats: CreatorStudioStats;
  templates: CreatorTemplate[];
  onOpenTemplateModal: () => void;
  onOpenWithdrawModal: () => void;
}

export function StudioStatsHeader({
  isVi,
  stats,
  templates,
  onOpenTemplateModal,
  onOpenWithdrawModal,
}: StudioStatsHeaderProps) {
  const totalUses = templates.reduce((acc, t) => acc + t.useCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {isVi ? 'Phòng Sáng Tạo & Giao Thức 70/30' : 'Creator Studio & 70/30 Protocol'}
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Đóng gói mẫu video viral, chia sẻ doanh thu 70% tự động & rút tiền qua USDT / VietQR.'
              : 'Package viral video recipes, earn 70% automatic royalties & withdraw via USDT or VietQR.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTemplateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            {isVi ? 'Đăng Mẫu Mới' : 'New Template'}
          </button>
          <button
            onClick={onOpenWithdrawModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-sm transition-all border border-zinc-700"
          >
            <Wallet className="h-4 w-4" />
            {isVi ? 'Rút Tiền Hoa Hồng' : 'Withdraw Earnings'}
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Doanh Thu Gộp' : 'Gross Volume'}</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-100">
            {formatUsd(stats.grossEarningsCents)}
          </div>
          <p className="text-xs text-zinc-500">
            {isVi ? '100% doanh thu kích hoạt mẫu' : '100% template activation fees'}
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-indigo-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Hoa Hồng Tác Giả (70%)' : 'Creator Royalties (70%)'}</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-300">
            {formatUsd(stats.creatorRoyaltyCents)}
          </div>
          <p className="text-xs text-indigo-400/80">
            {isVi ? 'Trích 70% không hao hụt cent' : 'Pure integer 70% allocation'}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Số Dư Khả Dụng' : 'Available Balance'}</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-300">
            {formatUsd(stats.availableBalanceCents)}
          </div>
          <p className="text-xs text-zinc-500">
            {isVi ? 'Sẵn sàng rút về USDT / VietQR' : 'Ready for dual-rail withdrawal'}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Mẫu & Đánh Giá' : 'Templates & Score'}</span>
            <Star className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>{templates.length}</span>
            <span className="text-sm font-normal text-zinc-400">
              ({totalUses} {isVi ? 'lượt dùng' : 'uses'})
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            ⭐ {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '5.0'} / 5.0 (
            {stats.totalReviews} {isVi ? 'đánh giá' : 'reviews'})
          </p>
        </div>
      </div>
    </div>
  );
}
