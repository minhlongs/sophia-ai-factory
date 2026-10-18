'use client';

/**
 * Interactive ROI & Cost Comparison Calculator
 *
 * Layer: forest/solutions/interactive-sections
 */

import React, { useState } from 'react';
import { Percent } from 'lucide-react';
import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { RoiComparisonCards } from './roi-comparison-cards';

interface RoiCalculatorProps {
  industry: SolutionIndustry;
  isVi: boolean;
}

export function RoiCalculator({ industry, isVi }: RoiCalculatorProps) {
  const [videoCount, setVideoCount] = useState(30);

  const agencyCostPerVideo = Math.round(industry.roiComparison.traditionalAgencyCostMonthlyUsd / 20);
  const totalAgencyCost = videoCount * agencyCostPerVideo;
  const sophiaCost = industry.roiComparison.sophiaMonthlyUsd;
  const totalSavings = Math.max(0, totalAgencyCost - sophiaCost);
  const timeSavedHours = Math.round(videoCount * 4.5);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-semibold mb-2">
          <Percent className="w-3.5 h-3.5" />
          {isVi ? 'Bài Toán Lợi Nhuận ROI' : 'Interactive ROI Calculator'}
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {isVi
            ? `So Sánh Chi Phí Sản Xuất Video Ngành ${industry.nameVi}`
            : `Traditional Agency vs Sophia AI Factory for ${industry.nameEn}`}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2">
          {isVi
            ? 'Xem số tiền và thời gian doanh nghiệp của bạn tiết kiệm được khi chuyển sang mô hình AI Video Factory tự động.'
            : 'Calculate your exact monthly capital savings and accelerated delivery speed.'}
        </p>
      </div>

      {/* Video Slider */}
      <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
        <div className="flex justify-between items-center text-xs font-medium mb-2">
          <span className="text-zinc-300">
            {isVi ? 'Số lượng video cần mỗi tháng:' : 'Target video output per month:'}
          </span>
          <span className="text-emerald-400 font-bold text-sm">{videoCount} videos</span>
        </div>
        <input
          type="range"
          min="10"
          max="120"
          step="5"
          value={videoCount}
          onChange={(e) => setVideoCount(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span>10 videos</span>
          <span>60 videos</span>
          <span>120 videos</span>
        </div>
      </div>

      <RoiComparisonCards
        isVi={isVi}
        totalAgencyCost={totalAgencyCost}
        agencyCostPerVideo={agencyCostPerVideo}
        sophiaCost={sophiaCost}
        totalSavings={totalSavings}
        timeSavedHours={timeSavedHours}
      />
    </section>
  );
}
