/**
 * Tests for TikTok Shop webhook handler
 *
 * Covers: HMAC valid/invalid, idempotency, missing config
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

async function hmacSha256Hex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const WEBHOOK_SECRET = 'tiktok-test-secret'
const ORDER_PAYLOAD = JSON.stringify({ order_id: 'TT-ORDER-001', settlement_amount: 50, commission_amount: 6 })

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/tiktok-shop', {
    method: 'POST',
    body,
    headers: { 'x-tts-signature': sig, 'content-type': 'application/json' },
  })
}

type D1Mock = {
  prepare: ReturnType<typeof vi.fn>
  _mockRun?: ReturnType<typeof vi.fn>
  _mockFirst?: ReturnType<typeof vi.fn>
}

function setD1Mock({ existingRow = null }: { existingRow?: unknown }) {
  const mockRun = vi.fn().mockResolvedValue({ success: true })
  const mockFirst = vi.fn().mockResolvedValue(existingRow)
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst })
  const d1Mock: D1Mock = { prepare: vi.fn().mockReturnValue({ bind: mockBind }), _mockRun: mockRun, _mockFirst: mockFirst }
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = d1Mock
  return { mockRun, mockFirst }
}

describe('POST /api/webhooks/tiktok-shop', () => {
  beforeEach(() => {
    vi.stubEnv('TIKTOK_SHOP_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('SOPHIA_TENANT_ID', 'sophia-global')
    setD1Mock({ existingRow: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 200 for valid HMAC signature', async () => {
    const sig = await hmacSha256Hex(ORDER_PAYLOAD, WEBHOOK_SECRET)
    const res = await POST(makeRequest(ORDER_PAYLOAD, sig))
    expect(res.status).toBe(200)
  })

  it('returns 401 for invalid HMAC signature', async () => {
    const res = await POST(makeRequest(ORDER_PAYLOAD, 'bad-signature'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with skipped:config when secret missing', async () => {
    vi.unstubAllEnvs()
    const res = await POST(makeRequest(ORDER_PAYLOAD, 'anything'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('config')
  })

  it('returns 200 with skipped:duplicate for replay', async () => {
    const { mockRun } = setD1Mock({ existingRow: { 1: 1 } })
    const sig = await hmacSha256Hex(ORDER_PAYLOAD, WEBHOOK_SECRET)
    const res = await POST(makeRequest(ORDER_PAYLOAD, sig))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('duplicate')
    expect(mockRun).not.toHaveBeenCalled()
  })
})
