/**
 * Web Crypto HMAC-SHA256 Token Signing & Verification
 * Layer: tree/sales/sandbox
 */

import { logger } from '@/seed/utils/logger-utility'
import { DEFAULT_SECRET } from './types'

/**
 * Creates an HMAC-SHA256 signature using the Web Crypto API.
 */
export async function signHmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(message))
  return Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generates a signed, URL-safe base64 demo access token with embedded payload and HMAC.
 */
export async function generateSandboxToken(
  payload: { dealId: string; subaccountId: string; expiresAt: number },
  secret: string = DEFAULT_SECRET
): Promise<string> {
  const serialized = JSON.stringify(payload)
  const base64Payload = btoa(serialized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const signature = await signHmacSha256(base64Payload, secret)
  return `${base64Payload}.${signature}`
}

/**
 * Verifies and decodes a signed demo access token.
 */
export async function verifySandboxToken(
  token: string,
  secret: string = DEFAULT_SECRET
): Promise<{
  valid: boolean;
  expired: boolean;
  payload?: { dealId: string; subaccountId: string; expiresAt: number };
}> {
  try {
    const [base64Payload, signature] = token.split('.')
    if (!base64Payload || !signature) {
      return { valid: false, expired: false }
    }

    const expectedSig = await signHmacSha256(base64Payload, secret)
    if (signature !== expectedSig) {
      return { valid: false, expired: false }
    }

    let str = base64Payload.replace(/-/g, '+').replace(/_/g, '/')
    while (str.length % 4) str += '='
    const decoded = atob(str)
    const payload = JSON.parse(decoded) as { dealId: string; subaccountId: string; expiresAt: number }

    const isExpired = Date.now() > payload.expiresAt
    return { valid: !isExpired, expired: isExpired, payload }
  } catch (err) {
    logger.warn('[sandbox-provisioner] Token verification failed', { error: String(err) })
    return { valid: false, expired: false }
  }
}
