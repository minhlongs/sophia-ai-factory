/**
 * Endpoint Contract Checks
 * Probes ~20 critical API routes and verifies expected HTTP status codes.
 *
 * @module lib/audit/checks/endpoint-contract
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface EndpointSpec {
  path: string
  expectedStatus: number
  method?: string
  description: string
}

const ENDPOINTS: EndpointSpec[] = [
  { path: '/api/version', expectedStatus: 200, description: 'Version endpoint' },
  { path: '/api/health/heygen', expectedStatus: 200, description: 'HeyGen health check' },
  { path: '/api/v1/missions', expectedStatus: 401, description: 'Missions list (no key)' },
  { path: '/api/sop/templates', expectedStatus: 401, description: 'SOP templates (no auth)' },
  { path: '/api/admin/go-live-status', expectedStatus: 401, description: 'Go-live status (no auth)' },
  { path: '/api/admin/violations', expectedStatus: 401, description: 'Admin violations (no auth)' },
  { path: '/api/admin/audit/history', expectedStatus: 401, description: 'Audit history (no auth)' },
  { path: '/api/admin/audit/run', expectedStatus: 401, method: 'POST', description: 'Audit run (no auth)' },
  { path: '/api/cron/fulfillment-retry', expectedStatus: 401, description: 'Cron fulfillment (GET → 401)' },
  { path: '/api/cron/video-status-sync', expectedStatus: 401, description: 'Cron video sync (GET → 401)' },
  { path: '/api/cron/uptime-check', expectedStatus: 401, description: 'Cron uptime (GET → 401)' },
  { path: '/api/webhooks/nowpayments', expectedStatus: 405, method: 'GET', description: 'NOWPayments webhook (GET not allowed)' },
  { path: '/api/auth/session', expectedStatus: 401, description: 'Auth session (unauthenticated → 401)' },
  { path: '/', expectedStatus: 200, description: 'Landing page' },
  { path: '/vi/pricing', expectedStatus: 200, description: 'Pricing page (vi)' },
  { path: '/vi/login', expectedStatus: 200, description: 'Login page (vi)' },
]

async function probeEndpoint(
  baseUrl: string,
  spec: EndpointSpec,
): Promise<{ path: string; actual: number; expected: number; ok: boolean }> {
  const url = `${baseUrl}${spec.path}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      method: spec.method ?? 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { path: spec.path, actual: res.status, expected: spec.expectedStatus, ok: res.status === spec.expectedStatus }
  } catch {
    return { path: spec.path, actual: 0, expected: spec.expectedStatus, ok: false }
  }
}

export async function runEndpointChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const results = await Promise.all(ENDPOINTS.map((s) => probeEndpoint(env.PROD_URL, s)))

  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length <= 3 ? 'warn' : 'fail'
  const failedList = failed.map((r) => `${r.path} → ${r.actual} (expected ${r.expected})`).join(', ')
  const evidence =
    failed.length === 0
      ? `All ${results.length} endpoints returned expected status codes`
      : `${passed.length}/${results.length} passed. Failed: ${failedList}`

  return [
    {
      id: 'endpoint-contract',
      category: 'Endpoint Contract',
      name: 'API Routes Status Codes',
      status,
      weight: 9,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix:
        failed.length > 0
          ? `Check routes: ${failed.map((r) => r.path).join(', ')} — verify they exist and auth gates work correctly`
          : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
