/**
 * Channel Credential Card Subcomponent
 * Renders an individual social platform channel card with health badge,
 * daily quota meter, OAuth expiry countdown, and emergency kill switch.
 */

'use client';

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import type { ChannelCardData } from './channel-credentials-grid';
import {
  PLATFORM_META,
  formatExpiryDays,
  ChannelStatusBadge,
} from './channel-credential-helpers';

export { PLATFORM_META, formatExpiryDays, ChannelStatusBadge };

export interface ChannelCredentialCardProps {
  channel: ChannelCardData;
  onToggleKillSwitch?: (channelId: string, currentActive: boolean) => void;
  onReconnect?: (platform: SocialPlatform) => void;
  isPending?: boolean;
}

export function ChannelCredentialCard({
  channel: ch,
  onToggleKillSwitch,
  onReconnect,
  isPending = false,
}: ChannelCredentialCardProps) {
  const meta = PLATFORM_META[ch.platform];
  const quotaPct = Math.min(100, Math.round((ch.dailyPostsUsed / Math.max(1, ch.dailyPostsMax)) * 100));

  return (
    <div className="flex flex-col justify-between p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all hover:border-indigo-500/40">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${meta.badgeColor}`}>
            {meta.title}
          </span>
          <ChannelStatusBadge channel={ch} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {ch.channelName || 'Chưa liên kết / Not configured'}
          </h4>
          <p className="text-[11px] text-slate-500 font-mono truncate">ID: {ch.channelId}</p>
        </div>
      </div>

      <div className="my-4 space-y-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium text-[11px]">
            <span>Hạn ngạch ngày (Daily Quota)</span>
            <span className="font-mono text-slate-900 dark:text-slate-200">
              {ch.dailyPostsUsed} / {ch.dailyPostsMax}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                quotaPct > 80 ? 'bg-[#F59E0B]' : 'bg-[#4F46E5]'
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Hạn OAuth (Token Expiry):</span>
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-300">
            {ch.connected ? formatExpiryDays(ch.tokenExpiresAt) : 'N/A'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onReconnect?.(ch.platform)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Làm mới / Auth</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onToggleKillSwitch?.(ch.channelId, ch.killSwitchActive)}
          className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
            ch.killSwitchActive
              ? 'bg-[#F43F5E] text-white border-[#F43F5E] hover:bg-[#F43F5E]/90'
              : 'bg-white dark:bg-slate-900 text-[#F43F5E] border-[#F43F5E]/40 hover:bg-[#F43F5E]/10'
          }`}
          title="Khóa dừng phát tán kênh này (Emergency Stop for this channel)"
        >
          <ShieldAlert className="w-3 h-3" />
          <span>{ch.killSwitchActive ? 'Bật lại / Unlock' : 'Dừng / Lock'}</span>
        </button>
      </div>
    </div>
  );
}
