/**
 * POST /api/signals/track — relay custom events from client to PostHog
 * RED-TEAM #3: requireAuth (CRON_SECRET bearer OR Better Auth session)
 * RED-TEAM #11: server-only events rejected when source=client
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/tree/signals/auth-helper'
import { captureServer } from '@/tree/signals/posthog-capture'
import { isServerOnly, type EventName } from '@/tree/signals/event-types'

const TrackBodySchema = z.object({
  event: z.string().min(1).max(100),
  distinctId: z.string().min(1).max(200),
  properties: z.record(z.string(), z.unknown()).optional().default({}),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = TrackBodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { event, distinctId, properties } = parsed.data

  // Determine effective source — cron callers are server-trusted
  const source = auth.type === 'cron' ? 'server' : 'client'

  // Block client relay of server-only events
  if (source === 'client' && isServerOnly(event)) {
    return Response.json({ error: 'event not allowed from client source' }, { status: 403 })
  }

  try {
    await captureServer({
      event: event as EventName,
      distinctId,
      properties: properties as Record<string, unknown>,
      source,
    })
  } catch (err) {
    // captureServer throws for server-only violations — surface as 403
    if (err instanceof Error && err.message.includes('server-only')) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    // Other errors: still return 204 (fire-and-forget semantics)
  }

  return new Response(null, { status: 204 })
}
