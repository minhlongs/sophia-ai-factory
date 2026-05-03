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
import type { AffiliateProgram } from '@/seed/types'
import { enhanceNicheScoreWithAI } from './affiliate-openrouter-niche-enhancer'

vi.mock('@/tree/byok/local-mekongd-adapter', () => ({
  callLocalMekongd: vi.fn(),
}))
vi.mock('@/tree/byok/with-timeout', () => ({
  withTimeout: vi.fn(),
}))
vi.mock('@/tree/byok/provider-router', () => ({
  resolveLocalMekongdForUser: vi.fn(),
}))
vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn((_userId, _provider, envFallback) =>
    Promise.resolve(envFallback ?? null),
  ),
}))

import { callLocalMekongd } from '@/tree/byok/local-mekongd-adapter'
import { withTimeout } from '@/tree/byok/with-timeout'
import { resolveLocalMekongdForUser } from '@/tree/byok/provider-router'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'

const mockLocal = vi.mocked(callLocalMekongd)
const mockOpenRouter = vi.mocked(withTimeout)
const mockResolveUser = vi.mocked(resolveLocalMekongdForUser)
const mockResolveByokKey = vi.mocked(resolveUserApiKey)

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
    // Default: user router returns null (no per-user config)
    mockResolveUser.mockResolvedValue(null)
    // Reset pass-through BYOK default wiped by clearAllMocks.
    mockResolveByokKey.mockImplementation((_u, _p, envFallback) =>
      Promise.resolve(envFallback ?? null),
    )
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

  // Phase B: per-user BYOK routing cases

  it('uses per-user local config when userId provided and resolveLocalMekongdForUser returns config', async () => {
    const userConfig = { endpoint: 'https://user-tunnel.example.com', bearer: 'user-token' }
    mockResolveUser.mockResolvedValueOnce(userConfig)
    mockLocal.mockResolvedValueOnce('77')
    // env also set — should NOT be reached
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://founder-tunnel.cashclaw.cc'
    process.env.OPENROUTER_API_KEY = 'sk-or-test'

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz')

    expect(score).toBe(77)
    expect(mockResolveUser).toHaveBeenCalledWith('user-xyz')
    // callLocalMekongd should have been called with user config (not founder env)
    expect(mockLocal).toHaveBeenCalledWith(
      expect.stringContaining('Rate how well'),
      userConfig,
    )
    // OpenRouter should not be called
    expect(mockOpenRouter).not.toHaveBeenCalled()
  })

  it('falls back to env path when userId provided but user config resolves null', async () => {
    mockResolveUser.mockResolvedValueOnce(null)
    process.env.SOPHIA_LOCAL_MEKONGD_URL = 'https://founder-tunnel.cashclaw.cc'
    mockLocal.mockResolvedValueOnce('62')

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz')

    expect(score).toBe(62)
    // Should have tried user router
    expect(mockResolveUser).toHaveBeenCalledWith('user-xyz')
    // Should have fallen through to env path
    expect(mockLocal).toHaveBeenCalledWith(
      expect.stringContaining('Rate how well'),
      expect.objectContaining({ endpoint: 'https://founder-tunnel.cashclaw.cc' }),
    )
  })

  // Phase 7C: BYOK OpenRouter key resolution in the cloud-fallback path.

  it('7C: OpenRouter fetch uses BYOK-resolved key (user key wins over env)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-env'
    mockResolveUser.mockResolvedValueOnce(null) // no local config for user
    mockResolveByokKey.mockResolvedValueOnce('sk-or-user-byok')
    mockOpenRouter.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '91' } }] }),
    } as Response)

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz')

    expect(score).toBe(91)
    // BYOK resolver called with userId + openrouter + env fallback
    expect(mockResolveByokKey).toHaveBeenCalledWith(
      'user-xyz',
      'openrouter',
      'sk-or-env',
    )
    // Authorization header carries the user's BYOK key, not the env fallback
    expect(mockOpenRouter).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-user-byok',
        }),
      }),
    )
  })

  it('7C: OpenRouter fetch skipped when BYOK resolver returns null (no env, no user key)', async () => {
    // no env key set, no user key
    mockResolveUser.mockResolvedValueOnce(null)
    mockResolveByokKey.mockResolvedValueOnce(null)

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz')

    expect(score).toBeNull()
    expect(mockOpenRouter).not.toHaveBeenCalled()
  })
})
