/**
 * Phase 7B — script-generator BYOK wire.
 *
 * Narrow scope: verifies the OpenRouter key resolution flows through
 * resolveUserApiKey (BYOK-aware) instead of reading process.env directly.
 * Full happy-path script-generation mechanics are covered transitively via
 * automation.test.ts + the callWithCache integration surface.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/llm/cache/call-with-cache', () => ({
  callWithCache: vi.fn(),
}))

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn((_userId, _provider, envFallback) =>
    Promise.resolve(envFallback ?? null),
  ),
}))

vi.mock('@/lib/usage-metering', () => ({
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

import { generateScript } from './script-generator'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { callWithCache } from '@/lib/llm/cache/call-with-cache'

const mockResolveUserApiKey = vi.mocked(resolveUserApiKey)
const mockCallWithCache     = vi.mocked(callWithCache)

describe('generateScript — Phase 7B BYOK wire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveUserApiKey.mockImplementation((_u, _p, envFallback) =>
      Promise.resolve(envFallback ?? null),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls resolveUserApiKey with real userId + openrouter + env fallback', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback')
    // Force cache path to throw so we skip the full flow and exit via mock
    mockCallWithCache.mockRejectedValue(new Error('halt'))

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
  })

  it('passes null userId when no context (sentinel "unknown" not forwarded as real id)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback')
    mockCallWithCache.mockRejectedValue(new Error('halt'))

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
  })

  it('falls back to mock script when resolveUserApiKey returns null (no env, no BYOK)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')
    mockResolveUserApiKey.mockResolvedValueOnce(null)

    const out = await generateScript({
      topic:    'golang',
      audience: 'backend devs',
      tier:     'BASIC' as never,
      userId:   'user-no-key',
    })

    // Mock script is deterministic — check title prefix
    expect(out.title).toBe('The Ultimate Guide to golang')
    expect(mockCallWithCache).not.toHaveBeenCalled()
  })
})
