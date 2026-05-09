/**
 * Tests for POST /api/canary/webhook
 *
 * Canary endpoint validates incoming signed payloads and returns
 * verification details without rejecting on bad sig (diagnostic mode).
 *
 * @module app/api/canary/webhook/route.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  withRateLimit: vi.fn((handler: (r: Request) => Promise<Response>) => handler),
}))

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }))
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: mocks.withRateLimit,
}))

import { POST } from './route'

const SECRET = 'canary-test-secret-32bytes-long!!'
const BODY = JSON.stringify({ event: 'test.ping', ts: 1234567890 })

/** Sign body with unified `t=<ts>,v1=<hex>` format */
async function signUnified(body: string, secret: string, ts?: number): Promise<string> {
  const timestamp = ts ?? Math.floor(Date.now() / 1000)
  const toSign = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
  const hex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}

/** Sign body with legacy bare-hex format (HMAC over raw body, no timestamp) */
async function signLegacy(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function makeRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['x-sophia-signature'] = signature
  return new Request('http://localhost/api/canary/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/canary/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CANARY_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    delete process.env.CANARY_WEBHOOK_SECRET
  })

  it('valid unified sig → 200, valid=true, format=unified', async () => {
    const sig = await signUnified(BODY, SECRET)
    const req = makeRequest(BODY, sig)
    const res = await POST(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json() as { valid: boolean; format: string }
    expect(json.valid).toBe(true)
    expect(json.format).toBe('unified')
  })

  it('bad sig (wrong secret) → 200, valid=false', async () => {
    const sig = await signUnified(BODY, 'wrong-secret-!!!!!!!!!!!!!!!!!!')
    const req = makeRequest(BODY, sig)
    const res = await POST(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json() as { valid: boolean }
    expect(json.valid).toBe(false)
  })

  it('expired timestamp (>5min skew) → 200, valid=false, skewMs reported', async () => {
    const oldTs = Math.floor(Date.now() / 1000) - 400  // 400s ago = >300s tolerance
    const sig = await signUnified(BODY, SECRET, oldTs)
    const req = makeRequest(BODY, sig)
    const res = await POST(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json() as { valid: boolean; skewMs: number; ageMs: number }
    expect(json.valid).toBe(false)
    expect(json.skewMs).toBeGreaterThan(300_000)  // > 300 seconds in ms
    expect(json.ageMs).toBeGreaterThan(300_000)
  })

  it('missing signature header → 400', async () => {
    const req = makeRequest(BODY)  // no signature header
    const res = await POST(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const json = await res.json() as { code: string }
    expect(json.code).toBe('MISSING_SIGNATURE')
  })

  it('legacy bare-hex format → 200, valid=true, format=legacy, warning logged', async () => {
    const legacySig = await signLegacy(BODY, SECRET)
    const req = makeRequest(BODY, legacySig)
    const res = await POST(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json() as { valid: boolean; format: string }
    expect(json.valid).toBe(true)
    expect(json.format).toBe('legacy')
    // Verify legacy monitoring hook fired
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'webhook_legacy_signature_used',
      expect.objectContaining({ event: 'webhook_legacy_signature_used' })
    )
  })
})
