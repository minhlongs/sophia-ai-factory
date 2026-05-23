/**
 * POST /api/v1/creative-studio/images/generate
 *
 * API route alternative to the image-generate-action server action.
 * Intended for API consumers (e.g., Telegram bot, external clients).
 *
 * Body: { prompt: string, model: string, aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' }
 * Response: { jobId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { createServerClient } from '@/seed/db/client';
import { submitMediaJob, SUPPORTED_MODELS } from '@/tree/clients/muapi-media-client';
import { logger } from '@/seed/utils/logger-utility';

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).default('1:1'),
});

const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: SUPPORTED_MODELS.image,
  MASTER: SUPPORTED_MODELS.image,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((e) => e.message).join('; ') },
      { status: 400 },
    );
  }

  const { prompt, model, aspectRatio } = parsed.data;

  // Tier gate
  const tier = await getUserTier(user.id);
  const allowedModels = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  if (!allowedModels.includes(model)) {
    return NextResponse.json(
      { message: `Model "${model}" is not available for your ${tier} plan.` },
      { status: 403 },
    );
  }

  // Submit to MuAPI
  const muResult = await submitMediaJob({ type: 'image', model, prompt, aspectRatio });
  if (!muResult.success || !muResult.job) {
    logger.warn('[creative-studio/images/generate] MuAPI failed', { error: muResult.error });
    return NextResponse.json({ message: 'Failed to submit generation job' }, { status: 502 });
  }

  const jobId = muResult.job.id;

  // Persist to D1
  const db = createServerClient();
  const { error: insertError } = await db.from('media_jobs').insert({
    id: jobId,
    user_id: user.id,
    type: 'image',
    model,
    prompt,
    status: 'pending',
  }) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[creative-studio/images/generate] D1 insert failed', new Error(insertError.message));
    return NextResponse.json({ message: 'Failed to record job' }, { status: 500 });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}
