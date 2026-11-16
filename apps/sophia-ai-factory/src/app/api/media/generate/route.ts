/**
 * POST /api/media/generate
 *
 * Submit a customer-paid BYOK media generation job (video/audio).
 * Auth: session cookie required; canonical paid tier (PREMIUM / ENTERPRISE / MASTER).
 * Cost model: customer BYOK `'muapi'` key only — never spends `process.env.MUAPI_API_KEY`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  submitMediaJob,
  isModelSupported,
  SUPPORTED_MODELS,
  type MediaType,
} from '@/tree/clients/muapi-media-client'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { TIER_RANK, type Tier } from '@/seed/types'
import { CostClassification } from '@/seed/types/creative-job-economics'
import { toError } from '@/seed/utils/to-error'
import { logger } from '@/seed/utils/logger-utility'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { resolveUserTier } from '@/seed/db/resolve-user-tier'
import { getD1 } from '@/seed/db/client'
import { withD1Retry } from '@/seed/db/d1-retry'

const generateSchema = z.object({
  type: z.enum(['image', 'video', 'audio']),
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(500).optional(),
  aspectRatio: z.string().max(16).optional(),
  duration: z.number().min(1).max(60).optional(),
  style: z.string().max(100).optional(),
  seed: z.number().int().nonnegative().optional(),
  imageUrl: z
    .string()
    .url()
    .max(2048)
    .refine((val) => val.startsWith('https://'), { message: 'imageUrl must use HTTPS' })
    .optional(),
})

/**
 * True only for a canonical paid tier (`PREMIUM`, `ENTERPRISE`, `MASTER`),
 * checked as an own property on `TIER_RANK` so `BASIC`, unknown tier strings,
 * non-strings, and `Object.prototype` keys (`__proto__`, `constructor`,
 * `toString`, `valueOf`) fail closed.
 */
function isPaidMediaTier(tier: unknown): tier is Exclude<Tier, 'BASIC'> {
  return typeof tier === 'string' && Object.hasOwn(TIER_RANK, tier) && tier !== 'BASIC'
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tier = await resolveUserTier(user.id)
    if (!isPaidMediaTier(tier)) {
      return NextResponse.json(
        { error: 'Media generation requires PREMIUM or higher tier', code: 'TIER_GATE' },
        { status: 403 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
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

    const rawApiKey = await resolveUserApiKey(user.id, 'muapi')
    const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : ''
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'MuAPI API key not configured. Add your MuAPI key in the Setup Wizard.',
          code: 'NO_API_KEY',
        },
        { status: 422 },
      )
    }

    const d1 = await getD1()
    if (!d1) {
      logger.error('[media/generate] D1 unavailable before job submission')
      return NextResponse.json(
        { error: 'Failed to record job', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    const result = await submitMediaJob(parsed.data, { fund: 'byok', apiKey })

    if (!result.success || !result.job) {
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 502 },
      )
    }

    const nowSec = Math.floor(Date.now() / 1000)
    try {
      const insertResult = (await withD1Retry(() =>
        d1
          .prepare(
            'INSERT INTO media_jobs (id, user_id, type, model, prompt, status, provider, cost_classification, created_at, requested_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)',
          )
          .bind(
            result.job!.id,
            user.id,
            result.job!.type,
            result.job!.model,
            parsed.data.prompt,
            result.job!.status,
            'muapi',
            CostClassification.UNMETERED,
            nowSec,
            nowSec,
          )
          .run(),
      )) as { success?: boolean } | null | undefined

      if (insertResult && insertResult.success === false) {
        logger.error('[media/generate] media_jobs insert returned unsuccessful result', {
          userId: user.id,
          jobId: result.job.id,
          type: result.job.type,
          model: result.job.model,
        })
        return NextResponse.json(
          { error: 'Failed to record job', code: 'DB_ERROR' },
          { status: 500 },
        )
      }
    } catch (dbErr) {
      logger.error('[media/generate] media_jobs insert failed', {
        userId: user.id,
        jobId: result.job.id,
        type: result.job.type,
        model: result.job.model,
        error: toError(dbErr).message,
      })
      return NextResponse.json(
        { error: 'Failed to record job', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      jobId: result.job.id,
      status: result.job.status,
      type: result.job.type,
      model: result.job.model,
      message: 'Job submitted. Poll /api/media/status?id=<jobId> for results.',
    })
  } catch (err) {
    logger.error('[media/generate] POST error', toError(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    models: { video: SUPPORTED_MODELS.video, audio: SUPPORTED_MODELS.audio },
    usage: 'POST with { type, model, prompt }',
    image: 'not available here — use /api/v1/creative-studio/images/generate',
  })
}
