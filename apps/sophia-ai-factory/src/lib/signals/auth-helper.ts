/**
 * Auth helper for /api/signals/* routes
 * RED-TEAM #3: accepts EITHER CRON_SECRET bearer OR valid Better Auth session
 * Returns structured result or a 401 Response — caller must check with instanceof Response
 */

import { getCurrentUserFromHeaders } from '@/lib/better-auth-session'
import { NextRequest } from 'next/server'

export type AuthResult =
  | { type: 'cron' }
  | { type: 'session'; userId: string }

/**
 * Verify request authentication.
 * - CRON_SECRET bearer → { type: 'cron' }
 * - Valid Better Auth session cookie → { type: 'session', userId }
 * - Otherwise → Response 401
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult | Response> {
  // 1. Check bearer token (server-to-server / cron path)
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (authHeader.startsWith('Bearer ') && cronSecret) {
    const token = authHeader.slice(7)
    if (token === cronSecret) {
      return { type: 'cron' }
    }
    // Bearer present but wrong — don't fall through to session (fail fast)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Check Better Auth session cookie
  try {
    const user = await getCurrentUserFromHeaders(req.headers)
    if (user?.id) {
      return { type: 'session', userId: user.id }
    }
  } catch {
    // session lookup failed — fall through to 401
  }

  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

/**
 * Strict cron-only variant — rejects browser sessions.
 * Used by /api/cron/weekly-signals-digest.
 */
export async function requireCron(req: NextRequest): Promise<{ type: 'cron' } | Response> {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 })
  }

  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return { type: 'cron' }
  }

  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
