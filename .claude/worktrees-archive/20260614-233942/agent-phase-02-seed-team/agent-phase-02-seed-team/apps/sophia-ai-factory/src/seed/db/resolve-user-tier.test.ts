import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./get-user-tier', () => ({
  getUserTier: vi.fn(),
  normalizePlanToTier: (plan: string | null | undefined) => {
    if (!plan) return 'BASIC'
    const upper = plan.toUpperCase()
    return ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].includes(upper) ? upper : 'BASIC'
  },
}))

import { getUserTier } from './get-user-tier'
import { resolveUserTier } from './resolve-user-tier'

const mockGetUserTier = vi.mocked(getUserTier)

function installD1Total(total: number) {
  const first = vi.fn().mockResolvedValue({ total })
  const bind = vi.fn(() => ({ first }))
  const prepare = vi.fn(() => ({ bind }))
  ;(globalThis as unknown as { __env?: { DB?: unknown } }).__env = {
    DB: { prepare },
  }
  return { prepare, bind, first }
}

afterEach(() => {
  vi.clearAllMocks()
  delete (globalThis as unknown as { __env?: unknown }).__env
})

describe('resolveUserTier', () => {
  it('uses USD affiliate gross_amount directly when resolving earned tier', async () => {
    mockGetUserTier.mockResolvedValue('BASIC')
    installD1Total(250)

    await expect(resolveUserTier('user-1')).resolves.toBe('ENTERPRISE')
  })

  it('keeps the higher subscription tier when affiliate earnings are lower', async () => {
    mockGetUserTier.mockResolvedValue('MASTER')
    installD1Total(50)

    await expect(resolveUserTier('user-1')).resolves.toBe('MASTER')
  })

  it('only counts payable affiliate conversion states', async () => {
    mockGetUserTier.mockResolvedValue('BASIC')
    const { prepare } = installD1Total(1000)

    await resolveUserTier('user-1')

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("payout_status IN ('available', 'pending_clearance')"))
  })
})
