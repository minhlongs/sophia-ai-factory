/**
 * Zod schemas and input/response types for Social Direct Publishing Server Actions.
 * @module land/social/actions/social-publisher-schemas
 */

import { z } from 'zod';

export const dispatchSocialPublishSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  videoUrl: z.string().url('Must be a valid video URL'),
  title: z.string().min(1, 'Title is required').max(150),
  description: z.string().max(2000).optional().default(''),
  tags: z.array(z.string()).optional(),
  totalSizeBytes: z.number().positive().optional(),
  scheduledFor: z.number().positive().optional(),
});

export const updateChannelCredentialsSchema = z.object({
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().min(1, 'Channel name is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.number().positive('Expiration timestamp must be positive'),
});

export type DispatchSocialPublishInput = z.input<typeof dispatchSocialPublishSchema>;
export type UpdateChannelCredentialsInput = z.input<typeof updateChannelCredentialsSchema>;

export interface SocialPublisherActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
