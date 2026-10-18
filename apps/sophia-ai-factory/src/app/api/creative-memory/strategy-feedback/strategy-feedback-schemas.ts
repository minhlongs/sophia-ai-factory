import { z } from 'zod';

export const GetFeedbackSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  applied: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const PostFeedbackSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  recommendationId: z.string().optional(),
  applied: z.boolean().optional(),
  recommendation: z.string().optional(),
  reasoning: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().optional(),
  signalSummary: z.string().optional(),
  signalCount: z.number().int().nonnegative().optional(),
});

export type PostFeedbackInput = z.infer<typeof PostFeedbackSchema>;
