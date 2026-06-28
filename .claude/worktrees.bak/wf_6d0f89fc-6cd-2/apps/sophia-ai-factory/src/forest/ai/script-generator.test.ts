/**
 * Phase 7B — script-generator BYOK wire.
 *
 * Narrow scope: verifies the OpenRouter key resolution flows through
 * resolveUserApiKey (BYOK-aware) instead of reading process.env directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn((_userId, _provider, envFallback) =>
    Promise.resolve(envFallback ?? null),
  ),
}))

vi.mock('@/forest/usage-metering', () => ({
  trackUsage:       vi.fn().mockResolvedValue(undefined),
  hashLicenseKey:   vi.fn().mockReturnValue('hash'),
  calculateCredits: vi.fn().mockReturnValue(1),
  startTimer:       vi.fn().mockReturnValue(() => 5),
}))

vi.mock('@/forest/usage-metering/context', () => ({
  getUsageContext: vi.fn().mockReturnValue(null),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/seed/inference/openrouter-client', () => ({
  resilientChatCompletion: vi.fn().mockResolvedValue('{"title":"T","scenes":[{"content":"c"}]}'),
  resetOpenRouterCircuit: vi.fn(),
}))

import { generateScript } from './script-generator'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { resetOpenRouterCircuit } from '@/seed/inference/openrouter-client'

const mockResolveUserApiKey = vi.mocked(resolveUserApiKey)

describe('generateScript — Phase 7B BYOK wire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenRouterCircuit()
    mockResolveUserApiKey.mockImplementation((_u, _p, envFallback) =>
      Promise.resolve(envFallback ?? null),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls resolveUserApiKey with real userId + openrouter + env fallback', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback')

    await generateScript({
      topic:    'ai tools',
      audience: 'makers',
      tier:     'BASIC' as never,
      userId:   'user-abc',
    })

    expect(mockResolveUserApiKey).toHaveBeenCalledWith(
      'user-abc',
      'openrouter',
      'sk-env-fallback',
    )
  }, 15000)

  it('passes null userId when no context (sentinel "unknown" not forwarded as real id)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback')

    await generateScript({
      topic:    'ai tools',
      audience: 'makers',
      tier:     'BASIC' as never,
      // userId intentionally omitted
    })

    expect(mockResolveUserApiKey).toHaveBeenCalledWith(
      null,
      'openrouter',
      'sk-env-fallback',
    )
  }, 15000)

  it('falls back to mock script when resolveUserApiKey returns null (no env, no BYOK)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')
    mockResolveUserApiKey.mockResolvedValueOnce(null)

    const out = await generateScript({
      topic:    'golang',
      audience: 'backend devs',
      tier:     'BASIC' as never,
    })

    expect(out).toEqual(expect.objectContaining({
      title: expect.stringContaining('golang'),
    }))
  }, 15000)
})
