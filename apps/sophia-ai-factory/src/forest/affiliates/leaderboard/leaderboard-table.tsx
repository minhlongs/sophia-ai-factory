import React from 'react';
import { Users } from 'lucide-react';
import type { LeaderboardEntry } from '@/seed/types/affiliate-expansion-types';
import { getTierBadge } from './types';

interface LeaderboardTableProps {
  isVi: boolean;
  locale: 'en' | 'vi';
  updatedAt: string;
  topAffiliates: LeaderboardEntry[];
}

export function LeaderboardTable({
  isVi,
  locale,
  updatedAt,
  topAffiliates,
}: LeaderboardTableProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white">
            {isVi ? 'Bảng Xếp Hạng Chi Tiết Top 10' : 'Detailed Top 10 Standings'}
          </h3>
        </div>
        <div className="text-xs text-slate-400">
          {isVi ? 'Cập nhật:' : 'Updated:'} {new Date(updatedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
              <th className="py-3.5 px-4 text-center w-16">{isVi ? 'Hạng' : 'Rank'}</th>
              <th className="py-3.5 px-4">{isVi ? 'Mã Đối Tác' : 'Partner Code'}</th>
              <th className="py-3.5 px-4">{isVi ? 'Cấp Bậc' : 'Tier'}</th>
              <th className="py-3.5 px-4 text-right">{isVi ? 'Doanh Số MRR' : 'Active MRR'}</th>
              <th className="py-3.5 px-4 text-right">{isVi ? 'Khách Hàng' : 'Conversions'}</th>
              <th className="py-3.5 px-4 text-right">{isVi ? 'Hoa Hồng Nhận' : 'Commission'}</th>
              <th className="py-3.5 px-4 text-right">{isVi ? 'Thưởng Thêm' : 'Cash Bonus'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {topAffiliates.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-500">
                  {isVi ? 'Chưa có dữ liệu xếp hạng trong kỳ này' : 'No rankings recorded for this period yet'}
                </td>
              </tr>
            ) : (
              topAffiliates.map((item) => {
                const badge = getTierBadge(item.tier, isVi);
                return (
                  <tr
                    key={item.partnerCode}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      item.rank === 1
                        ? 'bg-amber-500/5'
                        : item.rank === 2
                        ? 'bg-slate-500/5'
                        : item.rank === 3
                        ? 'bg-amber-900/5'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      {item.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                          1
                        </span>
                      ) : item.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-bold text-xs">
                          2
                        </span>
                      ) : item.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-bold text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">{item.rank}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{item.maskedCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                      ${item.monthlyMrrUsd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      {item.activeConversions}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                      ${item.commissionEarnedUsd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.bonusRewardUsd > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md text-xs">
                          +${item.bonusRewardUsd}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
