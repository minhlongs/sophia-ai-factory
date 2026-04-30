/**
 * Tests for /api/cron/llm-cache-purge — Phase 4E.3.
 *
 * Covers: CRON_SECRET auth / missing DB binding / successful DELETE /
 * D1 throws (never pages founder).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET, POST } from './route'

interface GlobalWithDB {
  DB?: unknown
}

function buildRequest(auth?: string): NextRequest {
  const headers = new Headers(auth ? { authorization: auth } : {})
  return { headers } as unknown as NextRequest
}

function buildMockDb(changes: number | Error) {
  const run =
    changes instanceof Error
      ? vi.fn().mockRejectedValue(changes)
      : vi.fn().mockResolvedValue({ meta: { changes } })
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ run }),
    }),
  }
}

describe('GET/POST /api/cron/llm-cache-purge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    delete (globalThis as GlobalWithDB).DB
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (globalThis as GlobalWithDB).DB
  })

  it('returns 401 when CRON_SECRET header missing in production', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('Unauthorized')
  })

  it('returns 200 ok:false when DB binding is missing', async () => {
    const res = await POST(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string }
    expect(body).toEqual({ ok: false, reason: 'D1_UNAVAILABLE' })
  })

  it('returns {ok:true, deleted:N} on successful DELETE', async () => {
    ;(globalThis as GlobalWithDB).DB = buildMockDb(7)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; deleted: number; ts: string }
    expect(body.ok).toBe(true)
    expect(body.deleted).toBe(7)
    expect(typeof body.ts).toBe('string')
  })

  it('returns 200 ok:false when D1 throws (fire-and-forget semantics)', async () => {
    ;(globalThis as GlobalWithDB).DB = buildMockDb(new Error('D1 offline'))

    const res = await POST(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string; error: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('D1_ERROR')
    expect(body.error).toBe('D1 offline')
  })
})
