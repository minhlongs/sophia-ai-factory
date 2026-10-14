import { z } from 'zod/v4';

export const SUPPORTED_PLATFORMS = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'x',
  'whatsapp',
  'blog',
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export const DistributionPlanSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  assetId: z.string().min(1),
  channels: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1),
  scheduleAt: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DistributionPlanInput = z.infer<typeof DistributionPlanSchema>;

export interface DistributionPlanRow {
  id: string;
  workspace_id: string;
  project_id: string;
  asset_id: string;
  channels: string;
  schedule_at: number | null;
  status: 'draft' | 'scheduled' | 'executing' | 'completed' | 'failed';
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface DistributionPostRow {
  id: string;
  plan_id: string;
  platform: string;
  platform_post_id: string | null;
  status: 'scheduled' | 'uploading' | 'processing' | 'published' | 'failed';
  scheduled_at: number;
  posted_at: number | null;
  error: string | null;
  idempotency_key: string;
  created_at: number;
}

export class DistributionPlanError extends Error {
  code: 'INVALID_INPUT' | 'ASSET_NOT_FOUND' | 'PLATFORM_UNSUPPORTED' | 'INSERT_FAILED';
  constructor(
    code: 'INVALID_INPUT' | 'ASSET_NOT_FOUND' | 'PLATFORM_UNSUPPORTED' | 'INSERT_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'DistributionPlanError';
    this.code = code;
  }
}

export function newPlanId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newPostId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildIdempotencyKey(planId: string, platform: string): string {
  return `dist_${planId}_${platform}`;
}
