/**
 * Phase 7B — script-generator BYOK wire & Growth Triad v16 steering.
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

const VALID_LLM_SCRIPT_JSON = JSON.stringify({
  title: 'Test Script',
  scenes: [
    {
      scene_number: 1,
      visual_description: 'Opening hook shot',
      narration: 'Stop scrolling and watch this.',
      duration_estimate: 5,
    },
    {
      scene_number: 2,
      visual_description: 'Product demo montage',
      narration: 'Here is how it saves you hours every week.',
      duration_estimate: 10,
    },
    {
      scene_number: 3,
      visual_description: 'Host call to action',
      narration: 'Click the link below to start today.',
      duration_estimate: 5,
    },
  ],
  total_duration: 20,
})

vi.mock('@/seed/inference/openrouter-client', () => ({
  resilientChatCompletion: vi.fn(),
  resetOpenRouterCircuit: vi.fn(),
}))

import {
  generateScript,
  registerApiKeyResolver,
  InvalidScriptStructureError,
} from './script-generator'
import { buildScriptUserPrompt } from './script-prompt-builders'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { resilientChatCompletion, resetOpenRouterCircuit } from '@/seed/inference/openrouter-client'

const mockResolveUserApiKey = vi.mocked(resolveUserApiKey)
const mockResilientChatCompletion = vi.mocked(resilientChatCompletion)

describe('generateScript — Phase 7B BYOK wire & v16 Prior Steering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResilientChatCompletion.mockResolvedValue(VALID_LLM_SCRIPT_JSON)
    resetOpenRouterCircuit()
    registerApiKeyResolver(mockResolveUserApiKey as never)
    mockResolveUserApiKey.mockImplementation((_u, _p, envFallback) =>
      Promise.resolve(envFallback ?? null),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls resolveUserApiKey with real userId + openrouter without env fallback', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback')
    mockResolveUserApiKey.mockResolvedValueOnce('sk-user-byok')

    await generateScript({
      topic:    'ai tools',
      audience: 'makers',
      tier:     'BASIC' as never,
      userId:   'user-abc',
    })

    expect(mockResolveUserApiKey).toHaveBeenCalledWith(
      'user-abc',
      'openrouter',
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

  it('fails closed to mock script when no resolver is registered even if OPENROUTER_API_KEY is set', async () => {
    registerApiKeyResolver(null)
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-direct-env-key')

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

  it('fails closed to mock script when registered resolver throws an error (never spends platform env key)', async () => {
    mockResolveUserApiKey.mockRejectedValueOnce(new Error('Resolver network timeout'))
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-env-fallback-on-error')

    const out = await generateScript({
      topic:    'rust',
      audience: 'systems devs',
      tier:     'BASIC' as never,
    })

    expect(mockResolveUserApiKey).toHaveBeenCalled()
    expect(mockResilientChatCompletion).not.toHaveBeenCalled()
    expect(out).toEqual(expect.objectContaining({
      title: expect.stringContaining('rust'),
    }))
  }, 15000)

  it('uses only explicit customer funding without consulting a fallback resolver', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'platform-key-must-not-spend')
    await generateScript({ topic: 'fitness', audience: 'beginners', tier: 'BASIC', userId: 'buyer' }, {
      funding: { fund: 'byok', apiKey: 'customer-openrouter-key' },
    })
    expect(mockResolveUserApiKey).not.toHaveBeenCalled()
    expect(mockResilientChatCompletion).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      openRouterKey: 'customer-openrouter-key', enableFallback: false,
    }))
  })

  it('rejects empty explicit customer funding without mock output or platform fallback', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'platform-key-must-not-spend')
    await expect(generateScript({ topic: 'fitness', audience: 'beginners', tier: 'BASIC' }, {
      funding: { fund: 'byok', apiKey: '   ' },
    })).rejects.toThrow('Customer OpenRouter key is required')
    expect(mockResolveUserApiKey).not.toHaveBeenCalled()
    expect(mockResilientChatCompletion).not.toHaveBeenCalled()
  })

  it('injects Bayesian prior steering constraints into prompt when provided', async () => {
    mockResolveUserApiKey.mockResolvedValueOnce('sk-user-byok-key')

    await generateScript({
      topic:    'trading',
      audience: 'crypto traders',
      tier:     'BASIC' as never,
      steering: {
        targetHookDropoffThreshold: 18,
        expectedRetentionMultiplier: 1.25,
        winningHookArchetype: 'Pattern Interrupt',
        pacingDirective: 'High-velocity 3-second hook with immediate visual disruption.',
      },
    })

    expect(mockResilientChatCompletion).toHaveBeenCalledWith(
      expect.stringContaining('Empirical Performance Constraints (Growth Feedback Prior)'),
      expect.objectContaining({
        openRouterKey: 'sk-user-byok-key',
      }),
    )
  }, 15000)

  it('keeps legacy 15-30 seconds prompt text when durationSec is omitted', () => {
    const prompt = buildScriptUserPrompt('fitness', 'beginners')
    expect(prompt).toContain('Total duration: 15-30 seconds')
  })

  it.each([10, 60, 180, 300])(
    'forwards durationSec=%i into prompt and accepts in-range output duration',
    async (durationSec) => {
      const expectedMin = Math.max(5, Math.round(durationSec * 0.5))
      const expectedMax = Math.round(durationSec * 1.5)
      const sceneDuration = Math.max(1, Math.round(durationSec / 3))

      mockResilientChatCompletion.mockResolvedValueOnce(
        JSON.stringify({
          title: `Script for ${durationSec}s`,
          scenes: [
            {
              scene_number: 1,
              visual_description: 'Hook visual',
              narration: 'Hook narration',
              duration_estimate: sceneDuration,
            },
            {
              scene_number: 2,
              visual_description: 'Body visual',
              narration: 'Body narration',
              duration_estimate: sceneDuration,
            },
            {
              scene_number: 3,
              visual_description: 'CTA visual',
              narration: 'CTA narration',
              duration_estimate: sceneDuration,
            },
          ],
          total_duration: durationSec,
        }),
      )

      const out = await generateScript(
        {
          topic: 'fitness',
          audience: 'beginners',
          tier: 'BASIC',
          durationSec,
        },
        { funding: { fund: 'byok', apiKey: 'sk-customer-byok' } },
      )

      expect(mockResilientChatCompletion).toHaveBeenCalledWith(
        expect.stringContaining(
          `Total duration: approximately ${durationSec} seconds (strictly within ${expectedMin}-${expectedMax} seconds)`,
        ),
        expect.objectContaining({ openRouterKey: 'sk-customer-byok' }),
      )
      expect(out.total_duration).toBe(durationSec)
    },
  )

  it('fails closed when output total_duration is outside allowed range for durationSec', async () => {
    const trackUsage = vi.fn().mockResolvedValue(undefined)
    mockResilientChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        title: 'Too short script',
        scenes: [
          {
            scene_number: 1,
            visual_description: 'Hook visual',
            narration: 'Hook narration',
            duration_estimate: 5,
          },
          {
            scene_number: 2,
            visual_description: 'CTA visual',
            narration: 'CTA narration',
            duration_estimate: 5,
          },
        ],
        total_duration: 10,
      }),
    )

    await expect(
      generateScript(
        {
          topic: 'fitness',
          audience: 'beginners',
          tier: 'BASIC',
          durationSec: 180,
        },
        { funding: { fund: 'byok', apiKey: 'sk-customer-byok' }, trackUsage },
      ),
    ).rejects.toThrow(InvalidScriptStructureError)

    expect(trackUsage).toHaveBeenCalledTimes(1)
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        creditsUsed: 0,
        errorMessage: expect.stringContaining('total_duration'),
      }),
    )
  })

  it.each([
    [
      'missing narration',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 1, visual_description: 'V', duration_estimate: 5 }],
        total_duration: 5,
      }),
      'narration',
    ],
    [
      'whitespace-only narration',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 1, visual_description: 'V', narration: '   ', duration_estimate: 5 }],
        total_duration: 5,
      }),
      'narration',
    ],
    [
      'whitespace-only visual_description',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 1, visual_description: '  ', narration: 'Hi', duration_estimate: 5 }],
        total_duration: 5,
      }),
      'visual_description',
    ],
    [
      'non-positive duration_estimate',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 1, visual_description: 'V', narration: 'Hi', duration_estimate: 0 }],
        total_duration: 5,
      }),
      'duration_estimate',
    ],
    [
      'invalid scene_number',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 0, visual_description: 'V', narration: 'Hi', duration_estimate: 5 }],
        total_duration: 5,
      }),
      'scene_number',
    ],
    [
      'non-positive total_duration',
      JSON.stringify({
        title: 'T',
        scenes: [{ scene_number: 1, visual_description: 'V', narration: 'Hi', duration_estimate: 5 }],
        total_duration: 0,
      }),
      'total_duration',
    ],
  ])(
    'rejects malformed LLM output (%s) and records creditsUsed: 0',
    async (_label, payload, expectedFragment) => {
      const trackUsage = vi.fn().mockResolvedValue(undefined)
      mockResilientChatCompletion.mockResolvedValueOnce(payload)

      await expect(
        generateScript(
          { topic: 'fitness', audience: 'beginners', tier: 'BASIC' },
          { funding: { fund: 'byok', apiKey: 'sk-customer-byok' }, trackUsage },
        ),
      ).rejects.toThrow(expectedFragment)

      expect(trackUsage).toHaveBeenCalledTimes(1)
      expect(trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          creditsUsed: 0,
          errorMessage: expect.stringContaining(expectedFragment),
        }),
      )
    },
  )
})


describe('caller-specific output contracts', () => {
  it.each([15, 45, 75])('accepts prompt integer bounds and rejects adjacent outside durations for %i seconds', async (durationSec) => {
    const min = Math.ceil(Math.max(5, durationSec * 0.5))
    const max = Math.floor(durationSec * 1.5)
    expect(buildScriptUserPrompt('topic', 'audience', undefined, undefined, durationSec))
      .toContain(`strictly within ${min}-${max} seconds`)
    for (const totalDuration of [min, max, min - 1, max + 1]) {
      const payload = JSON.parse(VALID_LLM_SCRIPT_JSON) as { total_duration: number }
      payload.total_duration = totalDuration
      mockResilientChatCompletion.mockResolvedValueOnce(JSON.stringify(payload))
      const result = generateScript({ topic: 'topic', audience: 'audience', tier: 'BASIC', durationSec }, {
        funding: { fund: 'byok', apiKey: 'customer-key' },
      })
      if (totalDuration === min || totalDuration === max) {
        await expect(result).resolves.toMatchObject({ total_duration: totalDuration })
      } else {
        await expect(result).rejects.toThrow('outside allowed range')
      }
    }
  })

  it('rejects two scenes before billing when the caller requires three, preserving legacy one-scene callers', async () => {
    const payload = JSON.parse(VALID_LLM_SCRIPT_JSON) as { scenes: unknown[] }
    payload.scenes = payload.scenes.slice(0, 2)
    mockResilientChatCompletion.mockResolvedValueOnce(JSON.stringify(payload))
    const trackUsage = vi.fn().mockResolvedValue(undefined)
    await expect(generateScript({ topic: 'topic', audience: 'audience', tier: 'BASIC' }, {
      funding: { fund: 'byok', apiKey: 'customer-key' }, minScenes: 3, trackUsage,
    })).rejects.toThrow('at least 3')
    expect(trackUsage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ creditsUsed: 0 }))
    payload.scenes = payload.scenes.slice(0, 1)
    mockResilientChatCompletion.mockResolvedValueOnce(JSON.stringify(payload))
    await expect(generateScript({ topic: 'topic', audience: 'audience', tier: 'BASIC' }, {
      funding: { fund: 'byok', apiKey: 'customer-key' },
    })).resolves.toMatchObject({ scenes: expect.arrayContaining([expect.objectContaining({ scene_number: 1 })]) })
  })
})
