/**
 * Viral Funnel Performance Table
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/funnel-table
 */

import React from 'react';
import { Video, Copy, Check, Share2, Flame } from 'lucide-react';
import type { ViralVideoFunnelItem } from '@/seed/types/growth';
import { buildFunnelTrackingUrl, buildTelegramDeepLink } from '@/forest/publishing/viral-distributor';
import { getNicheBadge, getPlatformBadge } from './funnel-badges';

interface FunnelTableProps {
  items: ViralVideoFunnelItem[];
  isVi: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => Promise<void>;
}

export function FunnelTable({
  items,
  isVi,
  copiedKey,
  copyToClipboard,
}: FunnelTableProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-300">
          <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Video & Tiêu Đề' : 'Video & Title'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Lĩnh Vực' : 'Niche'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Nền Tảng' : 'Platform'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Loại Hook' : 'Hook Type'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Lượt Xem' : 'Views'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Clicks CTA' : 'Clicks'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Tỷ Lệ CTR' : 'CTR %'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Leads' : 'Leads'}</th>
              <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Trạng Thái' : 'Status'}</th>
              <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Hành Động' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                  {isVi ? 'Không tìm thấy video nào phù hợp.' : 'No videos found matching filters.'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const trackingUrl = buildFunnelTrackingUrl({
                  platform: item.platform === 'all' ? 'tiktok' : item.platform,
                  niche: item.niche,
                  hookArchetype: item.hookArchetype,
                  videoId: item.videoId,
                });
                const deepLink = buildTelegramDeepLink({
                  videoId: item.videoId,
                  platform: item.platform === 'all' ? 'tiktok' : item.platform,
                  niche: item.niche,
                });

                return (
                  <tr
                    key={item.videoId}
                    className="hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-white flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 text-neutral-400 border border-neutral-700">
                        <Video className="w-4 h-4" />
                      </div>
                      <span className="truncate max-w-[180px] sm:max-w-[240px]">
                        {item.videoTitle}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getNicheBadge(item.niche, isVi)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getPlatformBadge(item.platform)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-neutral-400">
                      {item.hookArchetype.replace('_', ' ')}
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap">
                      {item.views.toLocaleString()}
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap text-blue-400">
                      {item.ctaClicks.toLocaleString()}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          item.ctrPct >= 5.0
                            ? 'text-emerald-400'
                            : item.ctrPct >= 3.0
                              ? 'text-blue-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {item.ctrPct}%
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-semibold text-purple-400 whitespace-nowrap">
                      {item.leadsCount}
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {item.status === 'viral' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Flame className="w-3 h-3 text-emerald-400" /> Viral
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          title={isVi ? 'Sao chép link UTM tracking' : 'Copy UTM tracking link'}
                          onClick={() => copyToClipboard(trackingUrl, `utm_${item.videoId}`)}
                          className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                        >
                          {copiedKey === `utm_${item.videoId}` ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          title={isVi ? 'Sao chép deep link Telegram' : 'Copy Telegram deep link'}
                          onClick={() => copyToClipboard(deepLink, `tg_${item.videoId}`)}
                          className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-sky-400 transition-colors"
                        >
                          {copiedKey === `tg_${item.videoId}` ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
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
