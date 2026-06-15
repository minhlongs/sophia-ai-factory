/**
 * Header extraction and KV cache lookups for RaaS Auth Middleware
 * @module worker/middleware/raas-auth-middleware-kv
 */

/// <reference types="@cloudflare/workers-types" />

import { logger } from '@/seed/utils/logger-utility'
import { API_KEY_HEADER, BEARER_PREFIX } from './raas-auth-middleware-types'

export function extractApiKey(request: Request): string | null {
  return request.headers.get(API_KEY_HEADER)
}

export function extractJwt(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) return null
  return authHeader.slice(BEARER_PREFIX.length)
}

export async function getLicenseContext(
  licenseNonce: string,
  kv: KVNamespace,
): Promise<{ tier: string; agencyId?: string; featureEntitlements: string[] } | null> {
  try {
    const cached = await kv.get(`license:${licenseNonce}`)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    logger.error('[RaaS Auth Middleware] Failed to fetch license context', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}
