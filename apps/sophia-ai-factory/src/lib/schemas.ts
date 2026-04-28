import { z } from "zod";

export const campaignSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long").trim(),
  // goal was renamed to topic in DB, keeping consistent with UI
  topic: z.string().min(1, "Topic is required").max(500, "Topic too long").trim(),
  audience: z.string().max(200, "Audience description too long").optional(),

  // State & Progress
  status: z.enum(["draft", "queued", "processing_script", "processing_video", "completed", "failed"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  error_message: z.string().optional().nullable(),

  // Assets
  video_url: z.string().url("Invalid video URL").optional().nullable(),
  thumbnail_url: z.string().url("Invalid thumbnail URL").optional().nullable(),
  script_content: z.record(z.string(), z.unknown()).optional().nullable(), // JSONB

  template_id: z.string().uuid("Invalid template ID").optional().nullable(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

export const webhookHeaderSchema = z.object({
  "webhook-id": z.string().min(1),
  "webhook-timestamp": z.string().min(1),
  "webhook-signature": z.string().min(1).optional(),
  "Polar-Signature": z.string().min(1).optional(),
}).refine(
  (data) => data["webhook-signature"] || data["Polar-Signature"],
  { message: "Either webhook-signature or Polar-Signature is required" }
);

export const checkoutSchema = z.object({
  tier: z.enum(["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"]),
});

export const integrationSchema = z.object({
  network: z.enum(["clickbank", "shareasale", "amazon"]),
  api_key: z.string().min(1, "API Key is required"),
  api_secret: z.string().optional(),
});

export const createVideoSchema = z.object({
  avatarId: z.string().min(1, "Avatar ID is required"),
  voiceId: z.string().min(1, "Voice ID is required"),
  script: z.string().min(1, "Script is required"),
  title: z.string().optional(),
  scriptRequestId: z.string().optional(),
});

export const setupConfigSchema = z.object({
  config: z.record(z.string(), z.string()).refine((data) => Object.keys(data).length > 0, {
    message: "Config cannot be empty",
  }),
});
