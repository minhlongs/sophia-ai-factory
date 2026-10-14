/**
 * Edge-compatible Base64URL, JWT decoding, and HMAC-SHA256 verification helpers
 * for RaaS Gateway Worker Auth Middleware.
 * @module forest/worker/lib/auth-jwt-crypto
 */

export interface JWTPayload {
  sub: string;          // API key ID
  iss: string;          // Issuer
  aud: string;          // Audience
  exp: number;          // Expiration
  iat: number;          // Issued at
  scope?: string;       // Permission scope
  tier?: string;        // User tier (BASIC/PREMIUM/ENTERPRISE)
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface DecodedJwt {
  header: JWTHeader;
  payload: JWTPayload;
  signature: string;
}

export function base64UrlDecode(input: string): Uint8Array {
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as JWTHeader;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as JWTPayload;

  return { header, payload, signature: parts[2] };
}

/**
 * Verify JWT signature using HMAC-SHA256 via Web Crypto API.
 */
export async function verifyJwtSignature(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureBytes = base64UrlDecode(signatureB64);

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      data,
    );
  } catch {
    return false;
  }
}
