'use client';

/**
 * Dispatch form and default channel config for SocialPublisherCockpit.
 * @module components/social-publisher/social-publisher-dispatch-form
 */

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { ChannelCardData } from './channel-credentials-grid';
import { Send, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export const DEFAULT_SOCIAL_CHANNELS: ChannelCardData[] = [
  { platform: 'YOUTUBE_SHORTS', channelId: 'yt_channel_main', channelName: '@SophiaShorts', connected: true, status: 'HEALTHY', dailyPostsUsed: 3, dailyPostsMax: 10, tokenExpiresAt: Date.now() + 14 * 86400000, killSwitchActive: false },
  { platform: 'TIKTOK_V2', channelId: 'tt_channel_main', channelName: '@SophiaAIVideo', connected: true, status: 'HEALTHY', dailyPostsUsed: 5, dailyPostsMax: 8, tokenExpiresAt: Date.now() + 2 * 86400000, killSwitchActive: false },
  { platform: 'INSTAGRAM_REELS', channelId: 'ig_channel_main', channelName: '@sophia.aifactory', connected: true, status: 'HEALTHY', dailyPostsUsed: 2, dailyPostsMax: 12, tokenExpiresAt: Date.now() + 30 * 86400000, killSwitchActive: false },
];

export function SocialPublisherDispatchForm({
  title,
  setTitle,
  caption,
  setCaption,
  videoUrl,
  setVideoUrl,
  selectedPlatforms,
  togglePlatform,
  useJitter,
  setUseJitter,
  isSubmitting,
  alert,
  onSubmit,
}: {
  title: string;
  setTitle: (v: string) => void;
  caption: string;
  setCaption: (v: string) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  selectedPlatforms: SocialPlatform[];
  togglePlatform: (p: SocialPlatform) => void;
  useJitter: boolean;
  setUseJitter: (v: boolean) => void;
  isSubmitting: boolean;
  alert: { type: 'ok' | 'err'; text: string } | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="lg:col-span-7 space-y-4 p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-[#F59E0B]" /> Cấu Hình Bài Đăng / Dispatch Payload
      </h3>
      {alert && (
        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${alert.type === 'ok' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'}`}>
          {alert.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{alert.text}</span>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiêu đề video / Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: 3 Bí Quyết Tự Động Hóa Kênh Triệu View" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mô tả & Hashtags / Caption & Tags</label>
        <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="#ai #faceless #automation #growth #passiveincome" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL Video (R2 Storage or MP4 URL)</label>
        <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://pub-r2.agencyos.network/videos/render-916.mp4" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]" />
      </div>
      <div className="space-y-2 pt-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nền tảng phát tán / Target Platforms</label>
        <div className="flex flex-wrap gap-2">
          {(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS'] as const).map((p) => (
            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedPlatforms.includes(p) ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'}`}>
              {p === 'YOUTUBE_SHORTS' ? 'YouTube Shorts' : p === 'TIKTOK_V2' ? 'TikTok v2' : 'Instagram Reels'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Giãn cách ngẫu nhiên (Organic Jitter)</span>
          <p className="text-[11px] text-slate-500">Thêm độ trễ 3-15 phút ngẫu nhiên giữa các nền tảng để tránh spam flag.</p>
        </div>
        <input type="checkbox" checked={useJitter} onChange={(e) => setUseJitter(e.target.checked)} className="w-4 h-4 text-[#4F46E5] rounded accent-[#4F46E5]" />
      </div>
      <button type="submit" disabled={isSubmitting} className="w-full py-2.5 px-4 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60">
        <Send className="w-3.5 h-3.5" />
        <span>{isSubmitting ? 'Đang điều phối... / Pacing...' : 'Xuất Bản Ngẫu Nhiên (+3-15m) / Dispatch with Jitter'}</span>
      </button>
    </form>
  );
}
