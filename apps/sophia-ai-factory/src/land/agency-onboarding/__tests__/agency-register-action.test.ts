import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agencyRegisterAction } from '../agency-register-action'

// Mock modules before importing the SUT
const mockCreateAgency = vi.fn()
const mockCreateAgencyApiKey = vi.fn()
const mockValidateAgencySlug = vi.fn()

vi.mock('@/seed/db/repositories/agency-repo', () => ({
  createAgency: (...args: unknown[]) => mockCreateAgency(...args),
  findBySlug: vi.fn(),
}))

vi.mock('@/seed/db/agency-api-key', () => ({
  createAgencyApiKey: (...args: unknown[]) => mockCreateAgencyApiKey(...args),
  hashApiKey: vi.fn(),
  verifyApiKey: vi.fn(),
}))

vi.mock('@/seed/validators/agency-slug.validator', () => ({
  validateAgencySlug: (...args: unknown[]) => mockValidateAgencySlug(...args),
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

describe('agencyRegisterAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAgencySlug.mockReturnValue({ ok: true, value: 'test-agency' })
  })

  it('creates agency and returns api key on valid input', async () => {
    mockCreateAgencyApiKey.mockReturnValue({
      key: 'ak_testkey1234567890abcdef',
      hash: 'hashed_value',
    })
    mockCreateAgency.mockResolvedValue({
      ok: true,
      value: { id: 1, slug: 'test-agency', tier: 'starter', status: 'active', created_at: 1000, updated_at: 1000 },
    })

    const result = await agencyRegisterAction({
      slug: 'test-agency',
      name: 'Test Agency',
      ownerUserId: 1,
      tier: 'starter',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.apiKey).toBe('ak_testkey1234567890abcdef')
      expect(result.value.agencyId).toBe(1)
      expect(result.value.slug).toBe('test-agency')
    }
    expect(mockCreateAgency).toHaveBeenCalledTimes(1)
  })

  it('returns failure for invalid slug', async () => {
    mockValidateAgencySlug.mockReturnValue({
      ok: false,
      error: { code: 'INVALID_SLUG_FORMAT', message: 'Too short' },
    })

    const result = await agencyRegisterAction({
      slug: 'ab',
      name: 'Test',
      ownerUserId: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns failure for reserved slug', async () => {
    mockValidateAgencySlug.mockReturnValue({
      ok: false,
      error: { code: 'RESERVED_SLUG', message: 'Reserved' },
    })

    const result = await agencyRegisterAction({
      slug: 'www',
      name: 'Test',
      ownerUserId: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('RESERVED_SLUG')
  })

  it('returns failure on duplicate slug', async () => {
    mockValidateAgencySlug.mockReturnValue({ ok: true, value: 'duplicate' })
    mockCreateAgency.mockResolvedValue({
      ok: false,
      error: { code: 'AGENCY_CREATE_FAILED', message: 'UNIQUE constraint failed: agency.slug' },
    })

    const result = await agencyRegisterAction({
      slug: 'duplicate',
      name: 'Test',
      ownerUserId: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('SLUG_TAKEN')
  })

  it('returns failure for invalid input schema', async () => {
    const result = await agencyRegisterAction({
      slug: '',
      name: '',
      ownerUserId: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns failure on agency creation DB error', async () => {
    mockCreateAgencyApiKey.mockReturnValue({
      key: 'ak_key1234567890abcdef',
      hash: 'hashed',
    })
    mockCreateAgency.mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Connection lost' },
    })

    const result = await agencyRegisterAction({
      slug: 'new-agency',
      name: 'New Agency',
      ownerUserId: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('INSERT_FAILED')
  })

  it('uses default tier when not provided', async () => {
    mockCreateAgencyApiKey.mockReturnValue({
      key: 'ak_defaultkey12345678',
      hash: 'hashed',
    })
    mockCreateAgency.mockResolvedValue({
      ok: true,
      value: { id: 5, slug: 'default-tier', tier: 'starter', status: 'active', created_at: 1000, updated_at: 1000 },
    })

    const result = await agencyRegisterAction({
      slug: 'default-tier',
      name: 'Default Agency',
      ownerUserId: 2,
    })

    expect(result.ok).toBe(true)
    // Should be called with tier: 'starter' (default)
    expect(mockCreateAgency).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'starter' }),
    )
  })

  it('passes billingEmail to createAgency', async () => {
    mockCreateAgencyApiKey.mockReturnValue({
      key: 'ak_billingkey12345678',
      hash: 'hashed',
    })
    mockCreateAgency.mockResolvedValue({
      ok: true,
      value: { id: 3, slug: 'billing', tier: 'starter', status: 'active', created_at: 1000, updated_at: 1000 },
    })

    await agencyRegisterAction({
      slug: 'billing',
      name: 'Billing Agency',
      ownerUserId: 1,
      billingEmail: 'billing@example.com',
    })

    expect(mockCreateAgency).toHaveBeenCalledWith(
      expect.objectContaining({ billingEmail: 'billing@example.com' }),
    )
  })
})
