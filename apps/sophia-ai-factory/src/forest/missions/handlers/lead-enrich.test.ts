/**
 * Tests for lead:enrich handler — P5/P9 Hunter live wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}))
vi.mock('@/lib/hunter/hunter-client', () => ({
  findEmail: vi.fn(),
  verifyEmail: vi.fn(),
}))

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { findEmail, verifyEmail } from '@/lib/hunter/hunter-client'
import { handle } from './lead-enrich'

const mockResolve = resolveUserApiKey as ReturnType<typeof vi.fn>
const mockFind = findEmail as ReturnType<typeof vi.fn>
const mockVerify = verifyEmail as ReturnType<typeof vi.fn>

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'lead:enrich',
  params: { email: 'alice@acme.io' },
}

describe('lead:enrich handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('rejects when neither email nor (domain + name) provided', async () => {
    const result = await handle({ ...baseCtx, params: {} })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_params')
  })

  it('returns stub when no BYOK Hunter key', async () => {
    vi.useFakeTimers()
    mockResolve.mockResolvedValueOnce(null)
    const promise = handle(baseCtx)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result.ok).toBe(true)
    expect(result.data?.is_stub).toBe(true)
    expect(result.data?.stub_reason).toBe('no_byok_key')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('verifies provided email without calling finder', async () => {
    mockResolve.mockResolvedValueOnce('hunter-key-xxx')
    mockVerify.mockResolvedValueOnce({
      data: { status: 'valid', result: 'deliverable', score: 92, email: 'alice@acme.io', regexp: true, gibberish: false, disposable: false, webmail: false, mx_records: true, smtp_server: true, smtp_check: true },
    })
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.email).toBe('alice@acme.io')
    expect(result.data?.score).toBe(92)
    expect(result.data?.deliverable).toBe('deliverable')
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('uses email-finder then verifier when only domain + name provided', async () => {
    mockResolve.mockResolvedValueOnce('hunter-key-xxx')
    mockFind.mockResolvedValueOnce({
      data: { email: 'alice@acme.io', score: 80, domain: 'acme.io', first_name: 'Alice', last_name: 'Adams', position: 'CMO', twitter: '@alice', linkedin_url: 'https://linkedin.com/in/alice', phone_number: null, company: 'Acme', sources: [{ domain: 'acme.io', uri: 'https://acme.io/team' }] },
      meta: { params: {} },
    })
    mockVerify.mockResolvedValueOnce({
      data: { status: 'valid', result: 'deliverable', score: 95, email: 'alice@acme.io', regexp: true, gibberish: false, disposable: false, webmail: false, mx_records: true, smtp_server: true, smtp_check: true },
    })
    const result = await handle({ missionId: 'm-1', userId: 'u-1', command: 'lead:enrich', params: { domain: 'acme.io', first_name: 'Alice', last_name: 'Adams' } })
    expect(result.ok).toBe(true)
    expect(result.data?.email).toBe('alice@acme.io')
    expect(result.data?.position).toBe('CMO')
    expect(mockFind).toHaveBeenCalledWith('hunter-key-xxx', expect.objectContaining({ domain: 'acme.io', first_name: 'Alice', last_name: 'Adams' }))
  })

  it('returns hunter_email_not_found when finder returns null email', async () => {
    mockResolve.mockResolvedValueOnce('hunter-key-xxx')
    mockFind.mockResolvedValueOnce({
      data: { email: null, score: null, domain: 'acme.io', first_name: null, last_name: null, position: null, twitter: null, linkedin_url: null, phone_number: null, company: null, sources: [] },
      meta: { params: {} },
    })
    const result = await handle({ missionId: 'm-1', userId: 'u-1', command: 'lead:enrich', params: { domain: 'acme.io', first_name: 'Ghost' } })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('hunter_email_not_found')
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('surfaces hunter_<status> code on API error', async () => {
    mockResolve.mockResolvedValueOnce('hunter-key-xxx')
    mockVerify.mockRejectedValueOnce({ code: 'hunter_429', status: 429, message: 'Rate limit' })
    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('hunter_429')
  })
})
