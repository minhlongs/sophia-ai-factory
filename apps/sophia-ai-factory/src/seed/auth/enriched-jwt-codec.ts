/**
 * JWT Verification & Decoding Primitives for Enriched JWTs
 *
 * @module auth/enriched-jwt-codec
 */

import { jwtVerify } from 'jose'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { QuotaLimit } from '@/seed/types/quota-limit'
import type { EnrichedJwtPayload } from '@/seed/auth/enriched-jwt-types'

export const JWT_CONFIG = { algorithm: 'HS256' as const, ttlSeconds: 3600 }

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('[Enriched JWT] JWT_SECRET is required — refusing to start with insecure default')
  }
  return new TextEncoder().encode(secret)
}

export async function verifyEnrichedJwt(token: string): Promise<EnrichedJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
      clockTolerance: 60,
    })
    return payload as unknown as EnrichedJwtPayload
  } catch (error) {
    logger.warn('[Enriched JWT] JWT verification failed', toError(error))
    return null
  }
}

export function decodeEnrichedJwt(token: string): EnrichedJwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8')
    return JSON.parse(payloadStr) as EnrichedJwtPayload
  } catch {
    return null
  }
}

export function extractQuotaFromJwt(payload: EnrichedJwtPayload): QuotaLimit {
  return payload.quota
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeEnrichedJwt(token)
  if (!payload) return true
  return payload.exp < Math.floor(Date.now() / 1000)
}
