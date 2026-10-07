/**
 * POST /api/v1/video/autonomous
 *
 * Dispatches an autonomous video generation pipeline execution for SaaS Global or Crypto Global affiliate campaigns.
 *
 * Layer: app/api/v1/video/autonomous (Interface Adapter / API Gateway)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { runAutonomousVideoPipeline } from '@/forest/video/autonomous-video-orchestrator';
import { inngest } from '@/seed/inngest/client';
import { errorResponse, handleThrownError } from '@/seed/api';

export const dynamic = 'force-dynamic';

const AutonomousVideoSchema = z.object({
  campaignId: z.string().min(1),
  niche: z.enum(['saas_global', 'crypto_global']),
  productName: z.string().min(1),
  productUrl: z.string().url(),
  productDescription: z.string().min(5),
  targetDurationSeconds: z.number().min(5).max(60).optional().default(15.0),
  affiliateBaseUrl: z.string().url(),
  asyncExecution: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = AutonomousVideoSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      'Invalid request parameters',
      'VALIDATION_ERROR',
      422,
      JSON.stringify(parsed.error.flatten().fieldErrors),
    );
  }

  const {
    campaignId,
    niche,
    productName,
    productUrl,
    productDescription,
    targetDurationSeconds,
    affiliateBaseUrl,
    asyncExecution,
  } = parsed.data;

  try {
    if (asyncExecution) {
      await inngest.send({
        name: 'autonomous.video.pipeline.requested',
        data: {
          campaignId,
          niche,
          productName,
          productUrl,
          productDescription,
          targetDurationSeconds,
          affiliateBaseUrl,
        },
      });

      return NextResponse.json(
        {
          success: true,
          mode: 'ASYNC_QUEUED',
          campaignId,
          message: 'Video pipeline synthesis queued in background',
        },
        { status: 202 },
      );
    }

    const summary = runAutonomousVideoPipeline({
      campaignId,
      niche,
      productName,
      productUrl,
      productDescription,
      targetDurationSeconds,
      affiliateBaseUrl,
    });

    return NextResponse.json(
      {
        success: true,
        mode: 'SYNC_SYNTHESIZED',
        summary,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return handleThrownError(err, 'Failed to execute autonomous video pipeline', 'PIPELINE_EXECUTION_ERROR', 500);
  }
}
