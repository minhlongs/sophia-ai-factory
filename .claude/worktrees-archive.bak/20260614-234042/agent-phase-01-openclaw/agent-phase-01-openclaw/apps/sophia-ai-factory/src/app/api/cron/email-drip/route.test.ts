/**
 * /api/cron/email-drip — smoke tests for auth gate, idempotency, and sweep counts.
 *
 * Detailed evaluator logic is covered in `forest/email/__tests__/lifecycle-email-rules.test.ts`;
 * these tests only verify the wiring (route exits cleanly, sweep counts surface in JSON).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/forest/outbox/email-outbox', () => ({
  enqueueWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/forest/email/week-stats', () => ({
  computeWeekStats: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/land/affiliates/dashboard-stats', () => ({
  getAffiliateClickStats: vi.fn().mockResolvedValue({
    totalClicks: 0,
    totalConversions: 0,
    totalCommissionUsd: 0,
    epc: 0,
  }),
}))

import { GET } from './route'
import { wasRecentlyRun } from '@/land/cron/run-tracker'

interface CronGlobal {
  __env?: { DB?: unknown }
}

function buildRequest(token?: string): NextRequest {
  const url = new URL('http://localhost/api/cron/email-drip')
  if (token) url.searchParams.set('token', token)
  return new NextRequest(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function buildEmptyD1() {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
  }
  return {
    prepare: vi.fn().mockReturnValue(prepared),
    batch: vi.fn(),
    exec: vi.fn(),
  }
}

describe('GET /api/cron/email-drip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    delete (globalThis as CronGlobal).__env
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (globalThis as CronGlobal).__env
  })

  it('returns 401 when CRON_SECRET missing', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
  })

  it('returns 503 when DB binding missing', async () => {
    const res = await GET(buildRequest('test-secret'))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('D1')
  })

  it('skips on recent idempotent run', async () => {
    ;(globalThis as CronGlobal).__env = { DB: buildEmptyD1() }
    vi.mocked(wasRecentlyRun).mockResolvedValueOnce(true)
    const res = await GET(buildRequest('test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; skipped: string }
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe('recent_run')
  })

  it('returns sweep counts (all zero on empty DB)', async () => {
    ;(globalThis as CronGlobal).__env = { DB: buildEmptyD1() }
    const res = await GET(buildRequest('test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      enqueued: number
      affiliateEnqueued: number
      activationEnqueued: number
      winBackEnqueued: number
    }
    expect(body.ok).toBe(true)
    expect(body.enqueued).toBe(0)
    expect(body.affiliateEnqueued).toBe(0)
    expect(body.activationEnqueued).toBe(0)
    expect(body.winBackEnqueued).toBe(0)
  })
})
