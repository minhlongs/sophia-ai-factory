/**
 * Channel Credentials Grid Component
 * Displays multi-platform OAuth connection health, daily quotas,
 * token expiration countdowns, and per-channel emergency kill switches.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/social-publisher/channel-credentials-grid
 */

'use client';

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { ShieldAlert, RefreshCw, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export type ChannelHealthStatus = 'HEALTHY' | 'EXPIRING_SOON' | 'KILL_SWITCH_ACTIVE' | 'DISCONNECTED';

export interface ChannelCardData {
  platform: SocialPlatform;
  channelId: string;
  channelName: string;
  connected: boolean;
  status: ChannelHealthStatus;
  dailyPostsUsed: number;
  dailyPostsMax: number;
  tokenExpiresAt: number;
  killSwitchActive: boolean;
}

export interface ChannelCredentialsGridProps {
  channels: ChannelCardData[];
  onToggleKillSwitch?: (channelId: string, currentActive: boolean) => void;
  onReconnect?: (platform: SocialPlatform) => void;
  isPending?: boolean;
}

const PLATFORM_META: Record<SocialPlatform, { title: string; badgeColor: string }> = {
  YOUTUBE_SHORTS: { title: 'YouTube Shorts', badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  TIKTOK_V2: { title: 'TikTok API v2', badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  INSTAGRAM_REELS: { title: 'Instagram Reels', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
};

function formatExpiryDays(expiresAt: number): string {
  const diffHours = Math.max(0, Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60)));
  if (diffHours <= 0) return 'Đã hết hạn / Expired';
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export function ChannelCredentialsGrid({
  channels,
  onToggleKillSwitch,
  onReconnect,
  isPending = false,
}: ChannelCredentialsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {channels.map((ch) => {
        const meta = PLATFORM_META[ch.platform];
        const quotaPct = Math.min(100, Math.round((ch.dailyPostsUsed / Math.max(1, ch.dailyPostsMax)) * 100));

        return (
          <div
            key={`${ch.platform}-${ch.channelId}`}
            className="flex flex-col justify-between p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all hover:border-indigo-500/40"
          >
            {/* Header: Platform & Health Status Badge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${meta.badgeColor}`}>
                  {meta.title}
                </span>

                {ch.killSwitchActive ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/30">
                    <AlertTriangle className="w-2.5 h-2.5" /> Khóa dừng / Locked
                  </span>
                ) : ch.status === 'HEALTHY' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Hoạt động / Ready
                  </span>
                ) : ch.status === 'EXPIRING_SOON' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                    <Clock className="w-2.5 h-2.5" /> Sắp hết hạn
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Chưa kết nối / Off
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {ch.channelName || 'Chưa liên kết / Not configured'}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono truncate">ID: {ch.channelId}</p>
              </div>
            </div>

            {/* Quota & Token Expiration Telemetry */}
            <div className="my-4 space-y-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
              {/* Daily Quota Meter */}
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

              {/* Expiry Countdown */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Hạn OAuth (Token Expiry):</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-300">
                  {ch.connected ? formatExpiryDays(ch.tokenExpiresAt) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Actions: Reconnect & Emergency Kill Switch Toggle */}
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
      })}
    </div>
  );
}
