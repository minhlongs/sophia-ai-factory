import { z } from "zod";

export const campaignSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  goal: z.string().min(1, "Goal is required").max(500, "Goal too long"),
  status: z.enum(["queued", "processing_script", "processing_video", "completed", "failed"]).optional(),
  videoUrl: z.string().url().optional().nullable(),
  scriptContent: z.string().optional().nullable(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

export const webhookHeaderSchema = z.object({
  "webhook-id": z.string(),
  "webhook-timestamp": z.string(),
  "webhook-signature": z.string(),
});
