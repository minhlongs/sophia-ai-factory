'use client';

/**
 * @file lead-stream-feed.tsx
 * @description Real-time inbound lead feed component.
 * @layer forest
 */

import React from 'react';
import { Clock } from 'lucide-react';
import type { RecentGrowthLeadItem } from '@/seed/types/solutions-types';

interface LeadStreamFeedProps {
  filteredLeads: RecentGrowthLeadItem[];
  isVi: boolean;
}

export function LeadStreamFeed({ filteredLeads, isVi }: LeadStreamFeedProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'converted':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'checkout_opened':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'demo_sent':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'qualified':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-700/30 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              {isVi ? 'Dòng Khách Hàng Tiềm Năng Mới' : 'Recent Inbound Leads'}
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
            Live Feed
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {isVi ? 'Không có khách hàng nào trong bộ lọc này.' : 'No leads matching active filter.'}
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 flex items-center justify-between hover:border-zinc-700 transition text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold text-xs border border-zinc-700/50">
                    {lead.nameOrChat.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-white truncate max-w-[140px] sm:max-w-[180px]">
                      {lead.nameOrChat}
                    </div>
                    <div className="text-[11px] text-zinc-400 capitalize">
                      {lead.niche} • {lead.source.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize ${getStatusBadge(lead.status)}`}>
                    {lead.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Score: {lead.score}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-zinc-800/60 text-center">
        <span className="text-[11px] text-zinc-500">
          {isVi ? 'Tự động đồng bộ từ Telegram Bot & D1 Database' : 'Synced live from Telegram Bot & D1'}
        </span>
      </div>
    </div>
  );
}
