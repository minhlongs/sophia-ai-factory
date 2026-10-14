/**
 * Authentication Middleware for RaaS Gateway Worker
 *
 * Handles JWT validation and API key verification at the edge.
 * Compatible with Cloudflare Workers runtime.
 */

import {
  decodeJwt,
  verifyJwtSignature,
  type JWTPayload,
} from './auth-jwt-crypto';

interface Env {
  KV_KV: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET?: string;  // Secret for JWT signature verification
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
