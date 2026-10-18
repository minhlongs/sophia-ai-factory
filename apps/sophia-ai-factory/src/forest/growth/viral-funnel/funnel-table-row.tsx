/**
 * Viral Funnel Table Row Component
 *
 * Layer: Forest (UI components & coordinators)
 *
 * @module forest/growth/viral-funnel/funnel-table-row
 */

import React from 'react';
import { Video, Copy, Check, Share2, Flame } from 'lucide-react';
import type { ViralVideoFunnelItem } from '@/seed/types/growth';
import { buildFunnelTrackingUrl, buildTelegramDeepLink } from '@/forest/publishing/viral-distributor';
import { getNicheBadge, getPlatformBadge } from './funnel-badges';

export interface FunnelTableRowProps {
  item: ViralVideoFunnelItem;
  isVi: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => Promise<void>;
}

export function FunnelTableRow({
  item,
  isVi,
  copiedKey,
  copyToClipboard,
}: FunnelTableRowProps) {
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
    <tr className="hover:bg-neutral-800/40 transition-colors">
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
}
