/**
 * Channel Credentials Grid Component
 * Displays multi-platform OAuth connection health, daily quotas,
 * token expiration countdowns, and per-channel emergency kill switches.
 *
 * Layer: UI Component | File size: < 140 LOC | Zero :any.
 * @module components/social-publisher/channel-credentials-grid
 */

'use client';

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { ChannelCredentialCard } from './channel-credential-card';

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

export function ChannelCredentialsGrid({
  channels,
  onToggleKillSwitch,
  onReconnect,
  isPending = false,
}: ChannelCredentialsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {channels.map((ch) => (
        <ChannelCredentialCard
          key={`${ch.platform}-${ch.channelId}`}
          channel={ch}
          onToggleKillSwitch={onToggleKillSwitch}
          onReconnect={onReconnect}
          isPending={isPending}
        />
      ))}
    </div>
  );
}
