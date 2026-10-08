import { z } from "zod";

export const TrafficRedirectSchema = z.object({
  sourceUrl: z.string().url(),
  targetUrl: z.string().url(),
  weight: z.number().min(0).max(100),
});

export const YieldRouterHealthCheckSchema = z.object({
  routerId: z.string(),
  activeNodes: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  status: z.enum(["OK", "DEGRADED", "DOWN"]),
});

export const ShadowbanTelemetryEventSchema = z.object({
  videoId: z.string(),
  accountId: z.string(),
  metadataEntropy: z.number().min(0).max(1),
  postTimingMs: z.number().int().positive(),
  hashtags: z.array(z.string()),
  platform: z.enum(["TIKTOK", "YOUTUBE", "INSTAGRAM"]),
});

export const ScriptCultureIndexRequestSchema = z.object({
  scriptId: z.string(),
  regionalTarget: z.enum(["NORTH_AMERICA", "LATIN_AMERICA", "SOUTHEAST_ASIA", "EUROPE", "MENA"]),
  transcriptString: z.string(),
});

export type TrafficRedirect = z.infer<typeof TrafficRedirectSchema>;
export type YieldRouterHealthCheck = z.infer<typeof YieldRouterHealthCheckSchema>;
export type ShadowbanTelemetryEvent = z.infer<typeof ShadowbanTelemetryEventSchema>;
export type ScriptCultureIndexRequest = z.infer<typeof ScriptCultureIndexRequestSchema>;
