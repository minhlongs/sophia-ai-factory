/**
 * GET /api/signals/flag — evaluate a single PostHog feature flag
 * RED-TEAM #3: requireAuth (CRON_SECRET bearer OR Better Auth session)
 * RED-TEAM #9: flag() internally caches in EXPERIMENT_KV (60s TTL)
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/signals/auth-helper'
import { flag } from '@/lib/signals/feature-flags'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const flagName = searchParams.get('flag')
  const distinctId =
    auth.type === 'session'
      ? auth.userId
      : (searchParams.get('distinctId') ?? 'anonymous')

  if (!flagName) {
    return Response.json({ error: 'flag param required' }, { status: 400 })
  }

  const value = await flag(flagName, distinctId)

  return Response.json({ flag: flagName, value, distinctId }, { status: 200 })
}
