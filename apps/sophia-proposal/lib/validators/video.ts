/**
 * Video Validators
 *
 * Zod schemas for video generation request/response validation
 */

import { z } from "zod";

/**
 * Video type enum
 */
export const videoTypeEnum = z.enum([
  "intro",
  "section",
  "full_proposal",
  "custom",
]);

export type VideoType = z.infer<typeof videoTypeEnum>;

/**
 * Video status enum
 */
export const videoStatusEnum = z.enum([
  "pending",
  "processing",
  "ready",
  "failed",
]);

export type VideoStatus = z.infer<typeof videoStatusEnum>;

/**
 * Generate video request schema
 */
export const generateVideoSchema = z.object({
  proposalId: z.string().uuid("Invalid proposal ID"),
  videoType: videoTypeEnum,
  templateId: z.string().uuid().optional(),
  scriptText: z
    .string()
    .min(10, "Script must be at least 10 characters")
    .max(5000, "Script must be less than 5000 characters"),
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
  backgroundId: z.string().optional(),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;

/**
 * Video response schema
 */
export const videoResponseSchema = z.object({
  success: z.boolean(),
  videoId: z.string().uuid().optional(),
  status: videoStatusEnum,
  estimatedTime: z.number().optional(),
  error: z.string().optional(),
});

export type VideoResponse = z.infer<typeof videoResponseSchema>;

/**
 * Video status check response
 */
export const videoStatusCheckSchema = z.object({
  videoId: z.string().uuid(),
  status: videoStatusEnum,
  videoUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  duration: z.number().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  readyAt: z.string().optional(),
});

export type VideoStatusCheck = z.infer<typeof videoStatusCheckSchema>;

/**
 * Video list response
 */
export const videoListSchema = z.object({
  videos: z.array(
    z.object({
      id: z.string().uuid(),
      videoType: videoTypeEnum,
      status: videoStatusEnum,
      videoUrl: z.string().url().optional(),
      previewUrl: z.string().url().optional(),
      duration: z.number().optional(),
      mcuCost: z.number(),
      createdAt: z.string(),
      readyAt: z.string().optional(),
    })
  ),
  total: z.number(),
});

export type VideoList = z.infer<typeof videoListSchema>;

/**
 * HeyGen webhook schema
 */
export const heygenWebhookSchema = z.object({
  event: z.enum(["task.completed", "task.failed"]),
  task_id: z.string(),
  video_id: z.string(),
  video_url: z.string().url().optional(),
  error_message: z.string().optional(),
  timestamp: z.string(),
});

export type HeygenWebhook = z.infer<typeof heygenWebhookSchema>;
