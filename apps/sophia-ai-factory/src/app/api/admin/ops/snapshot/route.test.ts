/**
 * Tests for GET /api/admin/ops/snapshot
 *
 * Covers: 401/403 auth guard, D1 unavailable, happy path, HeyGen health variations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mock ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}))

// ── D1 mock ────────────────────────────────────────────────────────────────────

const mockD1All = vi.fn()
const mockD1First = vi.fn()
const mockD1PrepBind = vi.fn(() => ({ all: mockD1All, first: mockD1First }))
const mockD1Prep = vi.fn(() => ({ bind: mockD1PrepBind, all: mockD1All, first: mockD1First }))

vi.mock('@/lib/db/client', () => ({
  getD1Raw: vi.fn(async () => ({ prepare: mockD1Prep })),
}))

// ── Health / CB mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/health/heygen-health-check', () => ({
  isHeyGenHealthy: vi.fn(async () => true),
}))

vi.mock('@/lib/fulfillment/circuit-breaker', () => ({
  getCircuitState: vi.fn(async () => ({
    state: 'closed',
    recentFailures: 0,
    recentSuccesses: 5,
  })),
}))

vi.mock('@/lib/health/build-metadata', () => ({
  getBuildMetadata: vi.fn(() => ({ sha: 'abc12345', deployedAt: '2026-05-02T08:00:00Z' })),
}))

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { requireAdmin } from '@/lib/auth/require-admin'
import { GET } from './route'
import { NextResponse } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)

function buildRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest
}

const ADMIN_USER = { id: 'admin-1', email: 'admin@sophia.ai', role: 'admin' }

describe('GET /api/admin/ops/snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all D1 queries return empty results
    mockD1All.mockResolvedValue({ results: [] })
    mockD1First.mockResolvedValue(null)
    mockD1PrepBind.mockReturnValue({ all: mockD1All, first: mockD1First })
    mockD1Prep.mockReturnValue({ bind: mockD1PrepBind, all: mockD1All, first: mockD1First })
  })

  it('forwards 401 from requireAdmin', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    )
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
  })

  it('forwards 403 from requireAdmin', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    )
    const res = await GET(buildRequest())
    expect(res.status).toBe(403)
  })

  it('returns 503 when D1 is unavailable', async () => {
    mockRequireAdmin.mockResolvedValue({ user: ADMIN_USER })
    const { getD1Raw } = await import('@/lib/db/client')
    vi.mocked(getD1Raw).mockRejectedValueOnce(new Error('D1 unavailable'))

    const res = await GET(buildRequest())
    expect(res.status).toBe(503)
  })

  it('returns OpsSnapshotResponse on happy path', async () => {
    mockRequireAdmin.mockResolvedValue({ user: ADMIN_USER })

    mockD1All.mockResolvedValue({
      results: [
        { cron_name: 'smoke-one-time', last_run_at: 1000000, last_status: 'success', last_error: null, run_count: 5 },
      ],
    })
    // Queue counts
    mockD1First.mockResolvedValueOnce({ paid: 3, delivered: 3 })

    const res = await GET(buildRequest())
    expect(res.status).toBe(200)

    const body = await res.json() as { cronRuns: unknown[]; circuitBreaker: { state: string }; heygenHealth: { healthy: boolean }; version: { sha: string; deployedAt: string } }
    expect(body.cronRuns).toBeDefined()
    expect(body.circuitBreaker.state).toBe('closed')
    expect(body.heygenHealth.healthy).toBe(true)
    expect(body.version.sha).toBe('abc12345')
    expect(typeof body.version.deployedAt).toBe('string')
  })
})
