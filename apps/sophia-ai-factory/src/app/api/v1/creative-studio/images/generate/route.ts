/**
 * POST /api/v1/creative-studio/images/generate
 *
 * API route alternative to the image-generate-action server action.
 * Intended for API consumers (e.g., Telegram bot, external clients).
 *
 * Body: { prompt: string, model: string, aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' }
 * Response: { jobId: string }
 *
 * Only fal-ai models are served; every other model id is refused before any
 * handler is reached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { bodySchema, isFalModel } from './config';
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

  if (!isFalModel(model)) {
    // Every non-fal model would route to the MuAPI branch, which submits against
    // the platform's own MuAPI key and records no provider cost, so no caller may
    // reach it. Refuse the request here rather than letting the provider gate
    // inside the handler decide, so the two server entry points answer alike.
    return NextResponse.json(
      { message: `Model "${model}" is not supported. Choose a fal-ai/ model.` },
      { status: 403 },
    );
  }

  return handleFalGeneration(user, tier, prompt, model, aspectRatio);
}
