/**
 * JWKS setup and JWT decode utilities
 * @module security/jwt-validator-jwks
 */

import { createRemoteJWKSet } from 'jose'
import type { JwtPayload } from './jwt-validator-types'

export const BEARER_PREFIX = 'Bearer '

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable not set')
  return url
}

export function getJwksUri(): string {
  return `${getSupabaseUrl()}/auth/v1/jwks`
}

export function getExpectedIssuer(): string {
  return `${getSupabaseUrl()}/auth/v1`
}

let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null

export function getJwkSet() {
  if (!jwkSet) {
    jwkSet = createRemoteJWKSet(new URL(getJwksUri()), { cooldownDuration: 60000 })
  }
  return jwkSet
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as JwtPayload
  } catch {
    return null
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload) return true
  return payload.exp < Math.floor(Date.now() / 1000)
}
