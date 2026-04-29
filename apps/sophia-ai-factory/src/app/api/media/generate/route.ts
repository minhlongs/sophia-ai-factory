/**
 * POST /api/media/generate
 *
 * Submit a media generation job (image/video/audio).
 * Auth: RaaS license key required.
 * Backend: muapi.ai via muapi-media-client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  submitMediaJob,
  isModelSupported,
  SUPPORTED_MODELS,
  type MediaType,
} from '@/lib/clients/muapi-media-client'
import { toError } from '@/lib/utils/to-error'
import { getCurrentUser } from '@/lib/better-auth-session'
import { getUserTier } from '@/lib/db/get-user-tier'

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

  const tier = await getUserTier(user.id)
  // FREE (BASIC) users cannot access paid media generation
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

    return NextResponse.json({
      jobId: result.job!.id,
      status: result.job!.status,
      type: result.job!.type,
      model: result.job!.model,
      message: 'Job submitted. Poll /api/media/status?id=<jobId> for results.',
    })
  } catch (err) {
    return NextResponse.json(
      { error: toError(err).message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    models: SUPPORTED_MODELS,
    usage: 'POST with { type, model, prompt }',
  })
}
