'use client';

/**
 * Event handlers for SocialPublisherCockpit.
 * Layer: components/social-publisher
 * @module components/social-publisher/social-publisher-cockpit-handlers
 */

import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import type { ChannelCardData } from './channel-credentials-grid';
import type { PublishFormPayload, SocialPublisherCockpitProps } from './social-publisher-types';
import type { SocialPublisherCockpitState } from './social-publisher-cockpit-state';

type HandlerProps = {
  state: SocialPublisherCockpitState;
  onDispatch?: SocialPublisherCockpitProps['onDispatch'];
  onToggleKillSwitch?: SocialPublisherCockpitProps['onToggleKillSwitch'];
  onApproveDraft?: SocialPublisherCockpitProps['onApproveDraft'];
  onRefreshDrafts?: SocialPublisherCockpitProps['onRefreshDrafts'];
};

export function createCockpitHandlers({
  state,
  onDispatch,
  onToggleKillSwitch,
  onApproveDraft,
  onRefreshDrafts,
}: HandlerProps) {
  const togglePlatform = (p: SocialPlatform) => {
    state.setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
    state.setActivePlatform(p);
  };

  const handleKillSwitch = async (channelId: string, current: boolean) => {
    const nextVal = !current;
    state.setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, killSwitchActive: nextVal } : c)));
    if (onToggleKillSwitch) {
      const ok = await onToggleKillSwitch(channelId, current);
      if (!ok) state.setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, killSwitchActive: current } : c)));
    }
  };

  const handleApproveDraft = async (jobId: string): Promise<boolean> => {
    if (onApproveDraft) {
      const ok = await onApproveDraft(jobId);
      if (ok) state.setDrafts((prev) => prev.filter((d) => d.id !== jobId));
      return ok;
    }
    state.setDrafts((prev) => prev.filter((d) => d.id !== jobId));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.title.trim()) return state.setAlert({ type: 'err', text: 'Vui lòng nhập tiêu đề video / Title required' });
    if (state.selectedPlatforms.length === 0) return state.setAlert({ type: 'err', text: 'Chọn ít nhất 1 nền tảng / Select at least 1 platform' });
    state.setIsSubmitting(true);
    state.setAlert(null);
    try {
      const res = onDispatch
        ? await onDispatch({ title: state.title, caption: state.caption, videoUrl: state.videoUrl, platforms: state.selectedPlatforms, useJitter: state.useJitter })
        : { ok: true, message: 'Đã lên lịch xuất bản kèm giãn cách ngẫu nhiên / Dispatched with jitter' };
      state.setAlert({ type: res.ok ? 'ok' : 'err', text: res.message });
      if (res.ok) { state.setTitle(''); state.setCaption(''); }
    } catch (err) {
      state.setAlert({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi xuất bản / Publish failed' });
    } finally {
      state.setIsSubmitting(false);
    }
  };

  return { togglePlatform, handleKillSwitch, handleApproveDraft, handleSubmit };
}