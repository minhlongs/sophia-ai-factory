/**
 * Creative Identity API validation schema and builder helper
 */

import { z } from 'zod';
import { newIdentityId } from '@/tree/creative-identity';
import type { CreativeIdentity, Tone } from '@/seed/types/creative-domain';

const TONES: Tone[] = [
  'formal',
  'casual',
  'sharp',
  'warm',
  'playful',
  'authoritative',
  'empathetic',
];

const contentFormatSchema = z.object({
  type: z.enum(['video_short', 'video_long', 'image', 'audio', 'article', 'carousel']),
  platform: z.enum(['youtube', 'tiktok', 'x', 'instagram', 'facebook', 'whatsapp', 'blog']),
  maxDurationSeconds: z.number().optional(),
  aspectRatio: z.string().optional(),
  constraints: z.array(z.string()),
});

export const createIdentitySchema = z.object({
  workspaceId: z.string().min(1),
  brandId: z.string().optional(),
  voice: z.string().min(1).optional(),
  tone: z.enum(TONES as [string, ...string[]]).optional(),
  formality: z.number().min(0).max(1).optional(),
  energy: z.number().min(0).max(1).optional(),
  beliefs: z.array(z.string()).optional(),
  positioning: z.string().optional(),
  targetAudience: z.string().optional(),
  forbiddenPatterns: z.array(z.string()).optional(),
  requiredDisclosures: z.array(z.string()).optional(),
  formats: z.array(contentFormatSchema).optional(),
  referenceWorks: z.array(z.string()).optional(),
});

export type CreateIdentityInput = z.infer<typeof createIdentitySchema>;

export function buildIdentity(
  data: CreateIdentityInput,
  userId: string,
  existing?: CreativeIdentity,
): CreativeIdentity {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: existing?.id ?? newIdentityId(),
    workspaceId: data.workspaceId,
    brandId: data.brandId ?? existing?.brandId,
    voiceDescription: data.voice ?? existing?.voiceDescription ?? '',
    tone: (data.tone ?? existing?.tone ?? 'casual') as Tone,
    formality: data.formality ?? existing?.formality ?? 0.5,
    energy: data.energy ?? existing?.energy ?? 0.5,
    beliefs: data.beliefs ?? existing?.beliefs ?? [],
    positioning: data.positioning ?? existing?.positioning ?? '',
    targetAudience: data.targetAudience ?? existing?.targetAudience ?? '',
    forbiddenPatterns: data.forbiddenPatterns ?? existing?.forbiddenPatterns ?? [],
    requiredDisclosures: data.requiredDisclosures ?? existing?.requiredDisclosures ?? [],
    preferredFormats: data.formats ?? existing?.preferredFormats ?? [],
    referenceWorks: data.referenceWorks ?? existing?.referenceWorks ?? [],
    version: existing?.version ?? 0,
    isActive: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy: userId,
  };
}
