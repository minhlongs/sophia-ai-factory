/**
 * Authentication Middleware for RaaS Gateway Worker
 *
 * Handles JWT validation and API key verification at the edge.
 * Compatible with Cloudflare Workers runtime.
 */

interface JWTPayload {
  sub: string;          // API key ID
  iss: string;          // Issuer
  aud: string;          // Audience
  exp: number;          // Expiration
  iat: number;          // Issued at
  scope?: string;       // Permission scope
  tier?: string;        // User tier (BASIC/PREMIUM/ENTERPRISE)
}

interface Env {
  KV_KV: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET?: string;  // Secret for JWT signature verification
}

interface JWTHeader {
  alg: string;
  typ: string;
}

interface DecodedJwt {
  header: JWTHeader;
  payload: JWTPayload;
  signature: string;
}

// Base64url decode helper (edge-compatible)
function base64UrlDecode(input: string): Uint8Array {
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

// Base64url encode helper
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function base64UrlEncode(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Decode JWT without verification (for getting header/payload)
function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as JWTHeader;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as JWTPayload;

  return { header, payload, signature: parts[2] };
}

/**
 * Verify JWT signature using HMAC-SHA256
 * Uses Web Crypto API for secure verification
 */
async function verifyJwtSignature(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode the signature
    const signatureBytes = base64UrlDecode(signatureB64);

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      data
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Verify JWT token with signature verification
 * Validates signature, expiration, and API key existence
 */
export async function verifyJwt(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    // Decode without verification first to check format
    const { payload } = decodeJwt(token);

    // CRITICAL: Verify JWT signature if secret is configured
    if (env.JWT_SECRET) {
      const signatureValid = await verifyJwtSignature(token, env.JWT_SECRET);
      if (!signatureValid) {
        return null;
      }
    }

    // Check expiration
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    // Validate API key exists in KV
    const apiKeyValid = await validateApiKey(payload.sub, env.KV_KV);
    if (!apiKeyValid) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate mk_ prefixed API key format and existence
 */
export async function validateApiKey(apiKey: string, kv: KVNamespace): Promise<boolean> {
  // Format validation: must start with mk_
  if (!apiKey || !apiKey.startsWith('mk_')) {
    return false;
  }

  // Check if key exists in KV (marked as active)
  try {
    const keyStatus = await kv.get(`api_key:${apiKey}`);
    return keyStatus === 'active';
  } catch {
    return false;
  }
}

/**
 * Extract and validate API key from request headers
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fallback: check X-API-Key header
  return request.headers.get('X-API-Key');
}

/**
 * Verify API key has required scope
 */
export function hasScope(payload: JWTPayload, requiredScope: string): boolean {
  if (!payload.scope) {
    return false;
  }

  const scopes = payload.scope.split(' ');
  return scopes.includes(requiredScope) || scopes.includes('*');
}

/**
 * Get tier from JWT payload with validation
 */
export function getTier(payload: JWTPayload): 'BASIC' | 'PREMIUM' | 'ENTERPRISE' {
  const tier = payload.tier?.toUpperCase();

  if (tier === 'BASIC' || tier === 'PREMIUM' || tier === 'ENTERPRISE') {
    return tier;
  }

  return 'BASIC'; // Default fallback
}
