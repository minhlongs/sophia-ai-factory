/**
 * POST /api/v1/creative-studio/images/generate
 *
 * API route alternative to the image-generate-action server action.
 * Intended for API consumers (e.g., Telegram bot, external clients).
 *
 * Body: { prompt: string, model: string, aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' }
 * Response: { jobId: string }
 *
 * Supports fal-ai models and customer-BYOK MuAPI models (never falls back to
 * the platform MUAPI_API_KEY).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { submitMuApiImageJob } from '@/land/image/image-generation-helpers';
import { bodySchema, isFalModel, TIER_ALLOWED_MODELS } from './config';
import { handleFalGeneration } from './fal-handler';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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
  const tier = await resolveUserTier(user.id);

  if (isFalModel(model)) {
    return handleFalGeneration(user, tier, prompt, model, aspectRatio);
  }

  const allowedMuapiModels = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  if (!allowedMuapiModels.includes(model)) {
    return NextResponse.json(
      { message: `Model "${model}" is not available for your ${tier} plan.` },
      { status: 403 },
    );
  }

  const result = await submitMuApiImageJob({
    userId: user.id,
    tier,
    prompt,
    model,
    aspectRatio,
  });

  if (!result.success) {
    const status =
      result.code === 'NO_API_KEY' ? 422 : result.code === 'MUAPI_ERROR' ? 502 : 500;
    return NextResponse.json({ message: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ jobId: result.jobId }, { status: 201 });
}
