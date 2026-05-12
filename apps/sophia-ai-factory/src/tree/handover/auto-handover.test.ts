/**
 * Tests for auto-handover orchestrator (payment IPN → full handover pipeline).
 *
 * Pins decision tree: idempotency by paymentId, user resolution (provided →
 * lookup → create), tier upgrade short-circuit (no new SOPs, just email),
 * first-handover full flow (SOPs + record + magic link + outbox enqueue),
 * locale-prefix path stripping for default 'en', non-fatal error swallowing
 * with structured skipReasons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetD1Raw } = vi.hoisted(() => ({ mockGetD1Raw: vi.fn() }))
vi.mock('@/seed/db/client', () => ({ getD1Raw: mockGetD1Raw }))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const {
  mockCreateCustomerUser,
  mockUpsertUserTier,
  mockPreInstallSops,
  mockCreateHandoverRecord,
} = vi.hoisted(() => ({
  mockCreateCustomerUser: vi.fn(),
  mockUpsertUserTier: vi.fn(),
  mockPreInstallSops: vi.fn(),
  mockCreateHandoverRecord: vi.fn(),
}))
vi.mock('@/tree/handover/handover-account-setup', () => ({
  createCustomerUser: mockCreateCustomerUser,
  upsertUserTier: mockUpsertUserTier,
  preInstallSops: mockPreInstallSops,
  createHandoverRecord: mockCreateHandoverRecord,
}))

const { mockCreateMagicLinkToken } = vi.hoisted(() => ({ mockCreateMagicLinkToken: vi.fn() }))
vi.mock('@/tree/handover/handover-magic-link', () => ({
  createMagicLinkToken: mockCreateMagicLinkToken,
}))

const { mockSendTierUpgradeEmail } = vi.hoisted(() => ({ mockSendTierUpgradeEmail: vi.fn() }))
vi.mock('@/tree/handover/handover-email-service', () => ({
  sendTierUpgradeEmail: mockSendTierUpgradeEmail,
}))

const { mockEnqueueWelcomeEmail } = vi.hoisted(() => ({ mockEnqueueWelcomeEmail: vi.fn() }))
vi.mock('@/forest/outbox/email-outbox', () => ({
  enqueueWelcomeEmail: mockEnqueueWelcomeEmail,
}))

const { mockInstallStarterSop } = vi.hoisted(() => ({ mockInstallStarterSop: vi.fn() }))
vi.mock('@/tree/handover/install-starter-sop', () => ({
  installStarterSop: mockInstallStarterSop,
}))

import { triggerAutoHandover } from './auto-handover'
import { logger } from '@/seed/utils/logger-utility'

// Stateful D1 mock — pattern-matches SELECT shapes for the 4 lookup helpers.
interface MockD1Opts {
  handoverByPayment?: { id: string } | null
  userByEmail?: { id: string } | null
  existingHandover?: { id: string } | null
  purchaseCount?: number
}

function createMockD1(opts: MockD1Opts = {}) {
  const calls: Array<{ sql: string; bindings: unknown[] }> = []
  const stmt = (sql: string) => {
    const current = { sql, bindings: [] as unknown[] }
    calls.push(current)
    const bound = {
      bind: (...args: unknown[]) => {
        current.bindings = args
        return bound
      },
      first: async () => {
        if (sql.includes('FROM customer_handovers') && sql.includes('trigger_payment_id')) {
          return opts.handoverByPayment ?? null
        }
        if (sql.includes('FROM user') && sql.includes('email')) {
          return opts.userByEmail ?? null
        }
        if (sql.includes('FROM customer_handovers') && sql.includes('customer_user_id')) {
          return opts.existingHandover ?? null
        }
        if (sql.includes('FROM user_purchases')) {
          return { cnt: opts.purchaseCount ?? 0 }
        }
        return null
      },
      run: async () => ({ success: true, meta: {} }),
    }
    return bound
  }
  const db = { prepare: stmt } as unknown as D1Database
  return { db, calls }
}

const baseOpts = {
  paymentId: 'pay-1',
  email: 'new@example.com',
  tier: 'PREMIUM' as const,
  agencyType: 'b2b_saas' as const,
  isFirstPurchase: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateCustomerUser.mockResolvedValue('user-new-id')
  mockUpsertUserTier.mockResolvedValue(undefined)
  mockPreInstallSops.mockResolvedValue(['sop-1', 'sop-2'])
  mockCreateHandoverRecord.mockResolvedValue('handover-new-id')
  mockCreateMagicLinkToken.mockResolvedValue('magic-tok-abc')
  mockSendTierUpgradeEmail.mockResolvedValue(undefined)
  mockEnqueueWelcomeEmail.mockResolvedValue(undefined)
  mockInstallStarterSop.mockResolvedValue(undefined)
})

describe('triggerAutoHandover — idempotency', () => {
  it('skips with duplicate_payment_id when handover already exists for paymentId', async () => {
    const { db } = createMockD1({ handoverByPayment: { id: 'prev-handover' } })
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover(baseOpts)

    expect(result).toEqual({
      handoverId: null,
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: true,
      skipReason: 'duplicate_payment_id',
    })
    expect(mockCreateCustomerUser).not.toHaveBeenCalled()
    expect(mockUpsertUserTier).not.toHaveBeenCalled()
  })
})

describe('triggerAutoHandover — user resolution', () => {
  it('uses provided userId directly (no email lookup, no create)', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover({ ...baseOpts, userId: 'user-existing' })

    expect(mockCreateCustomerUser).not.toHaveBeenCalled()
    expect(mockUpsertUserTier).toHaveBeenCalledWith(db, 'user-existing', 'PREMIUM', 'new@example.com')
    expect(result.isNewCustomer).toBe(false)
  })

  it('finds user by email when userId omitted (no create)', async () => {
    const { db } = createMockD1({ userByEmail: { id: 'user-by-email' } })
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover(baseOpts)

    expect(mockCreateCustomerUser).not.toHaveBeenCalled()
    expect(mockUpsertUserTier).toHaveBeenCalledWith(db, 'user-by-email', 'PREMIUM', 'new@example.com')
    expect(result.isNewCustomer).toBe(false)
  })

  it('creates new customer when not found by id or email', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover(baseOpts)

    expect(mockCreateCustomerUser).toHaveBeenCalledWith(db, 'new@example.com', 'new')
    expect(result.isNewCustomer).toBe(true)
  })

  it('falls back to email local-part for fullName when not provided', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    await triggerAutoHandover({ ...baseOpts, email: 'jane.doe@example.com' })

    expect(mockCreateCustomerUser).toHaveBeenCalledWith(db, 'jane.doe@example.com', 'jane.doe')
  })

  it('returns user_create_failed when createCustomerUser throws', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)
    mockCreateCustomerUser.mockRejectedValueOnce(new Error('FK fail'))

    const result = await triggerAutoHandover(baseOpts)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('user_create_failed')
    expect(mockUpsertUserTier).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })

  it('fires non-blocking installStarterSop for MASTER tier on new user', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    await triggerAutoHandover({ ...baseOpts, tier: 'MASTER' })

    expect(mockInstallStarterSop).toHaveBeenCalledWith(db, 'user-new-id')
  })

  it('does NOT fire installStarterSop for non-MASTER new users', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    await triggerAutoHandover({ ...baseOpts, tier: 'PREMIUM' })

    expect(mockInstallStarterSop).not.toHaveBeenCalled()
  })
})

describe('triggerAutoHandover — tier upgrade short-circuit', () => {
  it('sends upgrade email + skips SOPs when existing handover + !isFirstPurchase + purchaseCount > 1', async () => {
    const { db } = createMockD1({
      userByEmail: { id: 'user-1' },
      existingHandover: { id: 'old-handover' },
      purchaseCount: 2,
    })
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover({ ...baseOpts, isFirstPurchase: false })

    expect(mockSendTierUpgradeEmail).toHaveBeenCalledWith({
      toEmail: 'new@example.com',
      ownerFullName: 'new',
      newTier: 'PREMIUM',
      locale: 'vi',
    })
    expect(mockPreInstallSops).not.toHaveBeenCalled()
    expect(mockCreateHandoverRecord).not.toHaveBeenCalled()
    expect(result).toEqual({
      handoverId: 'old-handover',
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: false,
    })
  })

  it('does NOT short-circuit when isFirstPurchase=true (treat as fresh handover)', async () => {
    const { db } = createMockD1({
      userByEmail: { id: 'user-1' },
      existingHandover: { id: 'old-handover' },
      purchaseCount: 2,
    })
    mockGetD1Raw.mockResolvedValue(db)

    await triggerAutoHandover({ ...baseOpts, isFirstPurchase: true })

    expect(mockSendTierUpgradeEmail).not.toHaveBeenCalled()
    expect(mockCreateHandoverRecord).toHaveBeenCalled()
  })

  it('does NOT short-circuit when purchaseCount <= 1 (still first paid)', async () => {
    const { db } = createMockD1({
      userByEmail: { id: 'user-1' },
      existingHandover: { id: 'old-handover' },
      purchaseCount: 1,
    })
    mockGetD1Raw.mockResolvedValue(db)

    await triggerAutoHandover({ ...baseOpts, isFirstPurchase: false })

    expect(mockSendTierUpgradeEmail).not.toHaveBeenCalled()
    expect(mockCreateHandoverRecord).toHaveBeenCalled()
  })

  it('swallows tier upgrade email failure (non-fatal warn)', async () => {
    const { db } = createMockD1({
      userByEmail: { id: 'user-1' },
      existingHandover: { id: 'old-handover' },
      purchaseCount: 2,
    })
    mockGetD1Raw.mockResolvedValue(db)
    mockSendTierUpgradeEmail.mockRejectedValueOnce(new Error('resend down'))

    const result = await triggerAutoHandover({ ...baseOpts, isFirstPurchase: false })

    expect(result.skipped).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Tier upgrade email failed'),
      expect.objectContaining({ error: 'resend down' }),
    )
  })
})

describe('triggerAutoHandover — first handover full flow', () => {
  it('installs SOPs, creates record, generates magic link, enqueues welcome email', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover(baseOpts)

    expect(mockPreInstallSops).toHaveBeenCalled()
    expect(mockCreateHandoverRecord).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: 'user-new-id',
        tier: 'PREMIUM',
        agencyType: 'b2b_saas',
        installedSops: ['sop-1', 'sop-2'],
        adminId: 'SYSTEM_AUTO',
        source: 'auto_payment',
        triggerPaymentId: 'pay-1',
      }),
    )
    expect(mockCreateMagicLinkToken).toHaveBeenCalledWith('handover-new-id', { source: 'auto_signup' })
    expect(mockEnqueueWelcomeEmail).toHaveBeenCalled()
    expect(result).toEqual({
      handoverId: 'handover-new-id',
      isNewCustomer: true,
      magicLink: expect.stringMatching(/\/vi\/welcome\/magic-tok-abc$/),
      sopsInstalled: ['sop-1', 'sop-2'],
      skipped: false,
      error: undefined,
    })
  })

  it('returns record_create_failed when createHandoverRecord throws', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)
    mockCreateHandoverRecord.mockRejectedValueOnce(new Error('D1 down'))

    const result = await triggerAutoHandover(baseOpts)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('record_create_failed')
    expect(result.sopsInstalled).toEqual(['sop-1', 'sop-2']) // SOPs already installed
    expect(mockCreateMagicLinkToken).not.toHaveBeenCalled()
  })

  it('continues without magic link when token generation fails (sets error field)', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)
    mockCreateMagicLinkToken.mockRejectedValueOnce(new Error('token table missing'))

    const result = await triggerAutoHandover(baseOpts)

    expect(result.skipped).toBe(false)
    expect(result.handoverId).toBe('handover-new-id')
    expect(result.magicLink).toBeNull()
    expect(result.error).toBe('token table missing')
    expect(mockEnqueueWelcomeEmail).toHaveBeenCalled() // still enqueues w/ login URL fallback
  })

  it('falls back to /login URL in welcome email payload when magic link unavailable', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)
    mockCreateMagicLinkToken.mockRejectedValueOnce(new Error('fail'))

    await triggerAutoHandover(baseOpts)

    const enqueueCall = mockEnqueueWelcomeEmail.mock.calls[0]
    expect(enqueueCall[1].payload.magicLinkUrl).toMatch(/\/vi\/login$/)
  })

  it('swallows enqueue failure (non-fatal warn)', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)
    mockEnqueueWelcomeEmail.mockRejectedValueOnce(new Error('outbox table missing'))

    const result = await triggerAutoHandover(baseOpts)

    expect(result.skipped).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Welcome email enqueue failed'),
      expect.objectContaining({ error: 'outbox table missing' }),
    )
  })
})

describe('triggerAutoHandover — locale path prefix', () => {
  it('omits locale prefix when locale=en (avoid middleware 307 redirect)', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover({ ...baseOpts, locale: 'en' })

    expect(result.magicLink).toMatch(/\/welcome\/magic-tok-abc$/)
    expect(result.magicLink).not.toMatch(/\/en\/welcome/)
  })

  it('includes /vi prefix for non-default locale', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover({ ...baseOpts, locale: 'vi' })

    expect(result.magicLink).toMatch(/\/vi\/welcome\/magic-tok-abc$/)
  })

  it('defaults locale to vi when not provided', async () => {
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover(baseOpts)

    expect(result.magicLink).toMatch(/\/vi\/welcome/)
  })

  it('uses NEXT_PUBLIC_APP_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://custom.example')
    const { db } = createMockD1()
    mockGetD1Raw.mockResolvedValue(db)

    const result = await triggerAutoHandover({ ...baseOpts, locale: 'en' })

    expect(result.magicLink).toBe('https://custom.example/welcome/magic-tok-abc')
    vi.unstubAllEnvs()
  })
})
