/**
 * Negative regression tests for DLQ evidence serialization.
 *
 * These are the proof behind the claim that `postback_dead_letter.headers_json`
 * cannot retain a credential. Every assertion is a *negative* one: the secret
 * value must be absent from the serialized evidence. A regression that widens
 * the allowlist, drops the fingerprint, or reintroduces a raw header dump fails
 * here rather than in production.
 *
 * @module land/postback/__tests__/postback-dlq-evidence.test
 */

import { describe, it, expect } from 'vitest'
import { sha256Hex } from '@/seed/security/token-hash'
import {
  serializeDlqHeaders,
  serializeDlqEndpoint,
  serializeDlqSourceIp,
  serializeDlqBody,
  DLQ_EVIDENCE_POLICY,
} from '../postback-dlq-evidence'

/** Minimal case-insensitive header bag, like the Fetch `Headers` API. */
function headerBag(entries: Record<string, string>): { get(name: string): string | null } {
  const lowered = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (name: string) => lowered.get(name.toLowerCase()) ?? null }
}

function parse(json: string): Record<string, string> {
  return JSON.parse(json) as Record<string, string>
}

describe('serializeDlqHeaders — fail-closed allowlist', () => {
  it('never stores an Authorization bearer credential', async () => {
    const json = await serializeDlqHeaders(
      headerBag({ authorization: 'Bearer sk_live_super_secret_token', 'user-agent': 'okhttp' }),
      ['authorization'],
    )

    expect(json).not.toContain('sk_live_super_secret_token')
    expect(json).not.toContain('Bearer')
    const stored = parse(json)
    expect(stored.authorization).toMatch(/^sigfp:[0-9a-f]{16}$/)
    expect(stored['user-agent']).toBe('okhttp')
  })

  it('never stores cookie, set-cookie, or proxy-authorization', async () => {
    const json = await serializeDlqHeaders(
      headerBag({
        cookie: 'session=eyJhbGciOiJIUzI1NiJ9.live-session',
        'set-cookie': 'session=rotated-value; HttpOnly',
        'proxy-authorization': 'Basic dXNlcjpwYXNz',
      }),
    )

    expect(json).not.toContain('live-session')
    expect(json).not.toContain('rotated-value')
    expect(json).not.toContain('dXNlcjpwYXNz')
    expect(parse(json)).toEqual({})
  })

  it('never stores an arbitrary attacker-supplied credential header', async () => {
    // A provider we have never integrated can name its credential anything.
    // The allowlist is what makes that safe: unknown names are dropped, not
    // inspected.
    const json = await serializeDlqHeaders(
      headerBag({
        'x-custom-provider-api-key': 'pk_live_9f3ac1',
        'x-api-secret': 'hunter2',
        'x-attacker-planted': 'inject-me',
        'user-agent': 'curl/8.0',
      }),
    )

    expect(json).not.toContain('pk_live_9f3ac1')
    expect(json).not.toContain('hunter2')
    expect(json).not.toContain('inject-me')
    expect(parse(json)).toEqual({ 'user-agent': 'curl/8.0' })
  })

  it('never stores the client-controllable x-forwarded-for chain', async () => {
    // source_ip already prefers the edge-written cf-connecting-ip and ignores
    // x-forwarded-for; retaining it here would reopen the same trust question.
    const json = await serializeDlqHeaders(
      headerBag({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'cf-connecting-ip': '198.51.100.7' }),
    )

    expect(json).not.toContain('203.0.113.9')
    expect(json).not.toContain('10.0.0.1')
  })

  it('replaces every declared signature header with a one-way digest', async () => {
    const signature = 'dGhpcy1pcy1hLXJlYWwtaG1hYy1zaWduYXR1cmU='
    const json = await serializeDlqHeaders(
      headerBag({
        'x-signature': signature,
        'x-another-signature': 'second-secret-hmac',
      }),
      ['x-signature', 'x-another-signature'],
    )

    expect(json).not.toContain(signature)
    expect(json).not.toContain('second-secret-hmac')

    const stored = parse(json)
    expect(stored['x-signature']).toBe(
      `${DLQ_EVIDENCE_POLICY.fingerprintPrefix}${(await sha256Hex(signature)).slice(0, 16)}`,
    )
    expect(stored['x-another-signature']).toMatch(/^sigfp:[0-9a-f]{16}$/)
  })

  it('produces an idempotent fingerprint, so redeliveries still correlate', async () => {
    const headers = headerBag({ 'x-signature': 'same-hmac-value' })
    const first = await serializeDlqHeaders(headers, ['x-signature'])
    const second = await serializeDlqHeaders(headers, ['x-signature'])

    expect(first).toBe(second)
  })

  it('produces a different fingerprint for a different signature', async () => {
    const a = parse(await serializeDlqHeaders(headerBag({ 'x-signature': 'sig-a' }), ['x-signature']))
    const b = parse(await serializeDlqHeaders(headerBag({ 'x-signature': 'sig-b' }), ['x-signature']))

    expect(a['x-signature']).not.toBe(b['x-signature'])
  })

  it('keeps only the allowlisted diagnostic headers', async () => {
    const json = await serializeDlqHeaders(
      headerBag({
        'user-agent': 'provider/1.0',
        'content-type': 'application/json',
        'content-length': '42',
        'cf-ray': '8abc123def-SIN',
        'cf-ipcountry': 'VN',
        'cdn-loop': 'cloudflare',
        'x-whatever': 'drop-me',
      }),
    )

    expect(parse(json)).toEqual({
      'user-agent': 'provider/1.0',
      'content-type': 'application/json',
      'content-length': '42',
      'cf-ray': '8abc123def-SIN',
      'cf-ipcountry': 'VN',
      'cdn-loop': 'cloudflare',
    })
  })

  it('drops a signature header the contract did not declare', async () => {
    // Only contracts that name a header may fingerprint it; an unexpected
    // signature-shaped header falls under the same rule as any unknown header.
    const json = await serializeDlqHeaders(
      headerBag({ 'x-unexpected-signature': 'zzz-secret' }),
      ['x-signature'],
    )

    expect(json).not.toContain('zzz-secret')
    expect(parse(json)).toEqual({})
  })

  it('clips an oversized allowlisted header value', async () => {
    const huge = 'a'.repeat(5000)
    const stored = parse(await serializeDlqHeaders(headerBag({ 'user-agent': huge })))

    expect(stored['user-agent']).toHaveLength(
      DLQ_EVIDENCE_POLICY.maxHeaderValueLength + DLQ_EVIDENCE_POLICY.truncatedSuffix.length,
    )
    expect(stored['user-agent'].endsWith(DLQ_EVIDENCE_POLICY.truncatedSuffix)).toBe(true)
  })

  it('never overwrites an already-fingerprinted signature header even with mixed-case sigHeaders', async () => {
    const secretProbe = 'bearer-disguised-in-user-agent'
    const json = await serializeDlqHeaders(
      headerBag({ 'user-agent': secretProbe, 'content-type': 'application/json' }),
      ['User-Agent'],
    )

    expect(json).not.toContain(secretProbe)
    const stored = parse(json)
    expect(stored).toEqual({
      'user-agent': expect.stringMatching(/^sigfp:[0-9a-f]{16}$/),
      'content-type': 'application/json',
    })
  })

  it('fails closed to an empty object when the header source throws', async () => {
    const hostile = {
      get(): string | null {
        throw new Error('hostile header surface')
      },
    }

    await expect(serializeDlqHeaders(hostile, ['x-signature'])).resolves.toBe('{}')
  })

  it('returns an empty object when nothing is present', async () => {
    expect(await serializeDlqHeaders(headerBag({}), ['x-signature'])).toBe('{}')
  })
})

