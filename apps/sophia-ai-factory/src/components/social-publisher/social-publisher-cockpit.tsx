/**
 * Social Publisher Cockpit Component
 * Obsidian Cyber-Glass control center integrating dispatch form,
 * anti-detection jitter pacing, 9:16 safe-zone player, and channel credential telemetry.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/social-publisher/social-publisher-cockpit
 */

'use client';

import React, { useState } from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { VerticalSafeZonePlayer } from './vertical-safe-zone-player';
import { ChannelCredentialsGrid, type ChannelCardData } from './channel-credentials-grid';
import { Send, Zap, Shield, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export interface PublishFormPayload {
  title: string;
  caption: string;
  videoUrl: string;
  platforms: SocialPlatform[];
  useJitter: boolean;
}

export interface SocialPublisherCockpitProps {
  initialChannels?: ChannelCardData[];
  onDispatch?: (payload: PublishFormPayload) => Promise<{ ok: boolean; message: string }>;
  onToggleKillSwitch?: (channelId: string, current: boolean) => Promise<boolean>;
}

const DEFAULT_CHANNELS: ChannelCardData[] = [
  { platform: 'YOUTUBE_SHORTS', channelId: 'yt_channel_main', channelName: '@SophiaShorts', connected: true, status: 'HEALTHY', dailyPostsUsed: 3, dailyPostsMax: 10, tokenExpiresAt: Date.now() + 14 * 86400000, killSwitchActive: false },
  { platform: 'TIKTOK_V2', channelId: 'tt_channel_main', channelName: '@SophiaAIVideo', connected: true, status: 'HEALTHY', dailyPostsUsed: 5, dailyPostsMax: 8, tokenExpiresAt: Date.now() + 2 * 86400000, killSwitchActive: false },
  { platform: 'INSTAGRAM_REELS', channelId: 'ig_channel_main', channelName: '@sophia.aifactory', connected: true, status: 'HEALTHY', dailyPostsUsed: 2, dailyPostsMax: 12, tokenExpiresAt: Date.now() + 30 * 86400000, killSwitchActive: false },
];

export function SocialPublisherCockpit({ initialChannels = DEFAULT_CHANNELS, onDispatch, onToggleKillSwitch }: SocialPublisherCockpitProps) {
  const [channels, setChannels] = useState<ChannelCardData[]>(initialChannels);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('TIKTOK_V2');
  const [useJitter, setUseJitter] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
    setActivePlatform(p);
  };

  const handleKillSwitch = async (channelId: string, current: boolean) => {
    const nextVal = !current;
    setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, killSwitchActive: nextVal } : c)));
    if (onToggleKillSwitch) {
      const ok = await onToggleKillSwitch(channelId, current);
      if (!ok) {
        setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, killSwitchActive: current } : c)));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setAlert({ type: 'err', text: 'Vui lòng nhập tiêu đề video / Title required' });
    if (selectedPlatforms.length === 0) return setAlert({ type: 'err', text: 'Chọn ít nhất 1 nền tảng / Select at least 1 platform' });

    setIsSubmitting(true);
    setAlert(null);
    try {
      const res = onDispatch ? await onDispatch({ title, caption, videoUrl, platforms: selectedPlatforms, useJitter }) : { ok: true, message: 'Đã lên lịch xuất bản kèm giãn cách ngẫu nhiên / Dispatched with jitter' };
      setAlert({ type: res.ok ? 'ok' : 'err', text: res.message });
      if (res.ok) { setTitle(''); setCaption(''); }
    } catch (err) {
      setAlert({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi xuất bản / Publish failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Top Banner: Obsidian Cyber-Glass Navigation & System Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 gap-3 shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/20 uppercase">Direct Publisher</span>
            <span className="flex items-center gap-1 text-[11px] text-[#10B981] font-semibold"><Zap className="w-3 h-3" /> Pacing Engine Active</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Xuất Bản Đa Kênh Trực Tiếp</h2>
          <p className="text-xs text-slate-500">Autonomous anti-detection distribution with organic jitter pacing.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">OCC Lock: v1.4</span>
          <span className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold flex items-center gap-1"><Shield className="w-3 h-3" /> Anti-Detection</span>
        </div>
      </div>

      {/* Main Cockpit Split: Dispatch Form (Left) vs 9:16 Safe-Zone Player (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4 p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[#F59E0B]" /> Cấu Hình Bài Đăng / Dispatch Payload</h3>

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

        <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <VerticalSafeZonePlayer videoUrl={videoUrl} activePlatform={activePlatform} onPlatformChange={setActivePlatform} title={title} caption={caption} />
        </div>
      </div>

      {/* Bottom Section: Channel OAuth Credential Health Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kênh Đã Liên Kết & Trạng Thái Hạn Ngạch / Channels & Quota</h3>
        <ChannelCredentialsGrid channels={channels} onToggleKillSwitch={handleKillSwitch} />
      </div>
    </div>
  );
}
