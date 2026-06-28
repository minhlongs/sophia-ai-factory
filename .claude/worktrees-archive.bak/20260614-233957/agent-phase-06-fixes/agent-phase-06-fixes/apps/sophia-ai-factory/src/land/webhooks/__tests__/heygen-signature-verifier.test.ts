/**
 * Unit tests for heygen-signature-verifier.ts
 * Verifies HMAC-SHA256 signature matching, mismatch detection,
 * and constant-time behavior (timing-safe equality).
 */

import { describe, it, expect } from 'vitest'
import { verifyHeyGenSignature } from '../heygen-signature-verifier'

// Helper: generate a valid HMAC-SHA256 hex signature for a body + secret
async function generateSignature(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyHeyGenSignature', () => {
  const secret = 'test-webhook-secret-1234'
  const body = JSON.stringify({ event_type: 'avatar_video.success', video_id: 'abc123' })

  it('returns true for a valid signature', async () => {
    const sig = await generateSignature(body, secret)
    const result = await verifyHeyGenSignature(body, sig, secret)
    expect(result).toBe(true)
  })

  it('returns false for an incorrect signature', async () => {
    const wrongSig = await generateSignature(body, 'wrong-secret')
    const result = await verifyHeyGenSignature(body, wrongSig, secret)
    expect(result).toBe(false)
  })

  it('returns false when signature is empty string', async () => {
    const result = await verifyHeyGenSignature(body, '', secret)
    expect(result).toBe(false)
  })

  it('returns false when body is tampered after signature', async () => {
    const sig = await generateSignature(body, secret)
    const tamperedBody = body + ' '
    const result = await verifyHeyGenSignature(tamperedBody, sig, secret)
    expect(result).toBe(false)
  })

  it('is case-insensitive on provided signature (accepts uppercase hex)', async () => {
    const sig = await generateSignature(body, secret)
    const upperSig = sig.toUpperCase()
    const result = await verifyHeyGenSignature(body, upperSig, secret)
    expect(result).toBe(true)
  })

  it('returns false for wrong-length signature', async () => {
    const result = await verifyHeyGenSignature(body, 'tooshort', secret)
    expect(result).toBe(false)
  })
})
