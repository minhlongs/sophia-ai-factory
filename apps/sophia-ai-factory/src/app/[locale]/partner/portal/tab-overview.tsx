'use client';

import React from 'react';
import { Users, TrendingUp, DollarSign, Award, Sparkles } from 'lucide-react';
import type { PartnerDashboardData, PartnerProfile } from '@/tree/partners/types';

interface TabOverviewProps {
  profile: PartnerProfile;
  nextTier: PartnerDashboardData['nextTier'];
  isVi: boolean;
}

export function TabOverview({ profile, nextTier, isVi }: TabOverviewProps) {
  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cyan-400" />
            {isVi ? 'Khách Hàng Đã Giới Thiệu' : 'Referred Customers'}
          </span>
          <p className="text-2xl font-bold text-zinc-100">{profile.total_referred_customers}</p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            {isVi ? 'Tổng MRR Đã Tạo' : 'Referred Active MRR'}
          </span>
          <p className="text-2xl font-bold text-zinc-100">
            ${(profile.total_mrr_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-purple-400" />
            {isVi ? 'Tổng Thu Nhập Lũy Kế' : 'Total Earnings'}
          </span>
          <p className="text-2xl font-bold text-zinc-100">
            ${(profile.total_earnings_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            {isVi ? 'Hoa Hồng Chờ Rút' : 'Pending Payout'}
          </span>
          <p className="text-2xl font-bold text-amber-300">
            ${(profile.pending_payout_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gamification Progress to Next Tier */}
      {nextTier.targetTier && (
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-zinc-200">
                {isVi
                  ? `Mục tiêu thăng hạng lên ${nextTier.targetTier}`
                  : `Progress to ${nextTier.targetTier} Tier`}
              </span>
            </div>
            <span className="text-xs font-bold text-cyan-400">
              {nextTier.progressPct}% {isVi ? 'Hoàn Thành' : 'Complete'}
            </span>
          </div>

          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, nextTier.progressPct))}%` }}
            />
          </div>

          <p className="text-xs text-zinc-400">
            {isVi
              ? `Cần thêm ${nextTier.customersRemaining} khách hàng HOẶC $${(
                  nextTier.mrrRemainingCents / 100
                ).toLocaleString()} MRR để mở khóa mức hoa hồng cao hơn.`
              : `Need ${nextTier.customersRemaining} more customers OR $${(
                  nextTier.mrrRemainingCents / 100
                ).toLocaleString()} active MRR to unlock higher tier perks.`}
          </p>
        </div>
      )}
    </div>
  );
}
