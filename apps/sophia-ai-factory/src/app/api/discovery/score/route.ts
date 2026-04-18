/**
 * POST /api/discovery/score
 *
 * User-authenticated endpoint to score an affiliate program against a niche
 * using the OpenRouter-powered semantic enhancer (Phase 7C).
 *
 * Auth: getCurrentUser() required — 401 when missing.
 * Rate limiting: inherits default RATE_LIMITS.api (100 req/min) — dedicated
 * 'discovery' bucket deferred to R10 if abuse observed (OpenRouter cost exposure).
 * No audit event — scoring is a cheap read-like op, not a sensitive mutation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/better-auth-session'
import { enhanceNicheScoreWithAI } from '@/lib/discovery/affiliate-openrouter-niche-enhancer'
import { logger } from '@/lib/utils/logger-utility'
import type { AffiliateProgram } from '@/types'

const ProgramSchema = z.object({
  id:       z.string().min(1),
  name:     z.string().min(1),
  category: z.string().optional(),
}).passthrough()

const BodySchema = z.object({
  program: ProgramSchema,
  niche:   z.string().min(1).max(200),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // `passthrough()` preserves all caller-supplied fields; cast to AffiliateProgram
  // so the enhancer can access optional fields (category, description, etc.) if present.
  const program = parsed.data.program as unknown as AffiliateProgram

  let score: number | null
  try {
    score = await enhanceNicheScoreWithAI(program, parsed.data.niche, user.id)
  } catch (err) {
    logger.warn('[discovery-score] enhanceNicheScoreWithAI failed', {
      userId: user.id,
      error:  err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }

  return NextResponse.json({ score })
}
