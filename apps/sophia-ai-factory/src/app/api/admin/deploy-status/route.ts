/**
 * GET /api/admin/deploy-status
 *
 * Hook H: Returns deployment metadata + service connectivity checks.
 * Shows last deploy SHA/time, cron health, HeyGen/NOWPayments/Supabase status.
 * NOTE: GitHub Actions cannot be auto-restored from here — see page for workaround docs.
 *
 * Admin only.
 *
 * @module app/api/admin/deploy-status/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getD1Raw } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

interface CronRow { last_at: number | null }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const now = Math.floor(Date.now() / 1000)

  // Deploy metadata (injected as Worker secrets at deploy time by deploy-with-sha.sh)
  const deployInfo = {
    sha: process.env.COMMIT_SHA?.slice(0, 8) ?? null,
    deployedAt: process.env.DEPLOYED_AT ?? null,
    branch: process.env.DEPLOY_BRANCH ?? null,
  }

  // Cron health — last firing within 5 min
  let cronLastAt: number | null = null
  let cronHealthy = false
  try {
    const db = await getD1Raw()
    const row = await db
      .prepare(`SELECT MAX(started_at) AS last_at FROM cron_run_log`)
      .first<CronRow>()
    cronLastAt = row?.last_at ?? null
    cronHealthy = cronLastAt !== null && (now - cronLastAt) < 300
  } catch {
    // table may not exist in all envs
  }

  // HeyGen connectivity — basic key presence
  const heygenConfigured = !!process.env.HEYGEN_API_KEY

  // NOWPayments IPN secret presence
  const nowpaymentsConfigured = !!process.env.NOWPAYMENTS_IPN_SECRET

  // Supabase URL presence
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

  // GitHub Actions status — cannot query from here; honest doc
  const githubActionsStatus = {
    enabled: false,
    note: 'GitHub Actions disabled at account level (HTTP 422). Use deploy-with-sha.sh for manual deploy. Contact GitHub support to restore.',
    manualDeployCmd: 'cd apps/sophia-ai-factory && bash scripts/deploy-with-sha.sh',
  }

  return NextResponse.json({
    deploy: deployInfo,
    cron: {
      healthy: cronHealthy,
      lastFiredAt: cronLastAt,
      lastFiredIso: cronLastAt ? new Date(cronLastAt * 1000).toISOString() : null,
      secondsSinceLast: cronLastAt ? now - cronLastAt : null,
    },
    services: {
      heygen: heygenConfigured,
      nowpayments: nowpaymentsConfigured,
      supabase: supabaseConfigured,
    },
    cicd: githubActionsStatus,
    timestamp: now,
  })
}
