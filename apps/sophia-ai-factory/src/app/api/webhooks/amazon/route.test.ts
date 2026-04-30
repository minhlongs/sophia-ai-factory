/**
 * Tests for Amazon webhook handler
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

const SECRET = 'amazon-test-secret'
const PAYLOAD = JSON.stringify({ order_id: 'AMZ-ORD-001', revenue: 80, commission: 3.2, status: 'shipped' })

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/amazon', {
    method: 'POST',
    body,
    headers: { 'x-amazon-signature': sig, 'content-type': 'application/json' },
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

describe('POST /api/webhooks/amazon', () => {
  beforeEach(() => {
    vi.stubEnv('AMAZON_WEBHOOK_SECRET', SECRET)
    setD1Mock({ existingRow: null })
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 200 for valid HMAC', async () => {
    const sig = await hmacSha256Hex(PAYLOAD, SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    expect(res.status).toBe(200)
  })

  it('returns 401 for bad HMAC', async () => {
    const res = await POST(makeRequest(PAYLOAD, 'bad-sig'))
    expect(res.status).toBe(401)
  })

  it('skips duplicate order_id', async () => {
    const { mockRun } = setD1Mock({ existingRow: { 1: 1 } })
    const sig = await hmacSha256Hex(PAYLOAD, SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('duplicate')
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('returns 200 with skipped:config when secret missing', async () => {
    vi.unstubAllEnvs()
    const res = await POST(makeRequest(PAYLOAD, 'any'))
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('config')
  })
})
