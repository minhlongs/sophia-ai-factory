/**
 * POST /api/media/generate
 *
 * Submit a media generation job (video/audio).
 * Auth: session cookie required; PREMIUM tier or higher.
 * Backend: muapi.ai via muapi-media-client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  submitMediaJob,
  isModelSupported,
  SUPPORTED_MODELS,
  type MediaType,
} from '@/tree/clients/muapi-media-client'
import { toError } from '@/seed/utils/to-error'
import { logger } from '@/seed/utils/logger-utility'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { resolveUserTier } from '@/seed/db/resolve-user-tier'
import { getD1 } from '@/seed/db/client'

const generateSchema = z.object({
  type: z.enum(['image', 'video', 'audio']),
  model: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(500).optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().min(1).max(60).optional(),
  style: z.string().optional(),
  seed: z.number().optional(),
  imageUrl: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tier = await resolveUserTier(user.id)
  if (tier === 'BASIC') {
    return NextResponse.json(
      { error: 'Media generation requires PREMIUM or higher tier' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json()
    const parsed = generateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { type, model } = parsed.data

    if (type === 'image') {
      return NextResponse.json(
        {
          error:
            'Image generation is not available on this endpoint. ' +
            'Use /api/v1/creative-studio/images/generate with a fal-ai model, ' +
            `e.g. "fal-ai/flux-schnell" (requested model: "${model}").`,
        },
        { status: 403 },
      )
    }

    if (!isModelSupported(type as MediaType, model)) {
      return NextResponse.json(
        {
          error: `Model "${model}" not supported for type "${type}"`,
          supported: SUPPORTED_MODELS[type as MediaType],
        },
        { status: 400 },
      )
    }

    if (!process.env.MUAPI_API_KEY) {
      return NextResponse.json(
        { error: 'Media generation not configured. Set MUAPI_API_KEY.' },
        { status: 503 },
      )
    }

    const result = await submitMediaJob(parsed.data)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 502 },
      )
    }

    try {
      const d1 = await getD1()
      if (d1) {
        const nowSec = Math.floor(Date.now() / 1000)
        await d1
          .prepare('INSERT OR IGNORE INTO media_jobs (id, user_id, type, model, prompt, status, created_at, requested_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
          .bind(result.job!.id, user.id, result.job!.type, result.job!.model, parsed.data.prompt, result.job!.status, nowSec, nowSec)
          .run()
      }
    } catch (err) {
      logger.error('[media/generate] failed to persist media_jobs ownership row', toError(err))
    }

    return NextResponse.json({
      jobId: result.job!.id,
      status: result.job!.status,
      type: result.job!.type,
      model: result.job!.model,
      message: 'Job submitted. Poll /api/media/status?id=<jobId> for results.',
    })
  } catch (err) {
    return NextResponse.json({ error: toError(err).message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    models: { video: SUPPORTED_MODELS.video, audio: SUPPORTED_MODELS.audio },
    usage: 'POST with { type, model, prompt }',
    image: 'not available here — use /api/v1/creative-studio/images/generate',
  })
}
