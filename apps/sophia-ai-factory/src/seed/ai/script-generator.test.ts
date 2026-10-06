/**
 * Phase 7B — script-generator BYOK wire (seed layer).
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

import { generateScript, registerApiKeyResolver } from './script-generator'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { resilientChatCompletion, resetOpenRouterCircuit } from '@/seed/inference/openrouter-client'

const mockResolveUserApiKey = vi.mocked(resolveUserApiKey)
const mockResilientChatCompletion = vi.mocked(resilientChatCompletion)

describe('generateScript — Phase 7B BYOK wire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenRouterCircuit()
    registerApiKeyResolver(mockResolveUserApiKey as never)
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

  it('safely uses OPENROUTER_API_KEY directly when no resolver is registered', async () => {
    registerApiKeyResolver(null)
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-direct-env-key')

    const out = await generateScript({
      topic:    'nextjs',
      audience: 'frontend devs',
      tier:     'BASIC' as never,
    })

    expect(mockResolveUserApiKey).not.toHaveBeenCalled()
    expect(mockResilientChatCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        openRouterKey: 'sk-direct-env-key',
      }),
    )
    expect(out).toEqual(expect.objectContaining({
      title: 'T',
    }))
  }, 15000)

  it('safely falls back to mock script when no resolver is registered and OPENROUTER_API_KEY is empty', async () => {
    registerApiKeyResolver(null)
    vi.stubEnv('OPENROUTER_API_KEY', '')

    const out = await generateScript({
      topic:    'nextjs',
      audience: 'frontend devs',
      tier:     'BASIC' as never,
    })

    expect(mockResolveUserApiKey).not.toHaveBeenCalled()
    expect(mockResilientChatCompletion).not.toHaveBeenCalled()
    expect(out).toEqual(expect.objectContaining({
      title: expect.stringContaining('nextjs'),
    }))
  }, 15000)

  it('safely falls back to OPENROUTER_API_KEY when registered resolver throws an error', async () => {
    mockResolveUserApiKey.mockRejectedValueOnce(new Error('Resolver network timeout'))
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback-on-error')

    const out = await generateScript({
      topic:    'rust',
      audience: 'systems devs',
      tier:     'BASIC' as never,
    })

    expect(mockResolveUserApiKey).toHaveBeenCalled()
    expect(mockResilientChatCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        openRouterKey: 'sk-env-fallback-on-error',
      }),
    )
    expect(out).toEqual(expect.objectContaining({
      title: 'T',
    }))
  }, 15000)
})
