/**
 * Shared types for Social Publisher Cockpit.
 * Layer: components/social-publisher
 * @module components/social-publisher/social-publisher-types
 */

import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import type { ChannelCardData } from './channel-credentials-grid';

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