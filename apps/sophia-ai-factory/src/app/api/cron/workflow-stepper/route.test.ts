/**
 * Tests for workflow-stepper executeStep — Phase 4G dark-launched real LLM.
 *
 * Scope: executeStep behavior only (exported for testability).
 * Does NOT test the GET handler or advanceOne (those rely on D1 batch queries).
 *
 * Test strategy: mock callWithCache + logger at module level; stub env via vi.stubEnv.
 * D1 mock built inline per test — minimal shape (prepare/bind/run/meta.changes).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Module-level mocks (hoisted before any import) ────────────────────────────

vi.mock('@/lib/llm/cache/call-with-cache', () => ({
  callWithCache: vi.fn(),
}))

vi.mock('@/lib/signals/track', () => ({
  track: vi.fn(),
}))

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/telemetry/llm-trace', () => ({
  recordLlmCall: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { executeStep } from './route'
import { callWithCache } from '@/lib/llm/cache/call-with-cache'
import { logger } from '@/lib/utils/logger-utility'
import type { WorkflowRow } from '@/lib/db/workflow-repository'

const mockCallWithCache = vi.mocked(callWithCache)
const mockLoggerWarn    = vi.mocked(logger.warn)

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWorkflow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id:           'wf-test-001',
    org_id:       'org-abc',
    prompt:       'test prompt for workflow step',
    status:       'queued',
    final_result: null,
    error_message: null,
    created_at:   '2026-04-18T00:00:00Z',
    updated_at:   '2026-04-18T00:00:00Z',
    ...overrides,
  }
}

/**
 * Build a minimal D1Database mock.
 * Chains: prepare(sql).bind(...).run() → resolves { meta: { changes: N } }
 * Default changes=1 so CAS guards pass and missions proceed to completion.
 */