describe('serializeDlqEndpoint — canonical identity', () => {
  it('drops the query string, including an Awin query HMAC', async () => {
    const raw =
      'https://sophia.agencyos.network/api/webhooks/awin?signature=abc123hmac&email=user%40corp.com&tenant_id=t-1'

    const endpoint = serializeDlqEndpoint(raw)

    expect(endpoint).toBe('https://sophia.agencyos.network/api/webhooks/awin')
    expect(endpoint).not.toContain('abc123hmac')
    expect(endpoint).not.toContain('user%40corp.com')
    expect(endpoint).not.toContain('t-1')
  })

  it('drops a session identifier carried in the query string', async () => {
    const endpoint = serializeDlqEndpoint(
      'https://sophia.agencyos.network/api/webhooks/saas-crypto/binance?session=eyJhbGciOi.payload',
    )

    expect(endpoint).toBe('https://sophia.agencyos.network/api/webhooks/saas-crypto/binance')
  })

  it('keeps the path so different routes stay distinguishable', async () => {
    const a = serializeDlqEndpoint('https://sophia.agencyos.network/api/webhooks/accesstrade')
    const b = serializeDlqEndpoint('https://sophia.agencyos.network/api/webhooks/awin')

    expect(a).not.toBe(b)
  })

  it('returns an empty string for an unparseable or non-HTTP URL rather than echoing it', async () => {
    expect(serializeDlqEndpoint('not a url at all')).toBe('')
    expect(serializeDlqEndpoint('')).toBe('')
    expect(serializeDlqEndpoint('urn:ietf:params:oauth:token-type:jwt')).toBe('')
    expect(serializeDlqEndpoint('mailto:billing@corp.example?token=secret')).toBe('')
  })

  it('bounds an oversized pathname and marks the truncation visibly', () => {
    const hugePath = `/api/webhooks/awin/${'p'.repeat(DLQ_EVIDENCE_POLICY.maxEndpointLength)}`
    const stored = serializeDlqEndpoint(`https://sophia.agencyos.network${hugePath}`)

    expect(stored).toHaveLength(
      DLQ_EVIDENCE_POLICY.maxEndpointLength + DLQ_EVIDENCE_POLICY.truncatedSuffix.length,
    )
    expect(stored.endsWith(DLQ_EVIDENCE_POLICY.truncatedSuffix)).toBe(true)
  })
})

