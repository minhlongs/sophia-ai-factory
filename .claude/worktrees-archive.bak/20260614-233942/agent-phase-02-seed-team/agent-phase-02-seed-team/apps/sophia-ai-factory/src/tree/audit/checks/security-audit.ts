/**
 * Security Audit Checks
 * Probes security gates: auth on cron/admin routes, verifies no bypass.
 *
 * @module lib/audit/checks/security-audit
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface SecurityProbe {
  name: string
  description: string
  check: (baseUrl: string) => Promise<{ ok: boolean; detail: string }>
}

const PROBES: SecurityProbe[] = [
  {
    name: 'cron-no-anon-access',
    description: 'Fulfillment retry cron rejects random Bearer token',
    check: async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/api/cron/fulfillment-retry`, {
          method: 'POST',
          headers: { Authorization: 'Bearer invalid-random-token-xyz-123' },
          signal: AbortSignal.timeout(8000),
        })
        return { ok: res.status === 401, detail: `HTTP ${res.status} (expected 401)` }
      } catch {
        return { ok: false, detail: 'Request failed' }
      }
    },
  },
  {
    name: 'admin-synthetic-ipn-no-anon',
    description: 'Admin synthetic IPN rejects unauthenticated request',
    check: async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/api/admin/synthetic-ipn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true }),
          signal: AbortSignal.timeout(8000),
        })
        return { ok: [401, 403, 405].includes(res.status), detail: `HTTP ${res.status} (expected 401/403/405)` }
      } catch {
        return { ok: false, detail: 'Request failed' }
      }
    },
  },
  {
    name: 'missions-api-requires-key',
    description: '/api/v1/missions rejects request without API key',
    check: async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/missions`, {
          signal: AbortSignal.timeout(8000),
        })
        return { ok: res.status === 401, detail: `HTTP ${res.status} (expected 401)` }
      } catch {
        return { ok: false, detail: 'Request failed' }
      }
    },
  },
  {
    name: 'required-env-vars-set',
    description: 'Critical environment secrets are configured',
    check: async (_baseUrl) => {
      const required = ['HEYGEN_API_KEY', 'RESEND_API_KEY', 'CRON_SECRET', 'CREDENTIALS_MASTER_KEY']
      const missing = required.filter((k) => !process.env[k])
      return {
        ok: missing.length === 0,
        detail: missing.length === 0 ? 'All required env vars set' : `Missing: ${missing.join(', ')}`,
      }
    },
  },
  {
    name: 'admin-routes-require-auth',
    description: 'Admin audit history requires authentication',
    check: async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/api/admin/audit/history`, {
          signal: AbortSignal.timeout(8000),
        })
        return { ok: [401, 403].includes(res.status), detail: `HTTP ${res.status} (expected 401/403)` }
      } catch {
        return { ok: false, detail: 'Request failed' }
      }
    },
  },
]

export async function runSecurityChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const results = await Promise.all(PROBES.map(async (p) => {
    const result = await p.check(env.PROD_URL)
    return { name: p.name, description: p.description, ...result }
  }))

  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length <= 1 ? 'warn' : 'fail'
  const evidence =
    failed.length === 0
      ? `All ${results.length} security gates verified`
      : `${passed.length}/${results.length} secure. Issues: ${failed.map((r) => `${r.description}: ${r.detail}`).join('; ')}`

  return [
    {
      id: 'security-audit',
      category: 'Security',
      name: 'Auth Gates & Secret Management',
      status,
      weight: 10,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix: failed.length > 0 ? `Critical: fix security gates for: ${failed.map((r) => r.name).join(', ')}` : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
