'use client';

/**
 * State hook for SocialPublisherCockpit.
 * Layer: components/social-publisher
 * @module components/social-publisher/social-publisher-cockpit-state
 */

import { useState } from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import type { ChannelCardData } from './channel-credentials-grid';
import { DEFAULT_SOCIAL_CHANNELS } from './social-publisher-dispatch-form';

export interface SocialPublisherCockpitState {
  channels: ChannelCardData[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelCardData[]>>;
  drafts: StoredPublishJob[];
  setDrafts: React.Dispatch<React.SetStateAction<StoredPublishJob[]>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  caption: string;
  setCaption: React.Dispatch<React.SetStateAction<string>>;
  videoUrl: string;
  setVideoUrl: React.Dispatch<React.SetStateAction<string>>;
  selectedPlatforms: SocialPlatform[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<SocialPlatform[]>>;
  activePlatform: SocialPlatform;
  setActivePlatform: React.Dispatch<React.SetStateAction<SocialPlatform>>;
  useJitter: boolean;
  setUseJitter: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  alert: { type: 'ok' | 'err'; text: string } | null;
  setAlert: React.Dispatch<React.SetStateAction<{ type: 'ok' | 'err'; text: string } | null>>;
}

export function useSocialPublisherCockpitState(initialChannels?: ChannelCardData[], initialDrafts?: StoredPublishJob[]): SocialPublisherCockpitState {
  const [channels, setChannels] = useState<ChannelCardData[]>(initialChannels ?? DEFAULT_SOCIAL_CHANNELS);
  const [drafts, setDrafts] = useState<StoredPublishJob[]>(initialDrafts ?? []);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('TIKTOK_V2');
  const [useJitter, setUseJitter] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  return {
    channels, setChannels,
    drafts, setDrafts,
    title, setTitle,
    caption, setCaption,
    videoUrl, setVideoUrl,
    selectedPlatforms, setSelectedPlatforms,
    activePlatform, setActivePlatform,
    useJitter, setUseJitter,
    isSubmitting, setIsSubmitting,
    alert, setAlert,
  };
}