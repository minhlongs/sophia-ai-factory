import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateAgencyKey } from '../agency-middleware'
import * as dbClient from '@/seed/db/client'
import type { D1Database } from '@cloudflare/workers-types'

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}))
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

function mockD1() {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
  }
  const rawDb = {
    prepare: vi.fn().mockReturnValue(chain),
  }
  vi.mocked(dbClient.getD1).mockReturnValue(rawDb as unknown as D1Database)
  return { rawDb, chain }
}

describe('validateAgencyKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns failure when apiKey is null', async () => {
    const result = await validateAgencyKey(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_API_KEY')
      expect(result.error.status).toBe(401)
    }
  })

  it('returns failure when apiKey is empty string', async () => {
    const result = await validateAgencyKey('')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_API_KEY')
    }
  })

  it('returns failure when D1 binding is unavailable', async () => {
    vi.mocked(dbClient.getD1).mockReturnValue(null)
    const result = await validateAgencyKey('some-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR')
      expect(result.error.status).toBe(503)
    }
  })

  it('returns failure for invalid api key', async () => {
    const { chain } = mockD1()
    chain.first.mockResolvedValue({ data: null, error: null })

    const result = await validateAgencyKey('invalid-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_API_KEY')
      expect(result.error.status).toBe(401)
    }
  })

  it('returns failure for cancelled agency', async () => {
    const { chain } = mockD1()
    chain.first.mockResolvedValue({
      data: {
        id: 1,
        slug: 'acme',
        name: 'Acme Corp',
        tier: 'starter',
        api_key_hash: 'hash',
        api_key_prefix: 'ac_',
        owner_user_id: 42,
        billing_email: null,
        status: 'cancelled',
        created_at: 1000,
        updated_at: 1000,
      },
      error: null,
    })

    const result = await validateAgencyKey('some-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('AGENCY_CANCELLED')
      expect(result.error.status).toBe(403)
    }
  })

  it('returns failure for suspended agency', async () => {
    const { chain } = mockD1()
    chain.first.mockResolvedValue({
      data: {
        id: 1,
        slug: 'acme',
        name: 'Acme Corp',
        tier: 'starter',
        api_key_hash: 'hash',
        api_key_prefix: 'ac_',
        owner_user_id: 42,
        billing_email: null,
        status: 'suspended',
        created_at: 1000,
        updated_at: 1000,
      },
      error: null,
    })

    const result = await validateAgencyKey('some-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('AGENCY_SUSPENDED')
      expect(result.error.status).toBe(403)
    }
  })

  it('returns success with agency context on valid key', async () => {
    const { chain } = mockD1()
    chain.first.mockResolvedValue({
      data: {
        id: 1,
        slug: 'acme',
        name: 'Acme Corp',
        tier: 'starter',
        api_key_hash: 'hash',
        api_key_prefix: 'ac_',
        owner_user_id: 42,
        billing_email: null,
        status: 'active',
        created_at: 1000,
        updated_at: 1000,
      },
      error: null,
    })

    const result = await validateAgencyKey('valid-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.agency.id).toBe(1)
      expect(result.value.agency.slug).toBe('acme')
      expect(result.value.agency.name).toBe('Acme Corp')
      expect(result.value.agency.tier).toBe('starter')
      expect(result.value.forwardedHeaders['X-Agency-Id']).toBe('1')
      expect(result.value.forwardedHeaders['X-Agency-Slug']).toBe('acme')
      expect(result.value.forwardedHeaders['X-Agency-Tier']).toBe('starter')
    }
  })

  it('returns failure on DB error during lookup', async () => {
    const { chain } = mockD1()
    chain.first.mockRejectedValue(new Error('D1 connection lost'))

    const result = await validateAgencyKey('some-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR')
      expect(result.error.status).toBe(503)
    }
  })
})
