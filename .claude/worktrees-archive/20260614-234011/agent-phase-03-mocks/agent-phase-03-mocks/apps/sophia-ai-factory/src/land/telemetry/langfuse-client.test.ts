import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readLangfuseConfig, sendToLangfuse, DEFAULT_HOST } from './langfuse-client'
import type { LlmCallTrace } from './llm-trace'

const baseTrace: LlmCallTrace = {
  workflowId: 'wf-abc',
  stepOrder:  1,
  stepType:   'plan',
  provider:   'openrouter',
  model:      'gpt-4o-mini',
  durationMs: 42,
  ok:         true,
}

describe('langfuse-client', () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    delete process.env.LANGFUSE_PUBLIC_KEY
    delete process.env.LANGFUSE_SECRET_KEY
    delete process.env.LANGFUSE_HOST
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    globalThis.fetch = originalFetch
  })

  describe('readLangfuseConfig', () => {
    it('returns null when both keys missing', () => {
      expect(readLangfuseConfig()).toBeNull()
    })

    it('returns null when only public key set', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      expect(readLangfuseConfig()).toBeNull()
    })

    it('returns null when only secret key set', () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      expect(readLangfuseConfig()).toBeNull()
    })

    it('returns config when both keys set', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      expect(readLangfuseConfig()).toEqual({
        publicKey: 'pk-test',
        secretKey: 'sk-test',
        host:      undefined,
      })
    })

    it('includes custom host when set', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      process.env.LANGFUSE_HOST = 'https://self-hosted.example.com'
      expect(readLangfuseConfig()?.host).toBe('https://self-hosted.example.com')
    })
  })

  describe('sendToLangfuse', () => {
    it('is no-op when env keys missing (no fetch call)', async () => {
      const fetchMock = vi.fn()
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc', 'org-1')

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('POSTs to default host when env keys set', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc', 'org-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://cloud.langfuse.com/api/public/ingestion')
      expect((init as RequestInit).method).toBe('POST')
      const headers = (init as RequestInit).headers as Record<string, string>
      expect(headers['Authorization']).toMatch(/^Basic /)
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('uses custom host when LANGFUSE_HOST set', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      process.env.LANGFUSE_HOST = 'https://self.example.com'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc')

      expect(fetchMock.mock.calls[0][0]).toBe('https://self.example.com/api/public/ingestion')
    })

    it('sends generation-create batch event with deterministic trace id', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc', 'org-1')

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
      expect(body.batch).toHaveLength(1)
      expect(body.batch[0].type).toBe('generation-create')
      expect(body.batch[0].body.id).toBe('wf-abc-step-1')
      expect(body.batch[0].body.traceId).toBe('wf-abc')
      expect(body.batch[0].body.model).toBe('gpt-4o-mini')
      expect(body.batch[0].body.metadata.actor).toBe('wf-abc')
      expect(body.batch[0].body.metadata.orgId).toBe('org-1')
    })

    it('places costUsd under body.usage.totalCost (Langfuse cost dashboard)', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(
        { ...baseTrace, costUsd: 0.0042, inputTokens: 100, outputTokens: 50 },
        'wf-abc',
      )

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
      expect(body.batch[0].body.usage.totalCost).toBeCloseTo(0.0042)
      expect(body.batch[0].body.usage.input).toBe(100)
      expect(body.batch[0].body.usage.output).toBe(50)
    })

    it('contract: every LlmCallTrace field is represented in the Langfuse event', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(
        {
          workflowId:   'wf-full',
          stepOrder:    3,
          stepType:     'test',
          provider:     'anthropic',
          model:        'claude-sonnet-4',
          durationMs:   9000,
          ok:           false,
          errorClass:   'RateLimitError',
          inputTokens:  2000,
          outputTokens: 500,
          costUsd:      0.015,
        },
        'wf-full',
        'org-full',
      )

      const event = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).batch[0]
      const bag = JSON.stringify(event.body)
      // Guards against silent drift when a new LlmCallTrace field is added.
      expect(bag).toContain('wf-full')          // workflowId
      expect(bag).toContain('step-3')           // stepOrder (via buildTraceId)
      expect(bag).toContain('test')             // stepType
      expect(bag).toContain('anthropic')        // provider
      expect(bag).toContain('claude-sonnet-4')  // model
      expect(bag).toContain('9000')             // durationMs
      expect(bag).toContain('RateLimitError')   // errorClass
      expect(bag).toContain('2000')             // inputTokens
      expect(bag).toContain('500')              // outputTokens
      expect(bag).toContain('0.015')            // costUsd
    })

    it('falls back to DEFAULT_HOST when LANGFUSE_HOST is empty string', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      process.env.LANGFUSE_HOST = '   '
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc')

      expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_HOST}/api/public/ingestion`)
    })

    it('passes an AbortSignal.timeout to fetch (no hung request)', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(baseTrace, 'wf-abc')

      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init.signal).toBeDefined()
      expect(init.signal?.constructor.name).toBe('AbortSignal')
    })

    it('swallows fetch rejection (never throws)', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

      await expect(sendToLangfuse(baseTrace, 'wf-abc')).resolves.toBeUndefined()
    })

    it('accepts explicit config override (skips env)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await sendToLangfuse(
        baseTrace,
        'wf-abc',
        undefined,
        { publicKey: 'pk-override', secretKey: 'sk-override' },
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
