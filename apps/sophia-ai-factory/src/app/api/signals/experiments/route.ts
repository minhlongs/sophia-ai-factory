/**
 * GET /api/signals/experiments — return active variant for a given experiment
 * RED-TEAM #3: requireAuth (CRON_SECRET bearer OR Better Auth session)
 * Sets sticky variant cookie on response
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/tree/signals/auth-helper'
import { assignVariant } from '@/tree/signals/ab-experiment'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const experiment = searchParams.get('experiment')
  const distinctId =
    auth.type === 'session'
      ? auth.userId
      : (searchParams.get('distinctId') ?? 'anonymous')

  if (!experiment) {
    return Response.json({ error: 'experiment param required' }, { status: 400 })
  }

  const { variant, setCookieHeader } = await assignVariant(experiment, distinctId)

  return Response.json(
    { experiment, variant, distinctId },
    {
      status: 200,
      headers: { 'Set-Cookie': setCookieHeader },
    },
  )
}
