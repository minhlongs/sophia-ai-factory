'use client';

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { ChannelCardData } from './channel-credentials-grid';

export const PLATFORM_META: Record<SocialPlatform, { title: string; badgeColor: string }> = {
  YOUTUBE_SHORTS: {
    title: 'YouTube Shorts',
    badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  TIKTOK_V2: {
    title: 'TikTok API v2',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  INSTAGRAM_REELS: {
    title: 'Instagram Reels',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
};

export function formatExpiryDays(expiresAt: number): string {
  const diffHours = Math.max(0, Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60)));
  if (diffHours <= 0) return 'Đã hết hạn / Expired';
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export function ChannelStatusBadge({ channel: ch }: { channel: ChannelCardData }) {
  if (ch.killSwitchActive) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/30">
        <AlertTriangle className="w-2.5 h-2.5" /> Khóa dừng / Locked
      </span>
    );
  }
  if (ch.status === 'HEALTHY') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
        <CheckCircle2 className="w-2.5 h-2.5" /> Hoạt động / Ready
      </span>
    );
  }
  if (ch.status === 'EXPIRING_SOON') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
        <Clock className="w-2.5 h-2.5" /> Sắp hết hạn
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
      Chưa kết nối / Off
    </span>
  );
}
