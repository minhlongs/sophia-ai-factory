/**
 * Tests for CSRF protection utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateCsrfToken,
  verifyCsrfToken,
  requiresCsrfCheck,
  setCsrfCookie,
  csrfForbiddenResponse,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@/seed/security/csrf'
import { NextRequest, NextResponse } from 'next/server'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, pathname: string, opts?: {
  cookieToken?: string
  headerToken?: string
}): NextRequest {
  const url = `https://sophia.agencyos.network${pathname}`
  const headers = new Headers()
  if (opts?.headerToken) headers.set(CSRF_HEADER_NAME, opts.headerToken)
  if (opts?.cookieToken) headers.set('cookie', `${CSRF_COOKIE_NAME}=${opts.cookieToken}`)
  return new NextRequest(url, { method, headers })
}

// ── generateCsrfToken ─────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  it('returns a 64-character hex string (32 bytes)', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique tokens each call', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateCsrfToken))
    expect(tokens.size).toBe(50)
  })
})

// ── verifyCsrfToken ───────────────────────────────────────────────────────────

describe('verifyCsrfToken', () => {
  it('returns true when cookie and header match', () => {
    const token = generateCsrfToken()
    const req = makeRequest('POST', '/api/user/settings', { cookieToken: token, headerToken: token })
    expect(verifyCsrfToken(req)).toBe(true)
  })

  it('returns false when header is missing', () => {
    const token = generateCsrfToken()
    const req = makeRequest('POST', '/api/user/settings', { cookieToken: token })
    expect(verifyCsrfToken(req)).toBe(false)
  })

  it('returns false when cookie is missing', () => {
    const token = generateCsrfToken()
    const req = makeRequest('POST', '/api/user/settings', { headerToken: token })
    expect(verifyCsrfToken(req)).toBe(false)
  })

  it('returns false when tokens differ', () => {
    const req = makeRequest('POST', '/api/user/settings', {
      cookieToken: generateCsrfToken(),
      headerToken: generateCsrfToken(),
    })
    expect(verifyCsrfToken(req)).toBe(false)
  })

  it('returns false when header is tampered by one character', () => {
    const token = generateCsrfToken()
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    const req = makeRequest('POST', '/api/user/settings', { cookieToken: token, headerToken: tampered })
    expect(verifyCsrfToken(req)).toBe(false)
  })
})

// ── requiresCsrfCheck ─────────────────────────────────────────────────────────

describe('requiresCsrfCheck', () => {
  it('returns false for GET', () => {
    expect(requiresCsrfCheck('/api/user/tier', 'GET')).toBe(false)
  })

  it('returns false for HEAD', () => {
    expect(requiresCsrfCheck('/api/dashboard', 'HEAD')).toBe(false)
  })

  it('returns false for OPTIONS', () => {
    expect(requiresCsrfCheck('/api/dashboard', 'OPTIONS')).toBe(false)
  })

  it('returns true for POST to a regular API route', () => {
    expect(requiresCsrfCheck('/api/user/tier', 'POST')).toBe(true)
  })

  it('returns true for PUT', () => {
    expect(requiresCsrfCheck('/api/user/profile', 'PUT')).toBe(true)
  })

  it('returns true for DELETE', () => {
    expect(requiresCsrfCheck('/api/user/account', 'DELETE')).toBe(true)
  })

  it('returns false for /api/auth/ paths (Better Auth handles own CSRF)', () => {
    expect(requiresCsrfCheck('/api/auth/sign-in', 'POST')).toBe(false)
    expect(requiresCsrfCheck('/api/auth/mfa/totp/verify', 'POST')).toBe(false)
  })

  it('returns false for /api/webhooks/ paths', () => {
    expect(requiresCsrfCheck('/api/webhooks/nowpayments', 'POST')).toBe(false)
    expect(requiresCsrfCheck('/api/webhooks/telegram', 'POST')).toBe(false)
  })

  it('returns false for /api/cron/ paths', () => {
    expect(requiresCsrfCheck('/api/cron/daily-rollup', 'POST')).toBe(false)
  })

  it('is case-insensitive for method', () => {
    expect(requiresCsrfCheck('/api/user/tier', 'post')).toBe(true)
    expect(requiresCsrfCheck('/api/user/tier', 'get')).toBe(false)
  })
})

// ── setCsrfCookie ─────────────────────────────────────────────────────────────

describe('setCsrfCookie', () => {
  it('sets Set-Cookie header with csrf-token', () => {
    const response = new NextResponse()
    const token = generateCsrfToken()
    setCsrfCookie(response, token)
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${CSRF_COOKIE_NAME}=${token}`)
  })

  it('uses SameSite=Strict', () => {
    const response = new NextResponse()
    setCsrfCookie(response, generateCsrfToken())
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
  })

  it('does NOT set httpOnly (JS must read it)', () => {
    const response = new NextResponse()
    setCsrfCookie(response, generateCsrfToken())
    const setCookie = (response.headers.get('set-cookie') ?? '').toLowerCase()
    expect(setCookie).not.toContain('httponly')
  })
})

// ── csrfForbiddenResponse ─────────────────────────────────────────────────────

describe('csrfForbiddenResponse', () => {
  it('returns 403 with csrf_token_invalid body', async () => {
    const res = csrfForbiddenResponse()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'csrf_token_invalid' })
  })
})
