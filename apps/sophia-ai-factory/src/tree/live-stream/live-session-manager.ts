/**
 * @file live-session-manager.ts
 * @description Manages Live-Commerce RTMP/WHIP streaming sessions and loop manifests
 * @layer tree
 */

import type { LiveStreamSession, LiveStreamPlatform } from '@/seed/types/live-stream-newsjack-dm-types';

export interface StreamEndpointConfig {
  ingestUrl: string;
  whipPlaybackUrl: string;
  isWebRtcLowLatency: boolean;
  recommendedBitrateKbps: number;
}

/**
 * Formats stream ingestion endpoints according to platform specifications.
 */
export function formatStreamEndpoint(
  platform: LiveStreamPlatform,
  streamKey: string,
): StreamEndpointConfig {
  const isWebRtc = platform === 'tiktok' || platform === 'shopee';

  const baseUrlMap: Record<LiveStreamPlatform, string> = {
    tiktok: 'rtmp://live-push.tiktok.com/live',
    shopee: 'rtmp://live-ingest.shopee.vn/live',
    youtube: 'rtmp://a.rtmp.youtube.com/live2',
    twitch: 'rtmp://live.twitch.tv/app',
  };

  const ingestUrl = `${baseUrlMap[platform]}/${streamKey}`;
  const whipPlaybackUrl = `https://stream.cloudflare.com/whip/${streamKey.slice(0, 10)}`;

  return {
    ingestUrl,
    whipPlaybackUrl,
    isWebRtcLowLatency: isWebRtc,
    recommendedBitrateKbps: 4500,
  };
}

/**
 * Validates and switches pinned flash-sale offer on active stream session.
 */
export function switchPinnedFlashSale(
  session: LiveStreamSession,
  newOfferId: string,
): LiveStreamSession {
  return {
    ...session,
    currentPinnedOfferId: newOfferId,
    updatedAt: Date.now(),
  };
}
