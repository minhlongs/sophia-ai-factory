/**
 * Tests for CSP header builder — nonce injection and directive coverage.
 */
import { describe, it, expect } from 'vitest'
import { buildCSPHeader, cspConfig } from '@/seed/security/content-security-policy-configuration'

describe('buildCSPHeader', () => {
  describe('without nonce (build-time / fallback)', () => {
    it('includes unsafe-inline in script-src when no nonce provided', () => {
      const header = buildCSPHeader()
      expect(header).toContain("script-src")
      expect(header).toContain("'unsafe-inline'")
    })

    it('does not include nonce directive when no nonce provided', () => {
      const header = buildCSPHeader()
      expect(header).not.toMatch(/'nonce-/)
    })
  })

  describe('with nonce', () => {
    const testNonce = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'

    it('replaces unsafe-inline with nonce in script-src', () => {
      const header = buildCSPHeader(testNonce)
      const scriptSrcMatch = header.match(/script-src ([^;]+)/)
      expect(scriptSrcMatch).toBeTruthy()
      const scriptSrc = scriptSrcMatch![1]
      expect(scriptSrc).toContain(`'nonce-${testNonce}'`)
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    })

    it('keeps unsafe-inline in style-src (required by Tailwind)', () => {
      const header = buildCSPHeader(testNonce)
      const styleSrcMatch = header.match(/style-src ([^;]+)/)
      expect(styleSrcMatch).toBeTruthy()
      expect(styleSrcMatch![1]).toContain("'unsafe-inline'")
    })

    it('preserves self in script-src', () => {
      const header = buildCSPHeader(testNonce)
      const scriptSrcMatch = header.match(/script-src ([^;]+)/)
      expect(scriptSrcMatch![1]).toContain("'self'")
    })
  })

  describe('all directives present', () => {
    it('contains all required CSP directives', () => {
      const header = buildCSPHeader()
      const requiredDirectives = [
        'default-src',
        'img-src',
        'script-src',
        'style-src',
        'font-src',
        'connect-src',
        'frame-src',
        'worker-src',
        'frame-ancestors',
        'base-uri',
        'form-action',
        'object-src',
      ]
      for (const directive of requiredDirectives) {
        expect(header, `missing directive: ${directive}`).toContain(directive)
      }
    })

    it('blocks object-src (no Flash/embeds)', () => {
      const header = buildCSPHeader()
      expect(header).toContain("object-src 'none'")
    })

    it('blocks frame-ancestors (clickjacking protection)', () => {
      const header = buildCSPHeader()
      expect(header).toContain("frame-ancestors 'none'")
    })

    it('allows YouTube in frame-src', () => {
      const header = buildCSPHeader()
      expect(header).toContain('https://www.youtube.com')
    })
  })

  describe('directive count and format', () => {
    it('is a semicolon-separated string', () => {
      const header = buildCSPHeader()
      const parts = header.split('; ')
      // 12 directives defined in cspConfig
      expect(parts.length).toBe(12)
    })

    it('nonce directive is well-formed hex string of 32 chars', () => {
      const nonce = 'deadbeefcafe0123456789abcdef0123'
      const header = buildCSPHeader(nonce)
      expect(header).toContain(`'nonce-deadbeefcafe0123456789abcdef0123'`)
    })
  })

  describe('cspConfig exports', () => {
    it('style-src contains unsafe-inline', () => {
      expect(cspConfig.styleSrc).toContain("'unsafe-inline'")
    })

    it('script-src base does NOT contain unsafe-inline (nonce removes it)', () => {
      // The base config no longer includes 'unsafe-inline' — buildCSPHeader adds it when no nonce
      expect(cspConfig.scriptSrc).not.toContain("'unsafe-inline'")
    })
  })
})
