/**
 * Customer Journey Checks
 * Simulates a customer walking through critical page flows.
 * Verifies correct 200s and auth redirects.
 *
 * @module lib/audit/checks/customer-journey
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface JourneyStep {
  path: string
  expectedStatus: number | number[]
  mustContain?: string
  description: string
}

const JOURNEY_STEPS: JourneyStep[] = [
  { path: '/', expectedStatus: 200, description: 'Landing page loads' },
  { path: '/vi/pricing', expectedStatus: 200, mustContain: 'Mua ngay', description: 'Pricing page with CTA' },
  { path: '/vi/login', expectedStatus: 200, description: 'Login page accessible' },
  { path: '/vi/dashboard', expectedStatus: [301, 302, 307, 308], description: 'Dashboard redirects to login (no auth)' },
  { path: '/vi/dashboard/sop-marketplace', expectedStatus: [301, 302, 307, 308], description: 'SOP marketplace redirects (no auth)' },
  { path: '/vi/dashboard/account', expectedStatus: [301, 302, 307, 308], description: 'Account redirects (no auth)' },
]

async function checkStep(
  baseUrl: string,
  step: JourneyStep,
): Promise<{ step: string; ok: boolean; actual: number; detail: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${baseUrl}${step.path}`, {
      redirect: 'manual',
      signal: controller.signal,
    })
    clearTimeout(timer)

    const expectedStatuses = Array.isArray(step.expectedStatus)
      ? step.expectedStatus
      : [step.expectedStatus]
    const statusOk = expectedStatuses.includes(res.status)

    let contentOk = true
    let detail = `HTTP ${res.status}`
    if (step.mustContain && statusOk) {
      const text = await res.text()
      contentOk = text.includes(step.mustContain)
      if (!contentOk) detail += ` — missing "${step.mustContain}" in body`
    }

    return { step: step.description, ok: statusOk && contentOk, actual: res.status, detail }
  } catch (err) {
    return { step: step.description, ok: false, actual: 0, detail: `Error: ${err instanceof Error ? err.message : 'timeout'}` }
  }
}

export async function runJourneyChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const results = await Promise.all(JOURNEY_STEPS.map((s) => checkStep(env.PROD_URL, s)))

  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length <= 1 ? 'warn' : 'fail'
  const evidence =
    failed.length === 0
      ? `All ${results.length} journey steps passed`
      : `${passed.length}/${results.length} passed. Issues: ${failed.map((r) => `${r.step} (${r.detail})`).join('; ')}`

  return [
    {
      id: 'customer-journey',
      category: 'Customer Journey',
      name: 'Critical Page Flow',
      status,
      weight: 8,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix: failed.length > 0 ? `Fix failing steps: ${failed.map((r) => r.step).join(', ')}` : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
