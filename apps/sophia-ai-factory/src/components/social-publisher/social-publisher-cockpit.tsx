/**
 * Social Publisher Cockpit Component
 * Obsidian Cyber-Glass control center integrating dispatch form,
 * draft approval queue, anti-detection jitter pacing, 9:16 safe-zone player, and channel telemetry.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/social-publisher/social-publisher-cockpit
 */

'use client';

import React from 'react';
import { VerticalSafeZonePlayer } from './vertical-safe-zone-player';
import { ChannelCredentialsGrid, type ChannelCardData } from './channel-credentials-grid';
import { DraftApprovalQueue } from './draft-approval-queue';
import { SocialPublisherDispatchForm } from './social-publisher-dispatch-form';
import { SocialPublisherCockpitHeader } from './social-publisher-cockpit-header';
import { useSocialPublisherCockpitState } from './social-publisher-cockpit-state';
import { createCockpitHandlers } from './social-publisher-cockpit-handlers';
import type { SocialPublisherCockpitProps } from './social-publisher-types';
import type { SocialPublisherCockpitState } from './social-publisher-cockpit-state';

export function SocialPublisherCockpit({
  initialChannels,
  initialDrafts,
  onDispatch,
  onToggleKillSwitch,
  onApproveDraft,
  onRefreshDrafts,
}: SocialPublisherCockpitProps) {
  const state = useSocialPublisherCockpitState(initialChannels, initialDrafts);
  const handlers = createCockpitHandlers({
    state,
    onDispatch,
    onToggleKillSwitch,
    onApproveDraft,
    onRefreshDrafts,
  });

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <SocialPublisherCockpitHeader />

      <DraftApprovalQueue
        drafts={state.drafts}
        onApproveDraft={handlers.handleApproveDraft}
        onPreviewDraft={(d) => {
          state.setVideoUrl(d.videoUrl);
          state.setTitle(d.title);
          state.setCaption(d.description);
        }}
        onRefresh={onRefreshDrafts}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SocialPublisherDispatchForm
          title={state.title}
          setTitle={state.setTitle}
          caption={state.caption}
          setCaption={state.setCaption}
          videoUrl={state.videoUrl}
          setVideoUrl={state.setVideoUrl}
          selectedPlatforms={state.selectedPlatforms}
          togglePlatform={handlers.togglePlatform}
          useJitter={state.useJitter}
          setUseJitter={state.setUseJitter}
          isSubmitting={state.isSubmitting}
          alert={state.alert}
          onSubmit={handlers.handleSubmit}
        />

        <div className="lg:col-span-5 flex flex-col items-center p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <VerticalSafeZonePlayer
            videoUrl={state.videoUrl}
            activePlatform={state.activePlatform}
            onPlatformChange={state.setActivePlatform}
            title={state.title}
            caption={state.caption}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kênh Đã Liên Kết & Trạng Thái Hạn Ngạch / Channels & Quota</h3>
        <ChannelCredentialsGrid channels={state.channels} onToggleKillSwitch={handlers.handleKillSwitch} />
      </div>
    </div>
  );
}