/**
 * Tests for affiliate-openrouter-niche-enhancer routing branches.
 *
 * Covers Phase A "eat-own-dogfood" routing:
 *   - SOPHIA_LOCAL_MEKONGD_URL absent → existing OpenRouter path (unchanged)
 *   - URL set + local returns score → uses local, OpenRouter NOT called
 *   - URL set + local returns null → falls back to OpenRouter
 *   - No OPENROUTER_API_KEY + no local URL → returns null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AffiliateProgram } from '@/types'
import { enhanceNicheScoreWithAI } from './affiliate-openrouter-niche-enhancer'

vi.mock('@/lib/byok/local-mekongd-adapter', () => ({
  callLocalMekongd: vi.fn(),
}))
vi.mock('@/lib/byok/with-timeout', () => ({
  withTimeout: vi.fn(),
}))

import { callLocalMekongd } from '@/lib/byok/local-mekongd-adapter'
import { withTimeout } from '@/lib/byok/with-timeout'

const mockLocal = vi.mocked(callLocalMekongd)
const mockOpenRouter = vi.mocked(withTimeout)

const program: AffiliateProgram = {
  id: 'p1',
  name: 'TestProgram',
  category: 'finance',
  description: 'demo',
} as AffiliateProgram

const ORIGINAL_ENV = { ...process.env }

describe('enhanceNicheScoreWithAI() — local-mekongd routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOPHIA_LOCAL_MEKONGD_URL
    delete process.env.SOPHIA_LOCAL_MEKONGD_BEARER
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns null when neither local URL nor OpenRouter key is set', async () => {
    const score = await enhanceNicheScoreWithAI(program, 'fintech')
    expect(score).toBeNull()
    expect(mockLocal).not.toHaveBeenCalled()
    expect(mockOpenRouter).not.toHaveBeenCalled()
  })

  it('uses local mekongd when SOPHIA_LOCAL_MEKONGD_URL is set; OpenRouter NOT called', async () => {
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://mekongd.cashclaw.cc'
    process.env.OPENROUTER_API_KEY = 'sk-or-test'
    mockLocal.mockResolvedValueOnce('85')

    const score = await enhanceNicheScoreWithAI(program, 'fintech')

    expect(score).toBe(85)
    expect(mockLocal).toHaveBeenCalledTimes(1)
    expect(mockOpenRouter).not.toHaveBeenCalled()
  })

  it('falls back to OpenRouter when local returns null', async () => {
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://mekongd.cashclaw.cc'
    process.env.OPENROUTER_API_KEY = 'sk-or-test'
    mockLocal.mockResolvedValueOnce(null)
    mockOpenRouter.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '72' } }] }),
    } as Response)

    const score = await enhanceNicheScoreWithAI(program, 'fintech')

    expect(score).toBe(72)
    expect(mockLocal).toHaveBeenCalledTimes(1)
    expect(mockOpenRouter).toHaveBeenCalledTimes(1)
  })

  it('passes bearer when SOPHIA_LOCAL_MEKONGD_BEARER is set', async () => {
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://mekongd.cashclaw.cc'
    process.env.SOPHIA_LOCAL_MEKONGD_BEARER = 'tunnel-secret'
    mockLocal.mockResolvedValueOnce('50')

    await enhanceNicheScoreWithAI(program, 'fintech')

    expect(mockLocal).toHaveBeenCalledWith(
      expect.stringContaining('Rate how well'),
      expect.objectContaining({
        endpoint: 'https://mekongd.cashclaw.cc',
        bearer: 'tunnel-secret',
      }),
    )
  })

  it('clamps local score to 0..100 range', async () => {
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://mekongd.cashclaw.cc'
    mockLocal.mockResolvedValueOnce('150')

    const score = await enhanceNicheScoreWithAI(program, 'fintech')

    expect(score).toBe(100)
  })
})
