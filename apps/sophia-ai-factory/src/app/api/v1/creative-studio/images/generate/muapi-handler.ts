/**
 * MuAPI submission handler for the image generate API route.
 *
 * Retained for its tier-map reference and documentation of the branch's shape,
 * but unreachable from the route: the route refuses every non-fal model before
 * dispatch. The branch submits against the platform's own MUAPI_API_KEY and
 * records `cost_classification: 'UNKNOWN'` with no `provider_cost`, no credit
 * deduction and no usage event, so no caller may reach it until a cost owner is
 * decided. Re-enabling requires removing the route's non-fal rejection and the
 * matching guards in the server action and the land orchestrator together.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { submitMediaJob } from '@/tree/clients/muapi-media-client';
import { logger } from '@/seed/utils/logger-utility';
import { TIER_ALLOWED_MODELS } from './config';

interface UserContext {
  id: string;
}

export async function handleMuapiGeneration(
  user: UserContext,
  tier: string,
  prompt: string,
  model: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3',
): Promise<NextResponse> {
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
    cost_classification: 'UNKNOWN',
    requested_at: Math.floor(Date.now() / 1000),
  }) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[creative-studio/images/generate] D1 insert failed', new Error(insertError.message));
    return NextResponse.json({ message: 'Failed to record job' }, { status: 500 });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}
