/**
 * Performance Checks
 * Measures TTFB and response size for critical pages.
 *
 * @module lib/audit/checks/performance
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface PerfTarget {
  path: string
  maxTtfbMs: number
  maxSizeKb: number
  description: string
}

const PERF_TARGETS: PerfTarget[] = [
  { path: '/', maxTtfbMs: 2000, maxSizeKb: 500, description: 'Landing page' },
  { path: '/vi/pricing', maxTtfbMs: 2000, maxSizeKb: 500, description: 'Pricing page' },
  { path: '/api/health/heygen', maxTtfbMs: 5000, maxSizeKb: 10, description: 'HeyGen health' },
  { path: '/api/version', maxTtfbMs: 500, maxSizeKb: 5, description: 'Version endpoint' },
]

interface PerfResult {
  path: string
  ttfbMs: number
  sizeKb: number
  ttfbOk: boolean
  sizeOk: boolean
  ok: boolean
  detail: string
}

async function measurePerf(baseUrl: string, target: PerfTarget): Promise<PerfResult> {
  const t0 = Date.now()
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), target.maxTtfbMs + 2000)
    const res = await fetch(`${baseUrl}${target.path}`, { signal: controller.signal })
    const ttfbMs = Date.now() - t0
    const body = await res.arrayBuffer()
    const sizeKb = body.byteLength / 1024

    const ttfbOk = ttfbMs <= target.maxTtfbMs
    const sizeOk = sizeKb <= target.maxSizeKb
    const ok = ttfbOk && sizeOk

    return {
      path: target.path,
      ttfbMs,
      sizeKb: Math.round(sizeKb),
      ttfbOk,
      sizeOk,
      ok,
      detail: `TTFB: ${ttfbMs}ms (max: ${target.maxTtfbMs}ms), Size: ${Math.round(sizeKb)}KB (max: ${target.maxSizeKb}KB)`,
    }
  } catch {
    return {
      path: target.path,
      ttfbMs: 9999,
      sizeKb: 0,
      ttfbOk: false,
      sizeOk: true,
      ok: false,
      detail: 'Request timeout or error',
    }
  }
}

export async function runPerfChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const results = await Promise.all(PERF_TARGETS.map((t) => measurePerf(env.PROD_URL, t)))

  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length <= 1 ? 'warn' : 'fail'
  const evidence =
    failed.length === 0
      ? `All ${results.length} performance targets met. ${results.map((r) => `${r.path}: ${r.ttfbMs}ms`).join(', ')}`
      : `${passed.length}/${results.length} within targets. Issues: ${failed.map((r) => `${r.path}: ${r.detail}`).join('; ')}`

  return [
    {
      id: 'performance',
      category: 'Performance',
      name: 'TTFB & Response Size',
      status,
      weight: 6,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix:
        failed.length > 0
          ? `Optimize slow/large pages: ${failed.map((r) => r.path).join(', ')}. Check edge caching, image sizes.`
          : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
