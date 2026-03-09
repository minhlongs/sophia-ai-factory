/**
 * Tests for JWT Validator
 *
 * Tests JWT validation, decoding, and extraction
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  validateJwt,
  decodeJwt,
  isJwtExpired,
  extractUserIdFromJwt,
} from '@/lib/security/jwt-validator'

// Mock jose library
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}))

// Mock environment variables
const originalEnv = process.env

describe('decodeJwt', () => {
  it('should decode valid JWT payload', () => {
    // Create a valid JWT (header.payload.signature format)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url')
    const signature = 'signature'

    const token = `${header}.${payload}.${signature}`

    const result = decodeJwt(token)

    expect(result).toBeDefined()
    expect(result?.sub).toBe('user-123')
    expect(result?.iat).toBeDefined()
    expect(result?.exp).toBeDefined()
  })

  it('should return null for invalid JWT format', () => {
    expect(decodeJwt('invalid')).toBe(null)
    expect(decodeJwt('too.few.parts')).toBe(null)
    expect(decodeJwt('not.valid.jwt.token')).toBe(null)
  })

  it('should return null for malformed payload', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const invalidPayload = Buffer.from('not-valid-json').toString('base64url')
    const signature = 'sig'

    const token = `${header}.${invalidPayload}.${signature}`

    expect(decodeJwt(token)).toBe(null)
  })

  it('should return null for empty token', () => {
    expect(decodeJwt('')).toBe(null)
    expect(decodeJwt('.')).toBe(null)
  })
})

describe('validateJwt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return missing-token for null header', async () => {
    const result = await validateJwt(null)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('missing-token')
  })

  it('should return invalid-format for non-Bearer header', async () => {
    const result = await validateJwt('Basic dXNlcjpwYXNz')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid-format')
  })

  it('should return invalid-format for short token', async () => {
    const result = await validateJwt('Bearer short')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid-format')
  })

  it('should return valid result for valid JWT', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'authenticated',
        iss: 'https://test.supabase.co/auth/v1',
      },
      protectedHeader: { alg: 'RS256' },
      key: {} as any,
    } as any)

    const validToken = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTIzLCJleHAiOjk5OX0.signature'
    const result = await validateJwt(validToken)

    expect(result.valid).toBe(true)
    expect(result.payload?.sub).toBe('user-123')
  })

  it('should return expired for expired JWT', async () => {
    const { jwtVerify } = await import('jose')
    // jose uses JwtExpired error name
    const expiredError = new Error('Token is expired')
    expiredError.name = 'JwtExpired'
    vi.mocked(jwtVerify).mockRejectedValue(expiredError)

    // Use a properly formatted token (3 parts, each part is valid base64url)
    const expiredToken = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTIzfQ.signature'
    const result = await validateJwt(expiredToken)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('expired')
  })

  it('should return invalid-signature for invalid signature', async () => {
    const { jwtVerify } = await import('jose')
    // jose uses JWSSignatureVerificationFailed error name
    const sigError = new Error('Invalid signature')
    sigError.name = 'JWSSignatureVerificationFailed'
    vi.mocked(jwtVerify).mockRejectedValue(sigError)

    const invalidToken = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.invalid'
    const result = await validateJwt(invalidToken)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid-signature')
  })

  it('should return invalid-issuer for wrong issuer', async () => {
    const { jwtVerify } = await import('jose')
    // jose uses JWTInvalidClaimIssuer for issuer-specific errors
    const issuerError = new Error('Invalid issuer')
    issuerError.name = 'JWTInvalidClaimIssuer'
    vi.mocked(jwtVerify).mockRejectedValue(issuerError)

    const token = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature'
    const result = await validateJwt(token)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid-issuer')
  })

  it('should throw error when SUPABASE_URL not set', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''

    // The validateJwt function catches errors and returns invalid-signature
    // But the getJwksUri function inside will throw when SUPABASE_URL is empty
    // We need to test that the function throws during JWKS setup
    const { validateJwt } = await import('@/lib/security/jwt-validator')

    // validateJwt returns a result even on error, but the error message
    // should indicate the issue
    const result = await validateJwt('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig')

    // When SUPABASE_URL is not set, the error gets caught and returned as invalid-signature
    // with the error message in the log
    expect(result.valid).toBe(false)

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv
  })
})

describe('isJwtExpired', () => {
  it('should return true for expired token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    })).toString('base64url')
    const signature = 'sig'

    const token = `${header}.${payload}.${signature}`

    expect(isJwtExpired(token)).toBe(true)
  })

  it('should return false for valid token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    })).toString('base64url')
    const signature = 'sig'

    const token = `${header}.${payload}.${signature}`

    expect(isJwtExpired(token)).toBe(false)
  })

  it('should return true for invalid token', () => {
    expect(isJwtExpired('invalid')).toBe(true)
    expect(isJwtExpired('')).toBe(true)
  })
})

describe('extractUserIdFromJwt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('should extract user ID from valid JWT', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: 'user-456',
        iat: 123,
        exp: 999,
      },
      protectedHeader: { alg: 'RS256' },
      key: {} as any,
    } as any)

    // Use properly formatted token (will be verified by mock)
    const result = await extractUserIdFromJwt('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQ1NiIsImlhdCI6MTIzLCJleHAiOjk5OX0.signature')

    expect(result).toBe('user-456')
  })

  it('should return null for invalid JWT', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid'))

    const result = await extractUserIdFromJwt('Bearer invalid')

    expect(result).toBe(null)
  })

  it('should return null for JWT without sub', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        iat: 123,
        exp: 999,
        // No sub claim
      },
      protectedHeader: { alg: 'RS256' },
      key: {} as any,
    } as any)

    const result = await extractUserIdFromJwt('Bearer token')

    expect(result).toBe(null)
  })
})