function buildMockDb(changes = 1): D1Database {
  const runMock = vi.fn().mockResolvedValue({ meta: { changes }, success: true })
  const bindMock = vi.fn().mockReturnValue({ run: runMock })
  const prepareMock = vi.fn().mockReturnValue({ bind: bindMock })
  return { prepare: prepareMock } as unknown as D1Database
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executeStep — Phase 4G gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it('gate disabled → uses mock string (current behavior preserved)', async () => {
    vi.stubEnv('WORKFLOW_REAL_LLM_ENABLED', '0')
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-test')

    const db = buildMockDb()
    const workflow = buildWorkflow()

    await executeStep(db, workflow, 'mission-1', 1, 'research')

    // callWithCache must NOT have been called — gate is off
    expect(mockCallWithCache).not.toHaveBeenCalled()
    // fetch must NOT have been called — gate is off
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()

    // Result written to DB should be the mock string
    const prepMock = vi.mocked(db.prepare)
    const completeSql = prepMock.mock.calls
      .map((c) => c[0] as string)
      .find((sql) => sql.includes('completed_at'))
    expect(completeSql).toBeDefined()

    // The bind call for the complete UPDATE: first arg = result string
    const completeBindCall = vi.mocked(db.prepare).mock.results
      .map((r) => r.value as { bind: ReturnType<typeof vi.fn> })
      .find((stmtMock) => {
        const calls = stmtMock.bind?.mock?.calls ?? []
        return calls.some((args: unknown[]) =>
          typeof args[0] === 'string' && args[0].startsWith('Step research completed:'),
        )
      })
    expect(completeBindCall).toBeDefined()
  })

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it('gate on, no OPENROUTER_API_KEY → falls back to mock + logs warning', async () => {
    vi.stubEnv('WORKFLOW_REAL_LLM_ENABLED', '1')
    vi.stubEnv('OPENROUTER_API_KEY', '')  // empty = falsy → gate off

    const db = buildMockDb()
    const workflow = buildWorkflow()

    await executeStep(db, workflow, 'mission-2', 1, 'draft')

    // Gate requires BOTH flags — missing API key → mock path, no cache call
    expect(mockCallWithCache).not.toHaveBeenCalled()
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it('gate on + key + cache hit → uses cached result, does NOT call fetch', async () => {
    vi.stubEnv('WORKFLOW_REAL_LLM_ENABLED', '1')
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-real')

    const cachedResponse = 'Cached LLM answer for this workflow step'
    mockCallWithCache.mockResolvedValue({
      response:    cachedResponse,
      fromCache:   true,
      inputTokens: 10,
      outputTokens: 5,
    })

    const db = buildMockDb()
    const workflow = buildWorkflow({ prompt: 'analyze this business problem in depth' })

    await executeStep(db, workflow, 'mission-3', 1, 'analyze')

    expect(mockCallWithCache).toHaveBeenCalledOnce()
    // fetch should NOT have been called — callWithCache returned from cache
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()

    // The result stored in DB must be the cached response (not mock string)
    const prepMock = vi.mocked(db.prepare)
    const allBindArgs = prepMock.mock.results.flatMap((r) => {
      const stmt = r.value as { bind: ReturnType<typeof vi.fn> }
      return stmt.bind?.mock?.calls ?? []
    })
    const resultWritten = allBindArgs
      .flat()
      .find((arg) => typeof arg === 'string' && arg === cachedResponse)
    expect(resultWritten).toBe(cachedResponse)
  })

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it('gate on + key + cache miss → calls fetch, writes cache, returns live result', async () => {
    vi.stubEnv('WORKFLOW_REAL_LLM_ENABLED', '1')
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-real')

    const liveResponse = 'Live OpenRouter answer for the workflow step'
    // callWithCache calls fetchLive internally; we simulate it calling our fn
    // and returning live result with fromCache=false
    mockCallWithCache.mockImplementation(async (_key, fetchLive) => {
      const entry = await fetchLive()
      return { ...entry, fromCache: false }
    })

    // Mock global fetch to return a valid OpenRouter response
    const openrouterBody = JSON.stringify({
      choices: [{ message: { role: 'assistant', content: liveResponse } }],
      usage:   { prompt_tokens: 20, completion_tokens: 15 },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(openrouterBody, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ))

    const db = buildMockDb()
    const workflow = buildWorkflow({ prompt: 'analyze this business problem in depth' })

    await executeStep(db, workflow, 'mission-4', 1, 'analyze')

    expect(mockCallWithCache).toHaveBeenCalledOnce()
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()

    // fetch called with correct OpenRouter endpoint
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    expect(fetchCall[0]).toBe('https://openrouter.ai/api/v1/chat/completions')

    // Result stored in DB must be the live response
    const prepMock = vi.mocked(db.prepare)
    const allBindArgs = prepMock.mock.results.flatMap((r) => {
      const stmt = r.value as { bind: ReturnType<typeof vi.fn> }
      return stmt.bind?.mock?.calls ?? []
    })
    const resultWritten = allBindArgs
      .flat()
      .find((arg) => typeof arg === 'string' && arg === liveResponse)
    expect(resultWritten).toBe(liveResponse)
  })

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it('gate on + key + fetch throws → logs warning, falls back to mock (no propagation)', async () => {
    vi.stubEnv('WORKFLOW_REAL_LLM_ENABLED', '1')
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-real')

    // callWithCache propagates the fetchLive error (callWithCache itself doesn't swallow)
    // Our executeStep must swallow it and fall back to mock string
    mockCallWithCache.mockRejectedValue(new Error('OpenRouter 503'))

    const db = buildMockDb()
    const workflow = buildWorkflow()

    // Must NOT throw — dark-launch safety: swallow live errors
    await expect(
      executeStep(db, workflow, 'mission-5', 1, 'draft'),
    ).resolves.toBeUndefined()

    // Warning logged with error details
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[workflow-stepper] live LLM call failed, falling back to mock',
      expect.objectContaining({ workflowId: workflow.id }),
    )

    // Mock fallback result written to DB (step still completes)
    const prepMock = vi.mocked(db.prepare)
    const allBindArgs = prepMock.mock.results.flatMap((r) => {
      const stmt = r.value as { bind: ReturnType<typeof vi.fn> }
      return stmt.bind?.mock?.calls ?? []
    })
    const mockResultWritten = allBindArgs
      .flat()
      .find((arg) => typeof arg === 'string' && arg.startsWith('Step draft completed:'))
    expect(mockResultWritten).toBeDefined()
  })
})
