/**
 * check-cf-quota.ts
 *
 * Queries Cloudflare API for current usage of Workers requests, D1 reads/writes,
 * and R2 storage. Emits JSON + human summary. Alerts via Sentry when thresholds
 * are crossed: 70% (warning), 90% (critical), 100% (page on-call).
 *
 * Usage (standalone — can run via tsx without Next.js context):
 *   npx tsx scripts/check-cf-quota.ts
 *
 * Usage (imported by a Next.js API route):
 *   import { runQuotaCheck } from '../scripts/check-cf-quota'
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN   — CF API token with Account Analytics read permission
 *   CLOUDFLARE_ACCOUNT_ID  — CF account ID (visible in dashboard URL)
 *
 * Optional env vars:
 *   SENTRY_DSN                        — if set, Sentry events are emitted on threshold breach
 *   QUOTA_WORKERS_DAILY_LIMIT         — default: 100_000 (CF free tier)
 *   QUOTA_D1_READS_DAILY_LIMIT        — default: 5_000_000 (CF free tier)
 *   QUOTA_D1_WRITES_DAILY_LIMIT       — default: 100_000 (CF free tier)
 *   QUOTA_R2_STORAGE_GB_LIMIT         — default: 10 (CF free tier)
 *
 * Thresholds:
 *   70%  → warning   (Sentry event level=warning)
 *   90%  → critical  (Sentry event level=error)
 *   100% → page      (Sentry event level=fatal)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotaMetric {
  name: string
  current: number
  limit: number
  unit: string
  usagePct: number
  threshold: 'ok' | 'warning' | 'critical' | 'page'
}

export interface QuotaReport {
  timestamp: string
  metrics: QuotaMetric[]
  alerts: QuotaMetric[]
  summary: string
}

interface CfGraphQlResponse {
  data?: {
    viewer?: {
      accounts?: Array<Record<string, unknown>>
    }
  }
  errors?: Array<{ message: string }>
}

interface WorkersRow {
  sum: { requests?: number }
}

interface D1Row {
  sum: { readQueries?: number; writeQueries?: number }
}

interface R2Row {
  max: { payloadSize?: number }
}

// ---------------------------------------------------------------------------
// CF free-tier limits (operator can override via env)
// ---------------------------------------------------------------------------
const LIMITS = {
  workersRequestsPerDay: Number(process.env['QUOTA_WORKERS_DAILY_LIMIT'] ?? 100_000),
  d1ReadsPerDay: Number(process.env['QUOTA_D1_READS_DAILY_LIMIT'] ?? 5_000_000),
  d1WritesPerDay: Number(process.env['QUOTA_D1_WRITES_DAILY_LIMIT'] ?? 100_000),
  r2StorageGb: Number(process.env['QUOTA_R2_STORAGE_GB_LIMIT'] ?? 10),
}

const THRESHOLDS = { warning: 70, critical: 90, page: 100 } as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyThreshold(pct: number): QuotaMetric['threshold'] {
  if (pct >= THRESHOLDS.page) return 'page'
  if (pct >= THRESHOLDS.critical) return 'critical'
  if (pct >= THRESHOLDS.warning) return 'warning'
  return 'ok'
}

function buildMetric(
  name: string,
  current: number,
  limit: number,
  unit: string
): QuotaMetric {
  const usagePct = limit > 0 ? Math.round((current / limit) * 100) : 0
  return { name, current, limit, unit, usagePct, threshold: classifyThreshold(usagePct) }
}

/**
 * Emit a Sentry envelope event via HTTP without requiring @sentry/nextjs.
 * Uses the Sentry Store API (single-event endpoint) which accepts a plain JSON event.
 */
async function emitSentryAlert(metric: QuotaMetric, dsn: string): Promise<void> {
  const levelMap: Record<QuotaMetric['threshold'], string> = {
    ok: 'info',
    warning: 'warning',
    critical: 'error',
    page: 'fatal',
  }

  // Parse DSN: https://<public-key>@<host>/<project-id>
  let ingestUrl: string
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\//, '')
    ingestUrl = `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_key=${url.username}&sentry_version=7`
  } catch {
    return // Invalid DSN — skip silently
  }

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    level: levelMap[metric.threshold],
    message: `[CF Quota] ${metric.name} at ${metric.usagePct}% (${metric.threshold.toUpperCase()})`,
    tags: {
      quota_metric: metric.name,
      quota_threshold: String(THRESHOLDS[metric.threshold as keyof typeof THRESHOLDS] ?? 0),
      usage_pct: String(metric.usagePct),
    },
    extra: {
      current: metric.current,
      limit: metric.limit,
      unit: metric.unit,
      usage_pct: metric.usagePct,
    },
    platform: 'node',
  }

  try {
    await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // Non-fatal — Sentry alert failure must not block quota check
  }
}

// ---------------------------------------------------------------------------
// CF GraphQL Analytics API queries
// ---------------------------------------------------------------------------

async function cfGraphQL(
  apiToken: string,
  accountId: string,
  query: string
): Promise<CfGraphQlResponse> {
  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!resp.ok) {
    return {}
  }

  return resp.json() as Promise<CfGraphQlResponse>
}

