import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callOpenRouter, resilientChatCompletion } from './openrouter-caller'
import { recordFailure, recordSuccess, shouldAllowRequest } from '@/seed/security/circuit-breaker'
import { FailureKind } from '@/seed/types/failure-kind'

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(), recordFailure: vi.fn(), recordSuccess: vi.fn(),
}))
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function abortableTransport(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) throw new Error('Missing request cancellation signal')
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

describe('OpenRouter request deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(shouldAllowRequest).mockReturnValue(true)
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('bounds a hung script transport and exhausts four attempts with timeout classification', async () => {
    const transport = vi.fn(abortableTransport)
    vi.stubGlobal('fetch', transport)
    const startedAt = Date.now()
    const result = resilientChatCompletion('script prompt', {
      openRouterKey: 'synthetic-key', enableFallback: false,
    })
    const rejected = expect(result).rejects.toThrow('OpenRouter request timed out')
    await vi.advanceTimersByTimeAsync(120_000 - 1)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(recordFailure).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    await rejected
    expect(transport).toHaveBeenCalledTimes(4)
    expect(Date.now() - startedAt).toBe(494_000)
    expect(recordFailure).toHaveBeenCalledExactlyOnceWith('openrouter', FailureKind.TIMEOUT)
    expect(recordSuccess).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds stalled successful response bodies without recording success', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true })
        },
      }), { status: 200 })),
    ))
    const rejected = expect(callOpenRouter('synthetic-key', 'prompt', undefined, 0))
      .rejects.toThrow('OpenRouter request timed out')
    await vi.advanceTimersByTimeAsync(120_000)
    await rejected
    expect(recordSuccess).not.toHaveBeenCalled()
    expect(recordFailure).toHaveBeenCalledExactlyOnceWith('openrouter', FailureKind.TIMEOUT)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up the request deadline after successful completion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: 'valid content' } }],
    })))
    await expect(callOpenRouter('synthetic-key', 'prompt')).resolves.toBe('valid content')
    expect(recordSuccess).toHaveBeenCalledWith('openrouter')
    expect(recordFailure).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves nonretryable authentication failure and clears its deadline', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', transport)
    await expect(callOpenRouter('synthetic-key', 'prompt')).rejects.toThrow('OpenRouter HTTP 401')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(recordFailure).toHaveBeenCalledExactlyOnceWith('openrouter', FailureKind.AUTH_FAILURE)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('isolates customer BYOK circuitKeyRef and skips breaker poison on 401/402/403', async () => {
    const transport401 = vi.fn().mockResolvedValue(new Response('Invalid key', { status: 401 }))
    vi.stubGlobal('fetch', transport401)
    await expect(
      resilientChatCompletion('prompt', {
        openRouterKey: 'sk-or-v1-customer',
        enableFallback: false,
        circuitKeyRef: 'byok:user_42',
      }),
    ).rejects.toThrow('OpenRouter HTTP 401')
    expect(shouldAllowRequest).toHaveBeenCalledWith('openrouter', 'byok:user_42')
    expect(recordFailure).not.toHaveBeenCalled()

    const transport429 = vi.fn().mockResolvedValue(new Response('Rate limit', { status: 429 }))
    vi.stubGlobal('fetch', transport429)
    await expect(
      callOpenRouter('sk-or-v1-customer', 'prompt', undefined, 0, { circuitKeyRef: 'byok:user_42' }),
    ).rejects.toThrow('OpenRouter HTTP 429')
    expect(recordFailure).toHaveBeenCalledWith('openrouter', FailureKind.RATE_LIMIT, 'byok:user_42')

    const transportOk = vi.fn().mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"title":"ok"}' } }] }),
    )
    vi.stubGlobal('fetch', transportOk)
    await expect(
      callOpenRouter('sk-or-v1-customer', 'prompt', undefined, 0, { circuitKeyRef: 'byok:user_42' }),
    ).resolves.toBe('{"title":"ok"}')
    expect(recordSuccess).toHaveBeenCalledWith('openrouter', 'byok:user_42')

    const transportNetErr = vi.fn().mockRejectedValue(new Error('network socket hang up'))
    vi.stubGlobal('fetch', transportNetErr)
    await expect(
      callOpenRouter('sk-or-v1-customer', 'prompt', undefined, 0, { circuitKeyRef: 'byok:user_42' }),
    ).rejects.toThrow('network socket hang up')
    expect(recordFailure).toHaveBeenCalledWith('openrouter', FailureKind.NETWORK, 'byok:user_42')
  })
})
