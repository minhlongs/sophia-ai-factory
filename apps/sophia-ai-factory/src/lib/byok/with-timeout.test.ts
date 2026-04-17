/**
 * Tests for BYOK Timeout Guard Wrapper (with-timeout.ts)
 *
 * Verifies:
 *   1. Happy path — resolves before timeout, emits byok_call w/ status_code
 *   2. Timeout path — AbortController fires, throws BYOKTimeoutError, emits byok_timeout
 *   3. Non-timeout error — re-throws original, emits byok_call w/ status_code=0 + error_class
 *   4. Signal correctness — track called with right event + props for each path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTimeout, BYOKTimeoutError } from './with-timeout'

// ── Mock track() — must come before module imports that depend on it ──────────

vi.mock('@/lib/signals/track', () => ({
  track: vi.fn(),
}))

import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal mock Response */
function mockResponse(status = 200): Response {
  return { status, ok: status >= 200 && status < 300 } as Response
}

/** Flush microtasks so fire-and-forget track() calls settle */
const flushAsync = () => new Promise<void>((r) => setTimeout(r, 0))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('withTimeout()', () => {
  const mockTrack = vi.mocked(track)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ── Test 1: Happy path ───────────────────────────────────────────────────────

  it('resolves response before timeout and emits byok_call with status_code + latency_ms', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(200))

    const res = await withTimeout('https://api.example.com/test', {
      method: 'GET',
      provider: 'elevenlabs',
      timeoutMs: 5_000,
    })

    await flushAsync()

    expect(res.status).toBe(200)
    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.BYOK_CALL,
      'system',
      expect.objectContaining({
        provider: 'elevenlabs',
        status_code: 200,
        latency_ms: expect.any(Number),
      }),
    )
    // Verify latency_ms is a non-negative number
    const props = mockTrack.mock.calls[0][2] as Record<string, unknown>
    expect(props.latency_ms).toBeGreaterThanOrEqual(0)
  })

  // ── Test 2: Timeout path ─────────────────────────────────────────────────────

  it('throws BYOKTimeoutError and emits byok_timeout when timeout fires', async () => {
    // Simulate a fetch that never resolves within the window
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        // Detect abort and reject as real fetch does
        const signal = init?.signal
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const promise = withTimeout('https://api.example.com/slow', {
      provider: 'openrouter',
      timeoutMs: 1, // 1ms — fires almost immediately
    })

    await expect(promise).rejects.toBeInstanceOf(BYOKTimeoutError)

    await flushAsync()

    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.BYOK_TIMEOUT,
      'system',
      expect.objectContaining({
        provider: 'openrouter',
        timeout_ms: 1,
      }),
    )
  })

  // ── Test 3: Non-timeout network error ────────────────────────────────────────

  it('re-throws original error and emits byok_call w/ status_code=0 + error_class on non-timeout failure', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(networkError)

    const promise = withTimeout('https://api.example.com/broken', {
      provider: 'elevenlabs',
      timeoutMs: 5_000,
    })

    // Must re-throw the ORIGINAL error (not BYOKTimeoutError)
    await expect(promise).rejects.toThrow(networkError)
    await expect(promise).rejects.not.toBeInstanceOf(BYOKTimeoutError)

    await flushAsync()

    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.BYOK_CALL,
      'system',
      expect.objectContaining({
        provider: 'elevenlabs',
        status_code: 0,
        latency_ms: expect.any(Number),
        error_class: 'TypeError',
      }),
    )
  })

  // ── Test 4: Signal correctness per path ──────────────────────────────────────

  it('emits exactly ONE track call per invocation regardless of path', async () => {
    // Path A: success
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(201))
    await withTimeout('https://api.example.com/a', { provider: 'elevenlabs' })
    await flushAsync()
    expect(mockTrack).toHaveBeenCalledTimes(1)
    vi.clearAllMocks()

    // Path B: timeout
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })
    })
    await withTimeout('https://api.example.com/b', {
      provider: 'openrouter',
      timeoutMs: 1,
    }).catch(() => {/* swallow */})
    await flushAsync()
    expect(mockTrack).toHaveBeenCalledTimes(1)
    vi.clearAllMocks()

    // Path C: non-timeout error
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'))
    await withTimeout('https://api.example.com/c', { provider: 'elevenlabs' }).catch(() => {/* swallow */})
    await flushAsync()
    expect(mockTrack).toHaveBeenCalledTimes(1)
  })

  // ── Test 5: BYOKTimeoutError fields ──────────────────────────────────────────

  it('BYOKTimeoutError carries correct provider and timeoutMs fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })
    })

    let caught: unknown
    try {
      await withTimeout('https://api.example.com/timeout', {
        provider: 'd-id',
        timeoutMs: 1,
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(BYOKTimeoutError)
    const err = caught as BYOKTimeoutError
    expect(err.name).toBe('BYOKTimeoutError')
    expect(err.provider).toBe('d-id')
    expect(err.timeoutMs).toBe(1)
    expect(err.message).toContain('d-id')
    expect(err.message).toContain('1ms')
  })

  // ── Test 6: Default timeoutMs = 25_000 ───────────────────────────────────────

  it('uses default timeoutMs = 25_000 when not specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(200))

    // Should not timeout with 25s default during test
    await withTimeout('https://api.example.com/default', { provider: 'openrouter' })
    await flushAsync()

    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack.mock.calls[0][0]).toBe(D1Events.BYOK_CALL)
  })
})
