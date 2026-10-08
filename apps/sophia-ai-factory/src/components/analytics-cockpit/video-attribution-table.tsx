/**
 * Video Attribution Table Component
 * Multi-platform performance, cost attribution, and net ROI table.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/analytics-cockpit/video-attribution-table
 */

'use client';

import React, { useState } from 'react';
import type { VideoAnalyticsSnapshot } from '@/seed/types/video-analytics-types';
import { ExternalLink, RefreshCw, Flame, Video, Youtube } from 'lucide-react';

interface VideoAttributionTableProps {
  snapshots: VideoAnalyticsSnapshot[];
  onSyncVideo?: (jobId: string) => Promise<void>;
}

export function VideoAttributionTable({ snapshots, onSyncVideo }: VideoAttributionTableProps) {
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const filtered = snapshots.filter((s) => {
    if (filterPlatform === 'ALL') return true;
    return s.platform === filterPlatform;
  });

  const handleSync = async (jobId: string) => {
    if (!onSyncVideo) return;
    setSyncingId(jobId);
    try {
      await onSyncVideo(jobId);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Hiệu Suất Video & Net ROI / Video Attribution Ledger</h3>
          <p className="text-xs text-white/50">Chi phí MCU + BYOK so với Doanh thu Affiliate thực tế</p>
        </div>

        {/* Platform Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10">
          {['ALL', 'YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS'].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPlatform(p)}
              className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                filterPlatform === p
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {p === 'ALL' ? 'Tất cả' : p === 'YOUTUBE_SHORTS' ? 'YouTube' : p === 'TIKTOK_V2' ? 'TikTok' : 'Reels'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-white/70">
          <thead className="bg-white/[0.03] text-white/40 uppercase font-mono text-[10px] border-b border-white/10">
            <tr>
              <th className="py-2.5 px-3">Video / Job</th>
              <th className="py-2.5 px-3">Nền Tảng</th>
              <th className="py-2.5 px-3 text-right">Lượt Xem</th>
              <th className="py-2.5 px-3 text-center">Hook (3s)</th>
              <th className="py-2.5 px-3 text-center">Retention</th>
              <th className="py-2.5 px-3 text-right">Chi Phí</th>
              <th className="py-2.5 px-3 text-right">Doanh Thu</th>
              <th className="py-2.5 px-3 text-right">Net ROI</th>
              <th className="py-2.5 px-3 text-center">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-sans">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-white/40">
                  Chưa có dữ liệu analytics được ghi nhận.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isProfitable = item.netRoiUsd >= 0;
                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
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
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isProfitable ? `+$${item.netRoiUsd.toFixed(2)}` : `-$${Math.abs(item.netRoiUsd).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleSync(item.jobId)}
                        disabled={syncingId === item.jobId}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-40"
                        title="Đồng bộ chỉ số tức thì"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === item.jobId ? 'animate-spin text-amber-400' : ''}`} />
                      </button>
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
