/**
 * Provider Connectivity Checks
 * Tests that each external provider API is reachable and key is valid.
 *
 * @module lib/audit/checks/provider-connectivity
 */

import type { CheckResult, AuditEnv } from '../zero-gap-types'

interface ProviderResult {
  name: string
  ok: boolean
  detail: string
}

async function checkHeyGen(apiKey?: string): Promise<ProviderResult> {
  if (!apiKey) return { name: 'HeyGen', ok: false, detail: 'HEYGEN_API_KEY not configured' }
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 8000)
    const res = await fetch('https://api.heygen.com/v2/voices?limit=1', {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal,
    })
    return { name: 'HeyGen', ok: res.status === 200, detail: `HTTP ${res.status}` }
  } catch {
    return { name: 'HeyGen', ok: false, detail: 'Connection timeout or refused' }
  }
}

async function checkResend(apiKey?: string): Promise<ProviderResult> {
  if (!apiKey) return { name: 'Resend', ok: false, detail: 'RESEND_API_KEY not configured' }
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 8000)
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    return { name: 'Resend', ok: res.status === 200, detail: `HTTP ${res.status}` }
  } catch {
    return { name: 'Resend', ok: false, detail: 'Connection timeout or refused' }
  }
}

async function checkNowPayments(): Promise<ProviderResult> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 8000)
    const res = await fetch('https://api.nowpayments.io/v1/status', { signal: controller.signal })
    return { name: 'NOWPayments', ok: res.status === 200, detail: `HTTP ${res.status}` }
  } catch {
    return { name: 'NOWPayments', ok: false, detail: 'Connection timeout or refused' }
  }
}

async function checkSupabase(serviceKey?: string): Promise<ProviderResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return { name: 'Supabase', ok: false, detail: 'SUPABASE_SERVICE_KEY or URL not configured' }
  }
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: controller.signal,
    })
    return { name: 'Supabase', ok: res.status < 500, detail: `HTTP ${res.status}` }
  } catch {
    return { name: 'Supabase', ok: false, detail: 'Connection timeout or refused' }
  }
}

export async function runProviderChecks(env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()
  const results = await Promise.all([
    checkHeyGen(env.HEYGEN_API_KEY),
    checkResend(env.RESEND_API_KEY),
    checkNowPayments(),
    checkSupabase(env.SUPABASE_SERVICE_KEY),
  ])

  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const status = failed.length === 0 ? 'pass' : failed.length === 1 ? 'warn' : 'fail'
  const evidence =
    failed.length === 0
      ? `All ${results.length} providers reachable`
      : `${passed.length}/${results.length} reachable. Issues: ${failed.map((r) => `${r.name}: ${r.detail}`).join('; ')}`

  return [
    {
      id: 'provider-connectivity',
      category: 'Provider Connectivity',
      name: 'External API Providers',
      status,
      weight: 9,
      score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
      evidence,
      fix: failed.length > 0 ? `Configure/check: ${failed.map((r) => r.name).join(', ')}` : undefined,
      durationMs: Date.now() - start,
    },
  ]
}
