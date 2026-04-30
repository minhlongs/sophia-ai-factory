/**
 * Tests for AccessTrade webhook handler
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

const WEBHOOK_SECRET = 'at-test-secret'
const PAYLOAD = JSON.stringify({ conversion_id: 'AT-CONV-001', order_value: 100, commission: 8, status: 'approved' })

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/accesstrade', {
    method: 'POST',
    body,
    headers: { 'x-accesstrade-signature': sig, 'content-type': 'application/json' },
  })
}

function setD1Mock({ existingRow = null }: { existingRow?: unknown }) {
  const mockRun = vi.fn().mockResolvedValue({ success: true })
  const mockFirst = vi.fn().mockResolvedValue(existingRow)
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst })
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = {
    prepare: vi.fn().mockReturnValue({ bind: mockBind }),
  }
  return { mockRun }
}

describe('POST /api/webhooks/accesstrade', () => {
  beforeEach(() => {
    vi.stubEnv('ACCESSTRADE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('SOPHIA_TENANT_ID', 'sophia-global')
    setD1Mock({ existingRow: null })
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 200 for valid signature', async () => {
    const sig = await hmacSha256Hex(PAYLOAD, WEBHOOK_SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 401 for invalid signature', async () => {
    const res = await POST(makeRequest(PAYLOAD, 'wrong'))
    expect(res.status).toBe(401)
  })

  it('is idempotent: returns 200 skipped:duplicate on replay', async () => {
    const { mockRun } = setD1Mock({ existingRow: { 1: 1 } })
    const sig = await hmacSha256Hex(PAYLOAD, WEBHOOK_SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('duplicate')
    expect(mockRun).not.toHaveBeenCalled()
  })
})
