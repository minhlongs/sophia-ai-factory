/**
 * POST /api/discovery/score
 *
 * User-authenticated endpoint to score an affiliate program against a niche
 * using the OpenRouter-powered semantic enhancer (Phase 7C).
 *
 * Auth: getCurrentUser() required — 401 when missing.
 * Rate limiting: RATE_LIMITS.discovery (30 req/min) — stricter than default api
 *   to limit OpenRouter cost exposure.
 * Audit: emits D1Events.DISCOVERY_SCORE_REQUESTED after each successful 200 response.
 *   Emission is fire-and-forget; never fails the score response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { enhanceNicheScoreWithAI } from '@/tree/discovery/affiliate-openrouter-niche-enhancer'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'
import type { AffiliateProgram } from '@/seed/types'

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
      error:  getErrorMessage(err),
    })
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }

  // Audit trail — fire-and-forget, must never fail the 200 response
  try {
    track(D1Events.DISCOVERY_SCORE_REQUESTED, user.id, {
      program_id: parsed.data.program.id,
      niche_len:  parsed.data.niche.length,
      score_null: score === null,
    })
  } catch {
    // swallow — audit failure must not break scoring
  }

  return NextResponse.json({ score })
}
