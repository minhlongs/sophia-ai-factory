'use client';

import React from 'react';
import type { VideoAnalyticsSnapshot } from '@/seed/types/video-analytics-types';
import { RefreshCw, Flame } from 'lucide-react';

export interface VideoAttributionTableRowProps {
  item: VideoAnalyticsSnapshot;
  syncingId: string | null;
  onSync: (jobId: string) => void;
}

export function VideoAttributionTableRow({
  item,
  syncingId,
  onSync,
}: VideoAttributionTableRowProps) {
  const isProfitable = item.netRoiUsd >= 0;

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-3 font-medium text-white max-w-[200px] truncate">
        {item.title || item.jobId}
      </td>
      <td className="py-3 px-3 font-mono text-[11px] text-white/60">
        {item.platform}
      </td>
      <td className="py-3 px-3 text-right font-mono">
        {item.views.toLocaleString()}
      </td>
      <td className="py-3 px-3 text-center">
        <span className="inline-flex items-center gap-1 font-mono text-amber-400 font-semibold">
          <Flame className="w-3 h-3" /> {item.hookScore}
        </span>
      </td>
      <td className="py-3 px-3 text-center font-mono text-indigo-400">
        {item.retentionScore}
      </td>
      <td className="py-3 px-3 text-right font-mono text-white/50">
        ${item.costUsd.toFixed(2)}
      </td>
      <td className="py-3 px-3 text-right font-mono text-emerald-400">
        ${item.revenueUsd.toFixed(2)}
      </td>
      <td
        className={`py-3 px-3 text-right font-mono font-semibold ${
          isProfitable ? 'text-emerald-400' : 'text-rose-400'
        }`}
      >
        {isProfitable ? `+$${item.netRoiUsd.toFixed(2)}` : `-$${Math.abs(item.netRoiUsd).toFixed(2)}`}
      </td>
      <td className="py-3 px-3 text-center">
        <button
          onClick={() => onSync(item.jobId)}
          disabled={syncingId === item.jobId}
          className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-40"
          title="Đồng bộ chỉ số tức thì"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === item.jobId ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </td>
    </tr>
  );
}
