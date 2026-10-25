import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { findRecentDuplicateImageJob } from '@/tree/creative-studio/image-generation-idempotency';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { TIER_ALLOWED_FAL_MODELS } from './config';
import {
  type FalUserContext,
  recordFalCompletedJob,
  recordFalFailedJob,
} from './fal-handler-helpers';

export async function handleFalGeneration(
  user: FalUserContext,
  tier: string,
  prompt: string,
  model: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3',
): Promise<NextResponse> {
  const allowedFalModels = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
  if (!allowedFalModels.includes(model)) {
    return NextResponse.json(
      { message: `Model "${model}" is not available for your ${tier} plan.` },
      { status: 403 },
    );
  }

  const db = createServerClient();
  const duplicateJobId = await findRecentDuplicateImageJob(db, {
    userId: user.id,
    prompt,
    model,
  });
  if (duplicateJobId) {
    return NextResponse.json({ jobId: duplicateJobId }, { status: 201 });
  }

  const apiKey = await resolveUserApiKey(user.id, 'fal-ai', process.env.FAL_KEY);
  if (!apiKey) {
    return NextResponse.json({ message: 'fal.ai API key not configured' }, { status: 502 });
  }

  const falProvider = new FalImageProvider({ apiKey, model, keyRef: user.id });
  const startTime = Date.now();

  try {
    const result = await falProvider.generate({ prompt, aspectRatio });
    return await recordFalCompletedJob({ user, tier, prompt, model, aspectRatio, startTime, result });
  } catch (err) {
    return await recordFalFailedJob({ err, user, tier, prompt, model, startTime });
  }
}
