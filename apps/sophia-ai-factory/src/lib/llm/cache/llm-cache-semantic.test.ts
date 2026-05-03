/**
 * Tests for llm-cache-semantic — Phase 4E.2.
 *
 * Coverage:
 *   - cosineSimilarity pure math (identical / orthogonal / opposite / zero-mag)
 *   - embed encode/decode round-trip
 *   - isSemanticCacheEnabled env gate
 *   - trySemanticFallback: gate off, orgId empty, binding missing, happy path
 *   - semanticLookup: threshold filtering, best-of-K pick, expired rows skipped
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cosineSimilarity,
  decodeEmbedding,
  encodeEmbedding,
  isSemanticCacheEnabled,
  trySemanticFallback,
} from './llm-cache-semantic'
import type { CacheKey } from './llm-cache'
import { createServerClient } from '@/seed/db/client'

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}))

const baseKey: CacheKey = {
  provider: 'openrouter',
  model:    'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'what is the weather in hanoi?' }],
  orgId:    'org-semantic-a',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ChainMock {
  select: ReturnType<typeof vi.fn>
  eq:     ReturnType<typeof vi.fn>
  order:  ReturnType<typeof vi.fn>
  limit:  ReturnType<typeof vi.fn>
}

function buildChainMock(result: { data: unknown; error: unknown }): ChainMock {
  const chain: ChainMock = {
    select: vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    eq:     vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    order:  vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    limit:  vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  return chain
}

function mockDbChain(chain: ChainMock) {
  const from = vi.fn().mockReturnValue(chain)
  vi.mocked(createServerClient).mockReturnValue({ from, rpc: vi.fn() } as unknown as ReturnType<typeof createServerClient>)
  return from
}

function setAiBinding(runImpl: (model: string, input: unknown) => Promise<unknown>) {
  ;(globalThis as unknown as { AI: unknown }).AI = { run: runImpl }
}

function clearAiBinding() {
  delete (globalThis as unknown as { AI?: unknown }).AI
}

// Build a fake embedding matching the dim the real model returns (smaller for tests).
function makeVec(values: number[]): Float32Array {
  return Float32Array.from(values)
}

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = makeVec([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 6)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(makeVec([1, 0, 0]), makeVec([0, 1, 0]))).toBe(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity(makeVec([1, 2, 3]), makeVec([-1, -2, -3]))).toBeCloseTo(-1, 6)
  })

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity(makeVec([1, 2]), makeVec([1, 2, 3]))).toBe(0)
  })

  it('returns 0 for zero-magnitude input', () => {
    expect(cosineSimilarity(makeVec([0, 0, 0]), makeVec([1, 2, 3]))).toBe(0)
  })
})

// ── encode/decode round-trip ──────────────────────────────────────────────────

describe('encodeEmbedding / decodeEmbedding', () => {
  it('round-trips Float32Array through Uint8Array without loss', () => {
    const orig = makeVec([0.1, -0.25, 1e-6, 1e6, 0])
    const bytes = encodeEmbedding(orig)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.byteLength).toBe(orig.byteLength)

    const restored = decodeEmbedding(bytes)
    expect(Array.from(restored)).toEqual(Array.from(orig))
  })
})

// ── isSemanticCacheEnabled ────────────────────────────────────────────────────

describe('isSemanticCacheEnabled', () => {
  beforeEach(() => {
    delete process.env.LLM_CACHE_SEMANTIC_ENABLED
  })

  it('false when unset', () => {
    expect(isSemanticCacheEnabled()).toBe(false)
  })

  it('false for "true" (strict "1")', () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = 'true'
    expect(isSemanticCacheEnabled()).toBe(false)
  })

  it('true only for "1"', () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    expect(isSemanticCacheEnabled()).toBe(true)
  })
})

// ── trySemanticFallback ───────────────────────────────────────────────────────

describe('trySemanticFallback', () => {
  beforeEach(() => {
    delete process.env.LLM_CACHE_SEMANTIC_ENABLED
    vi.clearAllMocks()
    clearAiBinding()
  })

  afterEach(() => {
    clearAiBinding()
  })

  it('returns null when semantic cache disabled', async () => {
    const result = await trySemanticFallback(baseKey)
    expect(result).toBeNull()
    expect(vi.mocked(createServerClient)).not.toHaveBeenCalled()
  })

  it('returns null when orgId is empty (defense-in-depth)', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    const result = await trySemanticFallback({ ...baseKey, orgId: '' })
    expect(result).toBeNull()
  })

  it('returns null when AI binding missing', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    // No AI binding set → embedPrompt → null
    const result = await trySemanticFallback(baseKey)
    expect(result).toBeNull()
  })

  it('returns best candidate above threshold', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    process.env.LLM_CACHE_SIMILARITY_THRESHOLD = '0.9'

    // Query vector
    const queryVec = makeVec([1, 0, 0])
    setAiBinding(async () => ({ data: [Array.from(queryVec)] }))

    // Two candidates: one nearly-identical (0.98), one unrelated (~0)
    const hotCandidate  = makeVec([0.98, 0.199, 0])   // cosine ≈ 0.98
    const coldCandidate = makeVec([0, 1, 0])          // cosine = 0
    const future = new Date(Date.now() + 60_000).toISOString()

    mockDbChain(buildChainMock({
      data: [
        { hash: 'h1', response: 'hot answer', input_tokens: 5, output_tokens: 10, cost_usd: 0.001,
          expires_at: future, embedding: encodeEmbedding(hotCandidate) },
        { hash: 'h2', response: 'cold answer', input_tokens: null, output_tokens: null, cost_usd: null,
          expires_at: future, embedding: encodeEmbedding(coldCandidate) },
      ],
      error: null,
    }))

    const result = await trySemanticFallback(baseKey)
    expect(result).not.toBeNull()
    expect(result!.response).toBe('hot answer')
    expect(result!.inputTokens).toBe(5)
  })

  it('returns null when all candidates below threshold', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    process.env.LLM_CACHE_SIMILARITY_THRESHOLD = '0.95'

    const queryVec = makeVec([1, 0, 0])
    setAiBinding(async () => ({ data: [Array.from(queryVec)] }))

    const weakCandidate = makeVec([0.5, 0.8, 0])     // cosine ≈ 0.53
    const future = new Date(Date.now() + 60_000).toISOString()

    mockDbChain(buildChainMock({
      data: [
        { hash: 'h1', response: 'weak', input_tokens: null, output_tokens: null, cost_usd: null,
          expires_at: future, embedding: encodeEmbedding(weakCandidate) },
      ],
      error: null,
    }))

    const result = await trySemanticFallback(baseKey)
    expect(result).toBeNull()
  })

  it('skips expired candidates even when similarity high', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'

    const queryVec = makeVec([1, 0, 0])
    setAiBinding(async () => ({ data: [Array.from(queryVec)] }))

    const past = new Date(Date.now() - 60_000).toISOString()

    mockDbChain(buildChainMock({
      data: [
        { hash: 'h1', response: 'expired-hit', input_tokens: null, output_tokens: null, cost_usd: null,
          expires_at: past, embedding: encodeEmbedding(queryVec) },
      ],
      error: null,
    }))

    const result = await trySemanticFallback(baseKey)
    expect(result).toBeNull()
  })

  it('swallows D1 errors and returns null', async () => {
    process.env.LLM_CACHE_SEMANTIC_ENABLED = '1'
    const queryVec = makeVec([1, 0, 0])
    setAiBinding(async () => ({ data: [Array.from(queryVec)] }))

    vi.mocked(createServerClient).mockImplementation(() => {
      throw new Error('D1 unavailable')
    })

    const result = await trySemanticFallback(baseKey)
    expect(result).toBeNull()
  })
})
