/**
 * Video Publishing Service Types
 * Layer: land/video/publishing
 */

export type VideoPublishInput = {
  videoId: string;
  videoUrl: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  title: string;
  description: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
};

export type VideoPublishResult =
  | { success: true; publishId: string }
  | { success: false; error: string; code: string };

export type VideoRetryResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code: string };

export interface SchedulePublishInput {
  userId: string;
  videoId: string;
  channelId: string;
  scheduledAt: number; // unix seconds
  caption?: string;
  hashtags?: string[];
  productLink?: string;
  tenantId?: string;
  provider?: string;
}

export interface SchedulePublishResult {
  jobId: string;
  scheduledAt: number;
  status: 'scheduled';
  deferredUntil?: number;
  deferReason?: 'cooldown' | 'burst';
}

export class PublishConfigurationError extends Error {
  code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT';
  constructor(
    code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
    this.name = 'PublishConfigurationError';
    this.code = code;
  }
}
