import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import type { LeaderboardEntry } from '@/seed/types/affiliate-expansion-types';
import { getTierBadge } from './types';

interface PodiumRankingsProps {
  isVi: boolean;
  topAffiliates: LeaderboardEntry[];
}

export function PodiumRankings({ isVi, topAffiliates }: PodiumRankingsProps) {
  if (topAffiliates.length === 0) return null;

  const top1 = topAffiliates.find((a) => a.rank === 1);
  const top2 = topAffiliates.find((a) => a.rank === 2);
  const top3 = topAffiliates.find((a) => a.rank === 3);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        {isVi ? 'Bục Vinh Danh Top 3' : 'Top 3 Champions Podium'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Rank 2 - Runner Up */}
        <div className="order-2 md:order-1 bg-slate-900/90 border border-slate-700 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-3 left-3 bg-slate-800 text-slate-300 border border-slate-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
            #2
          </div>
          <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-slate-300 shadow-lg mb-3">
            <Medal className="w-8 h-8 text-slate-300" />
          </div>
          <div className="text-lg font-bold text-white">
            {top2 ? top2.maskedCode : isVi ? 'Đang mở' : 'Available'}
          </div>
          {top2 && (
            <>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-1 ${getTierBadge(top2.tier, isVi).bg}`}>
                {getTierBadge(top2.tier, isVi).label}
              </span>
              <div className="mt-4 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                <div>
                  <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                  <div className="font-bold text-slate-200">${top2.monthlyMrrUsd.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                  <div className="font-bold text-emerald-400">+${top2.bonusRewardUsd}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rank 1 - Champion */}
        <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-7 flex flex-col items-center text-center relative overflow-hidden shadow-2xl md:-translate-y-3">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {isVi ? 'Quán Quân' : 'Winner'} #1
          </div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-amber-200 flex items-center justify-center text-slate-950 shadow-xl mb-3">
            <Trophy className="w-10 h-10 text-slate-950" />
          </div>
          <div className="text-xl font-extrabold text-white">
            {top1 ? top1.maskedCode : isVi ? 'Đang mở' : 'Available'}
          </div>
          {top1 && (
            <>
              <span className={`text-xs font-semibold px-3 py-0.5 rounded-full border mt-1.5 ${getTierBadge(top1.tier, isVi).bg}`}>
                {getTierBadge(top1.tier, isVi).label}
              </span>
              <div className="mt-5 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                <div>
                  <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                  <div className="font-bold text-lg text-amber-300">${top1.monthlyMrrUsd.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                  <div className="font-bold text-lg text-emerald-400">+${top1.bonusRewardUsd}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rank 3 - Bronze */}
        <div className="order-3 bg-slate-900/90 border border-slate-700 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-3 left-3 bg-slate-800 text-amber-600 border border-amber-700/50 text-xs font-bold px-2.5 py-0.5 rounded-full">
            #3
          </div>
          <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-700 flex items-center justify-center text-amber-600 shadow-lg mb-3">
            <Award className="w-8 h-8 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-white">
            {top3 ? top3.maskedCode : isVi ? 'Đang mở' : 'Available'}
          </div>
          {top3 && (
            <>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-1 ${getTierBadge(top3.tier, isVi).bg}`}>
                {getTierBadge(top3.tier, isVi).label}
              </span>
              <div className="mt-4 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                <div>
                  <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                  <div className="font-bold text-slate-200">${top3.monthlyMrrUsd.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                  <div className="font-bold text-emerald-400">+${top3.bonusRewardUsd}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
