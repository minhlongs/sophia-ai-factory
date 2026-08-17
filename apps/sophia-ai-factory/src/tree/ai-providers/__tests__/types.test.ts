/**
 * Tests for AI Provider Abstraction layer.
 *
 * Covers: errors, types, ID generation, registry, circuit integration,
 * usage tracker. D1 and circuit breaker are mocked to isolate logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFirst = vi.fn()
const mockAll = vi.fn()
const mockRun = vi.fn()
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }))
const mockPrepare = vi.fn(() => ({ bind: mockBind }))

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ prepare: mockPrepare }),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  getState: vi.fn(() => ({ state: 'CLOSED' })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  AIProviderError,
  AIProviderErrorCode,
} from '../errors'
import {
  newProviderId,
  newAIRequestId,
} from '../types'
import type {
  AIModel,
  AIProvider,
  AIRequest,
  AIResponse,
  UsageSummary,
} from '../types'
import {
  registerProvider,
  getProvider,
  listProviders,
  getAvailableProvider,
  invalidateCache,
} from '../registry'
import {
  recordSuccess,
  recordFailure,
  canAttempt,
  getCircuitState,
  FailureKind,
} from '../circuit'
import {
  recordUsage,
  getUsageByProvider,
  getTotalCostCents,
} from '../usage-tracker'
import {
  shouldAllowRequest,
  getState,
  recordSuccess as cbRecordSuccess,
  recordFailure as cbRecordFailure,
} from '@/seed/security/circuit-breaker'

const mockShouldAllowRequest = vi.mocked(shouldAllowRequest)
const mockGetState = vi.mocked(getState)
const mockCBRecordSuccess = vi.mocked(cbRecordSuccess)
const mockCBRecordFailure = vi.mocked(cbRecordFailure)

// ── Test Data ─────────────────────────────────────────────────────────────────

const sampleModels: AIModel[] = [
  { id: 'gpt-4', name: 'GPT-4', type: 'text', costPerUnit: 3.0 },
  { id: 'dall-e-3', name: 'DALL-E 3', type: 'image', costPerUnit: 4.0 },
]

const sampleProviderRow = {
  id: 'prv_1000_1',
  workspace_id: 'ws-abc',
  name: 'OpenRouter',
  type: 'text',
  models_json: JSON.stringify(sampleModels),
  status: 'active',
}

const sampleResponse: AIResponse = {
  requestId: 'req_2000_1',
  providerId: 'prv_1000_1',
  output: 'Hello world',
  modelUsed: 'gpt-4',
  tokensIn: 10,
  tokensOut: 20,
  costCents: 15,
  latencyMs: 320,
}

const sampleUsageRow = {
  request_id: 'req_2000_1',
  provider_id: 'prv_1000_1',
  workspace_id: 'ws-abc',
  model: 'fable-5',
  tokens_in: 10,
  tokens_out: 20,
  cost_cents: 15,
  latency_ms: 320,
  created_at: Date.now(),
}

// ── Errors ────────────────────────────────────────────────────────────────────

describe('AIProviderError', () => {
  it('creates error with code and message', () => {
    const err = new AIProviderError(
      AIProviderErrorCode.AUTH_FAILURE,
      'Bad API key',
    )
    expect(err.code).toBe(AIProviderErrorCode.AUTH_FAILURE)
    expect(err.message).toBe('Bad API key')
    expect(err.name).toBe('AIProviderError')
    expect(err.retryable).toBe(false)
  })

  it('defaults retryable to true for RATE_LIMITED', () => {
    const err = new AIProviderError(
      AIProviderErrorCode.RATE_LIMITED,
      'Too many requests',
    )
    expect(err.retryable).toBe(true)
  })

  it('allows overriding retryable', () => {
    const err = new AIProviderError(
      AIProviderErrorCode.RATE_LIMITED,
      'Hard stop',
      { retryable: false },
    )
    expect(err.retryable).toBe(false)
  })

  it('stores providerId when provided', () => {
    const err = new AIProviderError(
      AIProviderErrorCode.PROVIDER_NOT_FOUND,
      'Not found',
      { providerId: 'prv_999' },
    )
    expect(err.providerId).toBe('prv_999')
  })

  it('stores cause when provided', () => {
    const cause = new Error('root cause')
    const err = new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      'DB down',
      { cause },
    )
    expect(err.cause).toBe(cause)
  })

  it('is instance of Error', () => {
    const err = new AIProviderError(
      AIProviderErrorCode.INVALID_RESPONSE,
      'Bad shape',
    )
    expect(err).toBeInstanceOf(Error)
  })
})

// ── ID Generation ─────────────────────────────────────────────────────────────

describe('newProviderId', () => {
  it('returns string starting with prv_', () => {
    const id = newProviderId()
    expect(id).toMatch(/^prv_\d+_\d+$/)
  })

  it('generates unique IDs', () => {
    const ids = Array.from({ length: 10 }, () => newProviderId())
    const unique = new Set(ids)
    expect(unique.size).toBe(10)
  })
})

describe('newAIRequestId', () => {
  it('returns string starting with req_', () => {
    const id = newAIRequestId()
    expect(id).toMatch(/^req_\d+_\d+$/)
  })

  it('generates unique IDs', () => {
    const ids = Array.from({ length: 10 }, () => newAIRequestId())
    const unique = new Set(ids)
    expect(unique.size).toBe(10)
  })
})

// ── Registry ──────────────────────────────────────────────────────────────────

describe('registerProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCache()
    mockRun.mockResolvedValue({ success: true })
  })

  it('inserts into D1 with correct params', async () => {
    await registerProvider({
      id: 'prv_100',
      workspaceId: 'ws-1',
      name: 'Test',
      type: 'text',
      models: sampleModels,
    })

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_providers'),
    )
    expect(mockBind).toHaveBeenCalledWith(
      'prv_100',
      'ws-1',
      'Test',
      'text',
      JSON.stringify(sampleModels),
      'active',
    )
    expect(mockRun).toHaveBeenCalled()
  })

  it('throws AIProviderError on D1 failure', async () => {
    mockRun.mockRejectedValue(new Error('D1 down'))

    await expect(
      registerProvider({
        id: 'prv_200',
        workspaceId: 'ws-2',
        name: 'Fail',
        type: 'image',
        models: [],
      }),
    ).rejects.toThrow(AIProviderError)
  })
})

describe('getProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCache()
    mockFirst.mockResolvedValue(sampleProviderRow)
  })

  it('returns provider from D1 when not cached', async () => {
    const provider = await getProvider('prv_1000_1', 'ws_test')
    expect(provider.id).toBe('prv_1000_1')
    expect(provider.name).toBe('OpenRouter')
    expect(provider.type).toBe('text')
    expect(provider.models).toHaveLength(2)
    expect(provider.status).toBe('active')
  })

  it('returns cached provider on second call', async () => {
    await getProvider('prv_1000_1', 'ws_test')
    await getProvider('prv_1000_1', 'ws_test')
    // D1 called only once
    expect(mockPrepare).toHaveBeenCalledTimes(1)
  })

  it('throws PROVIDER_NOT_FOUND when row is null', async () => {
    mockFirst.mockResolvedValue(null)

    await expect(getProvider('prv_nonexistent', 'ws_test')).rejects.toThrow(AIProviderError)
    await expect(getProvider('prv_nonexistent', 'ws_test')).rejects.toMatchObject({
      code: AIProviderErrorCode.PROVIDER_NOT_FOUND,
    })
  })

  it('throws D1_UNAVAILABLE on database error', async () => {
    mockFirst.mockRejectedValue(new Error('connection refused'))

    await expect(getProvider('prv_1000_1', 'ws_test')).rejects.toThrow(AIProviderError)
    await expect(getProvider('prv_1000_1', 'ws_test')).rejects.toMatchObject({
      code: AIProviderErrorCode.D1_UNAVAILABLE,
    })
  })
})

describe('listProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCache()
  })

  it('returns all providers when no workspaceId', async () => {
    mockAll.mockResolvedValue({ results: [sampleProviderRow] })

    const providers = await listProviders()
    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe('prv_1000_1')
  })

  it('passes workspaceId to query', async () => {
    mockAll.mockResolvedValue({ results: [] })

    await listProviders('ws-filter')
    expect(mockBind).toHaveBeenCalledWith('ws-filter')
  })

  it('throws on D1 failure', async () => {
    mockAll.mockRejectedValue(new Error('timeout'))

    await expect(listProviders()).rejects.toThrow(AIProviderError)
  })
})

describe('getAvailableProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCache()
    mockAll.mockResolvedValue({ results: [sampleProviderRow] })
  })

  it('returns first active provider with CLOSED circuit', async () => {
    mockShouldAllowRequest.mockReturnValue(true)
    mockGetState.mockReturnValue({ state: 'CLOSED' } as ReturnType<typeof getState>)

    const provider = await getAvailableProvider('text')
    expect(provider).not.toBeNull()
    expect(provider!.id).toBe('prv_1000_1')
  })

  it('returns null when circuit breaker blocks provider', async () => {
    mockShouldAllowRequest.mockReturnValue(false)

    const provider = await getAvailableProvider('text')
    expect(provider).toBeNull()
  })

  it('returns null when no provider of requested type', async () => {
    mockAll.mockResolvedValue({
      results: [{ ...sampleProviderRow, type: 'video' }],
    })

    const provider = await getAvailableProvider('text')
    expect(provider).toBeNull()
  })
})

// ── Circuit Integration ───────────────────────────────────────────────────────

describe('circuit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recordSuccess delegates to circuit breaker', () => {
    recordSuccess('prv_100')
    expect(mockCBRecordSuccess).toHaveBeenCalledWith('prv_100')
  })

  it('recordFailure delegates to circuit breaker with FailureKind', () => {
    recordFailure('prv_100', FailureKind.AUTH_FAILURE)
    expect(mockCBRecordFailure).toHaveBeenCalledWith('prv_100', FailureKind.AUTH_FAILURE)
  })

  it('canAttempt wraps shouldAllowRequest', () => {
    mockShouldAllowRequest.mockReturnValue(true)
    expect(canAttempt('prv_100')).toBe(true)

    mockShouldAllowRequest.mockReturnValue(false)
    expect(canAttempt('prv_100')).toBe(false)
  })

  it('getCircuitState returns state from getState', () => {
    mockGetState.mockReturnValue({ state: 'OPEN' } as ReturnType<typeof getState>)
    expect(getCircuitState('prv_100')).toBe('OPEN')
  })
})

// ── Usage Tracker ─────────────────────────────────────────────────────────────

describe('recordUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRun.mockResolvedValue({ success: true })
  })

  it('inserts usage record into D1', async () => {
    await recordUsage('req_2000_1', sampleResponse, 'ws-abc')

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_usage'),
    )
    expect(mockRun).toHaveBeenCalled()
  })

  it('throws AIProviderError on D1 failure', async () => {
    mockRun.mockRejectedValue(new Error('D1 error'))

    await expect(
      recordUsage('req_2000_1', sampleResponse, 'ws-abc'),
    ).rejects.toThrow(AIProviderError)
  })
})

describe('getUsageByProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns aggregated usage from D1', async () => {
    mockFirst.mockResolvedValue({
      provider_id: 'prv_1000_1',
      total_requests: 5,
      total_tokens_in: 100,
      total_tokens_out: 200,
      total_cost_cents: 75,
      avg_latency_ms: 400,
    })

    const summary = await getUsageByProvider('prv_1000_1', {
      from: 1000,
      to: 2000,
    })

    expect(summary.providerId).toBe('prv_1000_1')
    expect(summary.totalRequests).toBe(5)
    expect(summary.totalTokensIn).toBe(100)
    expect(summary.totalCostCents).toBe(75)
    expect(summary.avgLatencyMs).toBe(400)
  })

  it('returns zeroed summary when no rows found', async () => {
    mockFirst.mockResolvedValue(null)

    const summary = await getUsageByProvider('prv_empty', {
      from: 0,
      to: Date.now(),
    })

    expect(summary.totalRequests).toBe(0)
    expect(summary.totalCostCents).toBe(0)
  })

  it('throws on D1 failure', async () => {
    mockFirst.mockRejectedValue(new Error('down'))

    await expect(
      getUsageByProvider('prv_100', { from: 0, to: 100 }),
    ).rejects.toThrow(AIProviderError)
  })
})

describe('getTotalCostCents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns total cost from D1', async () => {
    mockFirst.mockResolvedValue({ total_cost: 500 })

    const total = await getTotalCostCents('ws-abc', { from: 0, to: 9999 })
    expect(total).toBe(500)
  })

  it('returns 0 when no rows', async () => {
    mockFirst.mockResolvedValue(null)

    const total = await getTotalCostCents('ws-empty', { from: 0, to: 9999 })
    expect(total).toBe(0)
  })

  it('throws on D1 failure', async () => {
    mockFirst.mockRejectedValue(new Error('conn refused'))

    await expect(
      getTotalCostCents('ws-abc', { from: 0, to: 9999 }),
    ).rejects.toThrow(AIProviderError)
  })
})
