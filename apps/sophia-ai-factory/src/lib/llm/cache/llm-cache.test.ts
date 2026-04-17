import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hashCacheKey,
  isCacheEnabled,
  readTtlSeconds,
  lookupCache,
  writeCache,
  type CacheKey,
} from './llm-cache'
import { createServerClient } from '@/lib/db/client'

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}))

const baseKey: CacheKey = {
  provider: 'openrouter',
  model:    'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'hello' }],
}

type MockChain = {
  select: ReturnType<typeof vi.fn>
  eq:     ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
}

function buildChainMock(singleResult: { data: unknown; error: unknown }) {
  const chain: MockChain = {
    select: vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    eq:     vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    single: vi.fn().mockResolvedValue(singleResult),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  // Re-wire .select/.eq to return the chain itself
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function mockDbChain(chain: MockChain) {
  const from = vi.fn().mockReturnValue(chain)
  vi.mocked(createServerClient).mockReturnValue({ from } as unknown as ReturnType<typeof createServerClient>)
  return from
}

describe('llm-cache', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.LLM_CACHE_ENABLED
    delete process.env.LLM_CACHE_TTL_SECONDS
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('isCacheEnabled', () => {
    it('returns false when env unset', () => {
      expect(isCacheEnabled()).toBe(false)
    })

    it('returns false for any value other than "1"', () => {
      process.env.LLM_CACHE_ENABLED = 'true'
      expect(isCacheEnabled()).toBe(false)
    })

    it('returns true only for "1"', () => {
      process.env.LLM_CACHE_ENABLED = '1'
      expect(isCacheEnabled()).toBe(true)
    })
  })

  describe('readTtlSeconds', () => {
    it('defaults to 24h when unset', () => {
      expect(readTtlSeconds()).toBe(24 * 60 * 60)
    })

    it('parses positive integer', () => {
      process.env.LLM_CACHE_TTL_SECONDS = '3600'
      expect(readTtlSeconds()).toBe(3600)
    })

    it('falls back to default on zero', () => {
      process.env.LLM_CACHE_TTL_SECONDS = '0'
      expect(readTtlSeconds()).toBe(24 * 60 * 60)
    })

    it('falls back to default on negative', () => {
      process.env.LLM_CACHE_TTL_SECONDS = '-10'
      expect(readTtlSeconds()).toBe(24 * 60 * 60)
    })

    it('falls back to default on non-numeric', () => {
      process.env.LLM_CACHE_TTL_SECONDS = 'forever'
      expect(readTtlSeconds()).toBe(24 * 60 * 60)
    })
  })

  describe('hashCacheKey', () => {
    it('produces deterministic SHA-256 hex string', async () => {
      const a = await hashCacheKey(baseKey)
      const b = await hashCacheKey(baseKey)
      expect(a).toBe(b)
      expect(a).toMatch(/^[0-9a-f]{64}$/)
    })

    it('differs when provider differs', async () => {
      const a = await hashCacheKey(baseKey)
      const b = await hashCacheKey({ ...baseKey, provider: 'anthropic' })
      expect(a).not.toBe(b)
    })

    it('differs when model differs', async () => {
      const a = await hashCacheKey(baseKey)
      const b = await hashCacheKey({ ...baseKey, model: 'gpt-4o' })
      expect(a).not.toBe(b)
    })

    it('differs when message content differs by one character', async () => {
      const a = await hashCacheKey(baseKey)
      const b = await hashCacheKey({
        ...baseKey,
        messages: [{ role: 'user', content: 'hellp' }],
      })
      expect(a).not.toBe(b)
    })

    it('differs when message order swapped', async () => {
      const two: CacheKey = {
        ...baseKey,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user',   content: 'hi' },
        ],
      }
      const swapped: CacheKey = {
        ...baseKey,
        messages: [
          { role: 'user',   content: 'hi' },
          { role: 'system', content: 'You are helpful' },
        ],
      }
      expect(await hashCacheKey(two)).not.toBe(await hashCacheKey(swapped))
    })
  })

  describe('lookupCache', () => {
    it('returns null when cache disabled', async () => {
      const result = await lookupCache(baseKey)
      expect(result).toBeNull()
      expect(vi.mocked(createServerClient)).not.toHaveBeenCalled()
    })

    it('returns null on D1 miss (error)', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      mockDbChain(buildChainMock({ data: null, error: { message: 'Row not found' } }))

      expect(await lookupCache(baseKey)).toBeNull()
    })

    it('returns entry on fresh D1 hit', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const future = new Date(Date.now() + 60_000).toISOString()
      mockDbChain(buildChainMock({
        data: {
          response:      'cached answer',
          input_tokens:  100,
          output_tokens: 42,
          cost_usd:      0.001,
          expires_at:    future,
        },
        error: null,
      }))

      const result = await lookupCache(baseKey)
      expect(result).toEqual({
        response:     'cached answer',
        inputTokens:  100,
        outputTokens: 42,
        costUsd:      0.001,
      })
    })

    it('returns null when expires_at in the past (expired)', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const past = new Date(Date.now() - 60_000).toISOString()
      mockDbChain(buildChainMock({
        data: {
          response:      'stale',
          input_tokens:  null,
          output_tokens: null,
          cost_usd:      null,
          expires_at:    past,
        },
        error: null,
      }))

      expect(await lookupCache(baseKey)).toBeNull()
    })

    it('swallows D1 throws and returns null (never propagates)', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      vi.mocked(createServerClient).mockImplementation(() => {
        throw new Error('D1 binding unavailable')
      })

      await expect(lookupCache(baseKey)).resolves.toBeNull()
    })

    it('normalizes null token counts to undefined', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const future = new Date(Date.now() + 60_000).toISOString()
      mockDbChain(buildChainMock({
        data: {
          response:      'no tokens recorded',
          input_tokens:  null,
          output_tokens: null,
          cost_usd:      null,
          expires_at:    future,
        },
        error: null,
      }))

      const result = await lookupCache(baseKey)
      expect(result?.inputTokens).toBeUndefined()
      expect(result?.outputTokens).toBeUndefined()
      expect(result?.costUsd).toBeUndefined()
    })
  })

  describe('writeCache', () => {
    it('is no-op when cache disabled', async () => {
      await writeCache(baseKey, { response: 'x' })
      expect(vi.mocked(createServerClient)).not.toHaveBeenCalled()
    })

    it('upserts row with derived hash + expires_at', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const chain = buildChainMock({ data: null, error: null })
      const from = mockDbChain(chain)

      await writeCache(baseKey, {
        response:     'answer',
        inputTokens:  50,
        outputTokens: 20,
        costUsd:      0.0005,
      })

      expect(from).toHaveBeenCalledWith('llm_cache')
      expect(chain.upsert).toHaveBeenCalledTimes(1)
      const payload = chain.upsert.mock.calls[0][0] as Record<string, unknown>
      expect(payload.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(payload.provider).toBe('openrouter')
      expect(payload.model).toBe('openai/gpt-4o-mini')
      expect(payload.response).toBe('answer')
      expect(payload.input_tokens).toBe(50)
      expect(payload.output_tokens).toBe(20)
      expect(payload.cost_usd).toBe(0.0005)
      expect(typeof payload.expires_at).toBe('string')
    })

    it('respects explicit TTL override', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const chain = buildChainMock({ data: null, error: null })
      mockDbChain(chain)
      const before = Date.now()

      await writeCache(baseKey, { response: 'x' }, 10)

      const payload = chain.upsert.mock.calls[0][0] as { expires_at: string }
      const expiresMs = new Date(payload.expires_at).getTime()
      // 10s TTL → expiry within ±2s of (now + 10s)
      expect(expiresMs).toBeGreaterThanOrEqual(before + 10_000 - 2_000)
      expect(expiresMs).toBeLessThanOrEqual(before + 10_000 + 2_000)
    })

    it('does not include hit_count in payload (preserves count on upsert)', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const chain = buildChainMock({ data: null, error: null })
      mockDbChain(chain)

      await writeCache(baseKey, { response: 'x' })

      const payload = chain.upsert.mock.calls[0][0] as Record<string, unknown>
      expect(payload).not.toHaveProperty('hit_count')
      expect(payload).not.toHaveProperty('created_at')
    })

    it('swallows D1 throws silently (never rejects caller)', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      vi.mocked(createServerClient).mockImplementation(() => {
        throw new Error('D1 unavailable')
      })

      await expect(writeCache(baseKey, { response: 'x' })).resolves.toBeUndefined()
    })

    it('swallows upsert rejection silently', async () => {
      process.env.LLM_CACHE_ENABLED = '1'
      const chain = buildChainMock({ data: null, error: null })
      chain.upsert.mockRejectedValue(new Error('UNIQUE constraint failed'))
      mockDbChain(chain)

      await expect(writeCache(baseKey, { response: 'x' })).resolves.toBeUndefined()
    })
  })
})
