/**
 * @file types.ts
 * @description Types and configuration contracts for Cloudflare Stream client
 */

import type {
  CloudflareStreamVideoDetails,
  CloudflareStreamPlaybackUrls,
} from '@/seed/types/streaming';

export type { CloudflareStreamVideoDetails, CloudflareStreamPlaybackUrls };

export interface CloudflareStreamClientConfig {
  accountId?: string;
  apiToken?: string;
  customerSubdomain?: string;
}

export interface ThumbnailOptions {
  timeSec?: number;
  width?: number;
  height?: number;
}

export interface CloudflareStreamApiResponse {
  success: boolean;
  result: {
    uid: string;
    readyToStream: boolean;
    status?: {
      state: 'inprogress' | 'ready' | 'error' | 'downloading' | 'queued';
      pctComplete?: string;
      errorReasonCode?: string;
      errorReasonText?: string;
    };
    meta?: Record<string, string>;
    duration?: number;
    maxDurationSeconds?: number;
    thumbnail?: string;
    created?: string;
    modified?: string;
  };
}
