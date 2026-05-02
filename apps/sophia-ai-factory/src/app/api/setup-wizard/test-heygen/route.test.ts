/**
 * Tests for POST /api/setup-wizard/test-heygen
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 400 on missing api_key
 *  - 200 on valid key (HeyGen returns 200)
 *  - 422 on invalid key (HeyGen returns 401)
 *  - 502 on network error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/better-auth-session'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/setup-wizard/test-heygen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/setup-wizard/test-heygen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(buildRequest({ api_key: 'hk_test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on missing api_key', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' } as Awaited<ReturnType<typeof getCurrentUser>>)
    const { POST } = await import('./route')
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 200 when HeyGen accepts the key', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { POST } = await import('./route')
    const res = await POST(buildRequest({ api_key: 'hk_valid' }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 422 when HeyGen rejects the key (401)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    const { POST } = await import('./route')
    const res = await POST(buildRequest({ api_key: 'hk_invalid' }))
    expect(res.status).toBe(422)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(false)
  })

  it('returns 502 on network error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const { POST } = await import('./route')
    const res = await POST(buildRequest({ api_key: 'hk_test' }))
    expect(res.status).toBe(502)
  })
})
