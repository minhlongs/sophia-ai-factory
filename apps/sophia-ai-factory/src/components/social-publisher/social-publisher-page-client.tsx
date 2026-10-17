'use client';

/**
 * Social Publisher Page Client Container
 * Wires server actions to the Obsidian Cyber-Glass Cockpit component.
 * Layer: components/social-publisher | File size: < 100 LOC | Zero :any.
 * @module components/social-publisher/social-publisher-page-client
 */

import React, { useState } from 'react';
import {
  SocialPublisherCockpit,
  type PublishFormPayload,
} from './social-publisher-cockpit';
import type { ChannelCardData } from './channel-credentials-grid';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import {
  dispatchSocialPublishAction,
  toggleChannelKillSwitchAction,
  approveDraftAction,
  listUserDraftsAction,
} from '@/app/actions/social-publisher-actions';

interface SocialPublisherPageClientProps {
  initialChannels: ChannelCardData[];
  initialDrafts: StoredPublishJob[];
}

export function SocialPublisherPageClient({
  initialChannels,
  initialDrafts,
}: SocialPublisherPageClientProps) {
  const [drafts, setDrafts] = useState<StoredPublishJob[]>(initialDrafts);

  const handleDispatch = async (payload: PublishFormPayload) => {
    return await dispatchSocialPublishAction(payload);
  };

  const handleToggleKillSwitch = async (channelId: string, current: boolean) => {
    return await toggleChannelKillSwitchAction(channelId, current);
  };

  const handleApproveDraft = async (jobId: string) => {
    const ok = await approveDraftAction(jobId);
    if (ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== jobId));
    }
    return ok;
  };

  const handleRefreshDrafts = async () => {
    const freshDrafts = await listUserDraftsAction();
    setDrafts(freshDrafts);
  };

  return (
    <SocialPublisherCockpit
      initialChannels={initialChannels}
      initialDrafts={drafts}
      onDispatch={handleDispatch}
      onToggleKillSwitch={handleToggleKillSwitch}
      onApproveDraft={handleApproveDraft}
      onRefreshDrafts={handleRefreshDrafts}
    />
  );
}
