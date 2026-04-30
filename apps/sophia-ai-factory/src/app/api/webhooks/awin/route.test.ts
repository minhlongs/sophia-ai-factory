/**
 * Tests for Awin webhook handler
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

const SECRET = 'awin-test-secret'
const PAYLOAD = JSON.stringify({ id: 'AW-TX-001', sale_amount: 200, commission_amount: 14 })

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/awin', {
    method: 'POST',
    body,
    headers: { 'x-awin-signature': sig, 'content-type': 'application/json' },
  })
}

function setD1Mock({ isDuplicate = false }: { isDuplicate?: boolean } = {}) {
  // rows_written=0 means INSERT OR IGNORE hit a duplicate constraint
  const mockRun = vi.fn().mockResolvedValue({
    success: true,
    meta: { rows_written: isDuplicate ? 0 : 1 },
  })
  const mockFirst = vi.fn().mockResolvedValue(null)
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst })
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = {
    prepare: vi.fn().mockReturnValue({ bind: mockBind }),
  }
  return { mockRun }
}

describe('POST /api/webhooks/awin', () => {
  beforeEach(() => {
    vi.stubEnv('AWIN_WEBHOOK_SECRET', SECRET)
    setD1Mock()
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 200 for valid signature', async () => {
    const sig = await hmacSha256Hex(PAYLOAD, SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    expect(res.status).toBe(200)
  })

  it('returns 401 for bad signature', async () => {
    const res = await POST(makeRequest(PAYLOAD, 'bad'))
    expect(res.status).toBe(401)
  })

  it('skips duplicate transaction', async () => {
    const { mockRun } = setD1Mock({ isDuplicate: true })
    const sig = await hmacSha256Hex(PAYLOAD, SECRET)
    const res = await POST(makeRequest(PAYLOAD, sig))
    const body = await res.json() as { ok: boolean; skipped?: string }
    expect(body.skipped).toBe('duplicate')
    // INSERT OR IGNORE is still called — dedup via rows_written=0
    expect(mockRun).toHaveBeenCalled()
  })
})
