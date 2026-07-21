/**
 * zigil — chain-id / lineage token for ultracode sessions.
 *
 * A zigil is a compact, opaque reference that ties together a conversation
 * session with the originating chain of agent actions.  It is intentionally
 * opaque; callers should treat it as an unguessable cursor rather than
 * an identity primitive.
 */

import crypto from 'crypto'

export interface Zigil {
  value: string
  chainId: string
  issuedAt: string
  scope: ZigilScope
}

export type ZigilScope = 'session' | 'workflow' | 'audit'

const ZIGIL_PREFIX = 'zg_'
const ZIGIL_VERSION = 0x01

export function createZigil(scope: ZigilScope = 'session'): Zigil {
  const chainId = randomHex(12)
  const issuedAt = new Date().toISOString()
  const payload = `${ZIGIL_VERSION}.${chainId}.${scope}.${issuedAt}`
  const sig = hmac(payload)

  return {
    value: `${ZIGIL_PREFIX}${base64Url(payload)}.${base64Url(sig)}`,
    chainId,
    issuedAt,
    scope,
  }
}

export function parseZigil(token: string): Zigil | null {
  if (!token.startsWith(ZIGIL_PREFIX)) return null

  const encoded = token.slice(ZIGIL_PREFIX.length)
  const [payloadB64, sigB64] = encoded.split('.')

  if (!payloadB64 || !sigB64) return null

  const expectedSig = base64UrlDecode(sigB64)
  const actualSig = hmac(base64UrlDecode(payloadB64))

  if (expectedSig !== actualSig) return null

  const payload = decodeUtf8(base64UrlDecode(payloadB64))
  const [version, chainId, scope, issuedAt] = payload.split('.')

  if (version !== String(ZIGIL_VERSION)) return null

  return { value: token, chainId, issuedAt, scope: scope as ZigilScope }
}

export function zigilChain(z: Zigil): string {
  return z.chainId
}

// ── primitives ──────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

function hmac(message: string): string {
  const keyBuf = new TextEncoder().encode('ultracode.zigil.v1')
  const enc = new TextEncoder().encode(message)
  const key = await crypto.subtle.importKey(
    'raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc)
  return b64(sig)
}

function base64Url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(normalized, 'base64')
}

function decodeUtf8(buf: Uint8Array): string {
  const decoder = new TextDecoder()
  return decoder.decode(buf)
}
