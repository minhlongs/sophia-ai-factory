'use client';

/**
 * @file channel-attribution-table.tsx
 * @description Channel attribution table with metrics for visitors, leads, paid, and MRR.
 * @layer forest
 */

import React from 'react';
import { Target, Video, Send, Search, Share2, Layers } from 'lucide-react';
import type { GrowthAnalyticsSummary } from '@/seed/types/solutions-types';

interface ChannelAttributionTableProps {
  channelAttribution: GrowthAnalyticsSummary['channelAttribution'];
  isVi: boolean;
}

export function ChannelAttributionTable({
  channelAttribution,
  isVi,
}: ChannelAttributionTableProps) {
  const getIcon = (channel: string) => {
    switch (channel) {
      case 'viral_videos':
        return <Video className="w-4 h-4 text-rose-400" />;
      case 'telegram_bot':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'programmatic_seo':
        return <Search className="w-4 h-4 text-emerald-400" />;
      case 'affiliate_partners':
        return <Share2 className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-400" />
          <h3 className="font-bold text-white text-base">
            {isVi ? 'Phân Bổ Kênh Thu Hút Doanh Thu' : 'Channel Attribution Breakdown'}
          </h3>
        </div>
        <span className="text-xs text-zinc-400">
          {isVi ? 'Nguồn gốc lưu lượng' : 'Acquisition Source'}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-800/50 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-700/60">
            <tr>
              <th className="py-3 px-3">{isVi ? 'Kênh tiếp cận' : 'Channel'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Lượt xem' : 'Visitors'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Leads' : 'Leads'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Trả phí' : 'Paid'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Tỉ lệ CR' : 'CR %'}</th>
              <th className="py-3 px-3 text-right">{isVi ? 'Đóng góp MRR' : 'MRR'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {channelAttribution.map((ch) => (
              <tr key={ch.channel} className="hover:bg-zinc-800/30 transition">
                <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                  {getIcon(ch.channel)}
                  <span>{isVi ? ch.channelLabelVi : ch.channelLabelEn}</span>
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-300">
                  {ch.visitors.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-300">
                  {ch.leads.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                  {ch.paid}
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-300">
                  {ch.conversionRatePct}%
                </td>
                <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                  ${ch.mrrContributionUsd.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
