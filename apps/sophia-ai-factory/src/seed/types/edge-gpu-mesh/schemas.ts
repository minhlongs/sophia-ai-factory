/**
 * @file schemas.ts
 * @description Zod runtime validation schemas for edge GPU render jobs and SLA escrows.
 * @layer seed
 */

import { z } from 'zod';

export const videoRenderJobInputSchema = z.object({
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  videoResolution: z.enum(['720p', '1080p', '4K', '8K']),
  videoDurationSeconds: z.number().positive(),
  frameCount: z.number().int().positive(),
  codec: z.enum(['h264', 'hevc', 'av1', 'prores']).optional().default('h264'),
  preferredRegion: z
    .enum([
      'apac-tokyo',
      'apac-singapore',
      'apac-vietnam',
      'us-east-iad',
      'us-west-sfo',
      'eu-west-fra',
      'eu-central-ams',
    ])
    .optional(),
  priorityScore: z.number().int().min(0).optional().default(100),
  allowSpot: z.boolean().optional().default(true),
});

export const fundEscrowInputSchema = z.object({
  tenantId: z.string().min(1),
  contractId: z.string().min(1),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  monthlyContractValueCents: z.number().int().positive(),
  depositPct: z.number().min(5.0).max(100.0).optional().default(20.0),
});
