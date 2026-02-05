import { z } from "zod";

export const createCampaignSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  topic: z.string().min(1, "Topic is required").max(500).optional(),
  audience: z.string().max(200).optional(),
  platforms: z.array(z.string()).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignStatusSchema = z.object({
  status: z.enum([
    'draft',
    'queued',
    'processing_script',
    'processing_video',
    'completed',
    'failed'
  ]),
  progress: z.number().min(0).max(100).optional(),
  error_message: z.string().optional(),
  script_content: z.record(z.string(), z.any()).optional(),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
});

export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;