describe('serializeDlqSourceIp — bounded edge IP retention', () => {
  it('returns null when absent and retains normal IPv4/IPv6 strings verbatim', () => {
    expect(serializeDlqSourceIp(null)).toBeNull()
    expect(serializeDlqSourceIp(undefined)).toBeNull()
    expect(serializeDlqSourceIp('')).toBeNull()
    expect(serializeDlqSourceIp('203.0.113.42')).toBe('203.0.113.42')
    expect(serializeDlqSourceIp('2001:db8:85a3::8a2e:370:7334')).toBe(
      '2001:db8:85a3::8a2e:370:7334',
    )
  })

  it('bounds an oversized source IP string and marks the truncation visibly', () => {
    const oversized = '9'.repeat(DLQ_EVIDENCE_POLICY.maxSourceIpLength + 50)
    const stored = serializeDlqSourceIp(oversized)

    expect(stored).toHaveLength(
      DLQ_EVIDENCE_POLICY.maxSourceIpLength + DLQ_EVIDENCE_POLICY.truncatedSuffix.length,
    )
    expect(stored?.endsWith(DLQ_EVIDENCE_POLICY.truncatedSuffix)).toBe(true)
  })
})

describe('serializeDlqBody — bounded payload retention', () => {
  it('retains a legitimate small body and an exact boundary body verbatim', () => {
    const body = JSON.stringify({ sub_id: 'link-1', amount: 100 })
    expect(serializeDlqBody(body)).toBe(body)

    const boundary = 'y'.repeat(DLQ_EVIDENCE_POLICY.maxBodyLength)
    expect(serializeDlqBody(boundary)).toBe(boundary)
  })

  it('truncates an oversized body and marks the loss visibly', () => {
    const body = 'x'.repeat(DLQ_EVIDENCE_POLICY.maxBodyLength + 500)
    const stored = serializeDlqBody(body)

    expect(stored).toHaveLength(
      DLQ_EVIDENCE_POLICY.maxBodyLength + DLQ_EVIDENCE_POLICY.truncatedSuffix.length,
    )
    expect(stored.endsWith(DLQ_EVIDENCE_POLICY.truncatedSuffix)).toBe(true)
    expect(stored.slice(0, DLQ_EVIDENCE_POLICY.maxBodyLength)).toBe(
      body.slice(0, DLQ_EVIDENCE_POLICY.maxBodyLength),
    )
  })
})
