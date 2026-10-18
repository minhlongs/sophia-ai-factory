/**
 * Social Publisher Cockpit Component
 * Obsidian Cyber-Glass control center integrating dispatch form,
 * draft approval queue, anti-detection jitter pacing, 9:16 safe-zone player, and channel telemetry.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/social-publisher/social-publisher-cockpit
 */

'use client';

import React, { useState } from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import { VerticalSafeZonePlayer } from './vertical-safe-zone-player';
import { ChannelCredentialsGrid, type ChannelCardData } from './channel-credentials-grid';
import { DraftApprovalQueue } from './draft-approval-queue';
import {
  DEFAULT_SOCIAL_CHANNELS,
  SocialPublisherDispatchForm,
} from './social-publisher-dispatch-form';
import { SocialPublisherCockpitHeader } from './social-publisher-cockpit-header';

export interface PublishFormPayload {
  title: string;
  caption: string;
  videoUrl: string;
  platforms: SocialPlatform[];
  useJitter: boolean;
}

export interface SocialPublisherCockpitProps {
  initialChannels?: ChannelCardData[];
  initialDrafts?: StoredPublishJob[];
  onDispatch?: (payload: PublishFormPayload) => Promise<{ ok: boolean; message: string }>;
  onToggleKillSwitch?: (channelId: string, current: boolean) => Promise<boolean>;
  onApproveDraft?: (jobId: string) => Promise<boolean>;
  onRefreshDrafts?: () => Promise<void>;
}

export function SocialPublisherCockpit({
  initialChannels = DEFAULT_SOCIAL_CHANNELS,
  initialDrafts = [],
  onDispatch,
  onToggleKillSwitch,
  onApproveDraft,
  onRefreshDrafts,
}: SocialPublisherCockpitProps) {
  const [channels, setChannels] = useState<ChannelCardData[]>(initialChannels);
  const [drafts, setDrafts] = useState<StoredPublishJob[]>(initialDrafts);
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
      if (!ok) setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, killSwitchActive: current } : c)));
    }
  };

  const handleApproveDraft = async (jobId: string): Promise<boolean> => {
    if (onApproveDraft) {
      const ok = await onApproveDraft(jobId);
      if (ok) setDrafts((prev) => prev.filter((d) => d.id !== jobId));
      return ok;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== jobId));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setAlert({ type: 'err', text: 'Vui lòng nhập tiêu đề video / Title required' });
    if (selectedPlatforms.length === 0) return setAlert({ type: 'err', text: 'Chọn ít nhất 1 nền tảng / Select at least 1 platform' });
    setIsSubmitting(true);
    setAlert(null);
    try {
      const res = onDispatch
        ? await onDispatch({ title, caption, videoUrl, platforms: selectedPlatforms, useJitter })
        : { ok: true, message: 'Đã lên lịch xuất bản kèm giãn cách ngẫu nhiên / Dispatched with jitter' };
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
      <SocialPublisherCockpitHeader />

      <DraftApprovalQueue
        drafts={drafts} onApproveDraft={handleApproveDraft}
        onPreviewDraft={(d) => { setVideoUrl(d.videoUrl); setTitle(d.title); setCaption(d.description); }}
        onRefresh={onRefreshDrafts}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SocialPublisherDispatchForm
          title={title} setTitle={setTitle} caption={caption} setCaption={setCaption}
          videoUrl={videoUrl} setVideoUrl={setVideoUrl} selectedPlatforms={selectedPlatforms}
          togglePlatform={togglePlatform} useJitter={useJitter} setUseJitter={setUseJitter}
          isSubmitting={isSubmitting} alert={alert} onSubmit={handleSubmit}
        />

        <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <VerticalSafeZonePlayer videoUrl={videoUrl} activePlatform={activePlatform} onPlatformChange={setActivePlatform} title={title} caption={caption} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kênh Đã Liên Kết & Trạng Thái Hạn Ngạch / Channels & Quota</h3>
        <ChannelCredentialsGrid channels={channels} onToggleKillSwitch={handleKillSwitch} />
      </div>
    </div>
  );
}
