'use client';

/**
 * ROI Comparison Grid — Agency vs Sophia AI Factory cards
 *
 * Layer: forest/solutions/interactive-sections
 */

import React from 'react';
import { Zap, DollarSign, Clock } from 'lucide-react';

interface RoiComparisonCardsProps {
  isVi: boolean;
  totalAgencyCost: number;
  agencyCostPerVideo: number;
  sophiaCost: number;
  totalSavings: number;
  timeSavedHours: number;
}

export function RoiComparisonCards({
  isVi,
  totalAgencyCost,
  agencyCostPerVideo,
  sophiaCost,
  totalSavings,
  timeSavedHours,
}: RoiComparisonCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {/* Traditional Agency */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 relative">
        <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
          {isVi ? 'Thuê Agency / Ekip Truyền Thống' : 'Traditional Video Agency'}
        </div>
        <div className="text-3xl font-extrabold text-white">
          ${totalAgencyCost.toLocaleString()}
          <span className="text-xs font-normal text-zinc-400 ml-1">/{isVi ? 'tháng' : 'month'}</span>
        </div>
        <ul className="mt-5 space-y-3 text-xs text-zinc-300">
          <li className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {isVi
                ? 'Thời gian chờ: 10 - 14 ngày mỗi đợt duyệt clip'
                : '10 - 14 day turnaround per batch'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {isVi
                ? `Chi phí trung bình: $${agencyCostPerVideo} / video đơn lẻ`
                : `Average $${agencyCostPerVideo} per single finished video`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-rose-400 font-bold shrink-0">✕</span>
            <span>
              {isVi ? 'Giới hạn số lần sửa kịch bản & quay lại' : 'Strict limit on retakes and edits'}
            </span>
          </li>
        </ul>
      </div>

      {/* Sophia AI Factory */}
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 relative shadow-lg shadow-emerald-500/5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Sophia AI Factory
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            {isVi ? 'Tiết kiệm 90%+' : '90%+ Savings'}
          </span>
        </div>
        <div className="text-3xl font-extrabold text-white">
          ${sophiaCost}
          <span className="text-xs font-normal text-zinc-400 ml-1">/{isVi ? 'tháng' : 'month'}</span>
        </div>
        <ul className="mt-5 space-y-3 text-xs text-zinc-300">
          <li className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isVi ? 'Thời gian xuất video: 60 giây' : 'Sub-60 second rendering speed'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isVi
                ? `Bạn tiết kiệm: $${totalSavings.toLocaleString()} / tháng`
                : `Estimated savings: $${totalSavings.toLocaleString()} / month`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isVi
                ? `Tiết kiệm ${timeSavedHours} giờ làm việc của nhân sự`
                : `Saves ~${timeSavedHours} human production hours`}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
