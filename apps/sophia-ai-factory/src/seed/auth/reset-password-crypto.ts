/**
 * Web Crypto HMAC-SHA256 and Base64URL primitives for password reset tokens.
 *
 * Layer: seed/auth
 * Compatible with Cloudflare Workers (Web Crypto only, no Node crypto).
 *
 * @module seed/auth/reset-password-crypto
 */

export const TOKEN_TTL_SECONDS = 3600; // 1 hour
const ENC = new TextEncoder();

export interface ResetTokenPayload {
  userId: string;
  jti: string;
  exp: number; // Unix epoch seconds
}

/** Minimal D1 binding interface for token operations */
export interface D1Binding {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
}

export function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('BETTER_AUTH_SECRET must be set');
  return s;
}

export function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function fromBase64Url(str: string): string {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function hmacVerify(payload: string, hex: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ hex.charCodeAt(i);
  }
  return diff === 0;
}
