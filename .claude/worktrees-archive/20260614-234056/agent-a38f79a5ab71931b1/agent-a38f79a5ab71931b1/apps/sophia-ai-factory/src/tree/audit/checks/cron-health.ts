/**
 * Cron Health Checks
 * Validates each registered cron job has run recently within expected window.
 *
 * @module lib/audit/checks/cron-health
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface CronSpec {
  name: string
  schedule: string
  maxAgeSec: number
  description: string
}

const CRON_SPECS: CronSpec[] = [
  { name: 'fulfillment-retry', schedule: '*/2 * * * *', maxAgeSec: 300, description: 'Fulfillment retry (every 2min)' },
  { name: 'uptime-check', schedule: '*/5 * * * *', maxAgeSec: 600, description: 'Uptime check (every 5min)' },
  { name: 'video-status-sync', schedule: '*/5 * * * *', maxAgeSec: 600, description: 'Video status sync (every 5min)' },
  { name: 'smoke-one-time', schedule: '*/15 * * * *', maxAgeSec: 1800, description: 'Smoke test (every 15min)' },
  { name: 'fulfillment-reconcile', schedule: '0 6 * * *', maxAgeSec: 93600, description: 'Daily reconcile (every 26h)' },
]

interface CronRunRow {
  cron_name: string
  last_run_at: number
  last_status: string
}

export async function runCronHealthChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const now = Math.floor(Date.now() / 1000)

  let rows: CronRunRow[] = []
  let dbError: string | null = null

  try {
    const result = await env.d1
      .prepare(
        `SELECT cron_name, MAX(started_at) AS last_run_at, last_value(status) OVER (PARTITION BY cron_name ORDER BY started_at) AS last_status
         FROM cron_run_log
         GROUP BY cron_name`,
      )
      .all<CronRunRow>()
    rows = result.results ?? []
  } catch {
    // Try simpler query
    try {
      const result = await env.d1
        .prepare(`SELECT cron_name, MAX(started_at) AS last_run_at, 'unknown' AS last_status FROM cron_run_log GROUP BY cron_name`)
        .all<CronRunRow>()
      rows = result.results ?? []
    } catch (e2) {
      dbError = e2 instanceof Error ? e2.message : 'D1 query failed'
    }
  }

  if (dbError) {
    return [
      {
        id: 'cron-health',
        category: 'Cron Health',
        name: 'Cron Jobs Firing',
        status: 'warn',
        weight: 7,
        score: 0.5,
        evidence: `Could not query cron_run_log: ${dbError}`,
        fix: 'Ensure cron_run_log table exists and crons are recording runs',
        durationMs: Date.now() - start,
      },
    ]
  }

  const rowMap = new Map(rows.map((r) => [r.cron_name, r]))
  const cronResults = CRON_SPECS.map((spec) => {
    const row = rowMap.get(spec.name)
    if (!row) return { spec, ok: false, detail: 'No run recorded' }
    const age = now - (row.last_run_at ?? 0)
    const withinWindow = age <= spec.maxAgeSec
    const statusOk = row.last_status === 'success' || row.last_status === 'unknown'
    return {
      spec,
      ok: withinWindow && statusOk,
      detail: `Last run: ${age}s ago, status: ${row.last_status}`,
    }
  })

  const passed = cronResults.filter((r) => r.ok)
  const failed = cronResults.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length <= 1 ? 'warn' : 'fail'
  const evidence =
    failed.length === 0
      ? `All ${CRON_SPECS.length} crons firing within expected windows`
      : `${passed.length}/${CRON_SPECS.length} healthy. Issues: ${failed.map((r) => `${r.spec.name} (${r.detail})`).join('; ')}`

  return [
    {
      id: 'cron-health',
      category: 'Cron Health',
      name: 'Cron Jobs Firing',
      status,
      weight: 7,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix: failed.length > 0 ? `Fix crons: ${failed.map((r) => r.spec.name).join(', ')}` : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