async function fetchWorkersRequests(
  apiToken: string,
  accountId: string,
  date: string
): Promise<number> {
  const json = await cfGraphQL(apiToken, accountId, `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        workersInvocationsAdaptive(
          limit: 1
          filter: {datetime_geq: "${date}T00:00:00Z", datetime_leq: "${date}T23:59:59Z"}
        ) {
          sum { requests }
        }
      }
    }
  }`)

  const rows = (json.data?.viewer?.accounts?.[0]?.['workersInvocationsAdaptive'] ?? []) as WorkersRow[]
  return rows.reduce((sum, r) => sum + (r.sum.requests ?? 0), 0)
}

async function fetchD1Ops(
  apiToken: string,
  accountId: string,
  date: string
): Promise<{ reads: number; writes: number }> {
  const json = await cfGraphQL(apiToken, accountId, `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        d1AnalyticsAdaptiveGroups(
          limit: 10
          filter: {date: "${date}"}
        ) {
          sum { readQueries writeQueries }
        }
      }
    }
  }`)

  const rows = (json.data?.viewer?.accounts?.[0]?.['d1AnalyticsAdaptiveGroups'] ?? []) as D1Row[]
  const reads = rows.reduce((s, r) => s + (r.sum.readQueries ?? 0), 0)
  const writes = rows.reduce((s, r) => s + (r.sum.writeQueries ?? 0), 0)
  return { reads, writes }
}

async function fetchR2StorageGb(
  apiToken: string,
  accountId: string,
  date: string
): Promise<number> {
  const json = await cfGraphQL(apiToken, accountId, `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        r2StorageAdaptiveGroups(
          limit: 1
          filter: {date: "${date}"}
          orderBy: [date_DESC]
        ) {
          max { payloadSize }
        }
      }
    }
  }`)

  const rows = (json.data?.viewer?.accounts?.[0]?.['r2StorageAdaptiveGroups'] ?? []) as R2Row[]
  const bytes = rows[0]?.max.payloadSize ?? 0
  return bytes / (1024 ** 3)
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function runQuotaCheck(): Promise<QuotaReport> {
  const apiToken = process.env['CLOUDFLARE_API_TOKEN']
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const sentryDsn = process.env['SENTRY_DSN']

  if (!apiToken || !accountId) {
    const report: QuotaReport = {
      timestamp: new Date().toISOString(),
      metrics: [],
      alerts: [],
      summary: 'SKIPPED: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set',
    }
    return report
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const [workersReqs, d1Ops, r2Gb] = await Promise.all([
    fetchWorkersRequests(apiToken, accountId, today),
    fetchD1Ops(apiToken, accountId, today),
    fetchR2StorageGb(apiToken, accountId, today),
  ])

  const metrics: QuotaMetric[] = [
    buildMetric('workers_requests_daily', workersReqs, LIMITS.workersRequestsPerDay, 'requests/day'),
    buildMetric('d1_reads_daily', d1Ops.reads, LIMITS.d1ReadsPerDay, 'reads/day'),
    buildMetric('d1_writes_daily', d1Ops.writes, LIMITS.d1WritesPerDay, 'writes/day'),
    buildMetric('r2_storage_gb', Math.round(r2Gb * 100) / 100, LIMITS.r2StorageGb, 'GB'),
  ]

  const alerts = metrics.filter((m) => m.threshold !== 'ok')

  // Emit Sentry events for each metric that crossed a threshold
  if (sentryDsn) {
    await Promise.all(alerts.map((alert) => emitSentryAlert(alert, sentryDsn)))
  }

  const lines = metrics.map(
    (m) =>
      `  ${m.threshold.toUpperCase().padEnd(8)} ${m.name}: ${m.current} / ${m.limit} ${m.unit} (${m.usagePct}%)`
  )
  const summary =
    alerts.length === 0
      ? `All ${metrics.length} CF quota metrics OK`
      : `${alerts.length} alert(s) — ${alerts.map((a) => `${a.name}@${a.usagePct}%`).join(', ')}`

  const report: QuotaReport = {
    timestamp: new Date().toISOString(),
    metrics,
    alerts,
    summary,
  }

  // Human summary to stdout (captured in cron logs)
  process.stdout.write(
    `\n[CF Quota Check] ${report.timestamp}\n${lines.join('\n')}\nSummary: ${summary}\n\n`
  )

  return report
}

// ---------------------------------------------------------------------------
// CLI entry point — when run directly with tsx
// ---------------------------------------------------------------------------
const isMain =
  process.argv[1]?.endsWith('check-cf-quota.ts') ||
  process.argv[1]?.endsWith('check-cf-quota.js')

if (isMain) {
  runQuotaCheck()
    .then((report) => {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n')
      const hasPageOrCritical = report.alerts.some(
        (a) => a.threshold === 'page' || a.threshold === 'critical'
      )
      process.exit(hasPageOrCritical ? 1 : 0)
    })
    .catch((err: unknown) => {
      process.stderr.write(`[CF Quota Check] Fatal: ${String(err)}\n`)
      process.exit(2)
    })
}
