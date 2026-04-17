/**
 * Tests for Local mekongd Adapter (local-mekongd-adapter.ts)
 *
 * Verifies:
 *   1. Happy path — 200 + valid content → returns trimmed text
 *   2. Non-200 status → returns null
 *   3. Thrown fetch error → returns null (no rethrow)
 *   4. Empty content array → returns null (defensive parse)
 *   5. Bearer header included when bearer option set
 *   6. Endpoint trailing slash normalized (no double slash on /v1/messages)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callLocalMekongd } from './local-mekongd-adapter'

// Mock the timeout wrapper — adapter delegates the network call to it
vi.mock('./with-timeout', () => ({
  withTimeout: vi.fn(),
}))

import { withTimeout } from './with-timeout'

const mockWithTimeout = vi.mocked(withTimeout)

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('callLocalMekongd()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns trimmed text on 200 with valid content', async () => {
    mockWithTimeout.mockResolvedValueOnce(
      jsonResponse(200, { content: [{ type: 'text', text: '  85\n' }] }),
    )

    const result = await callLocalMekongd('rate this', {
      endpoint: 'https://mekongd.cashclaw.cc',
    })

    expect(result).toBe('85')
    expect(mockWithTimeout).toHaveBeenCalledWith(
      'https://mekongd.cashclaw.cc/v1/messages',
      expect.objectContaining({
        method: 'POST',
        provider: 'local-mekongd',
        timeoutMs: 25_000,
      }),
    )
  })

  it('returns null on non-200 status', async () => {
    mockWithTimeout.mockResolvedValueOnce(jsonResponse(503, {}))

    const result = await callLocalMekongd('x', {
      endpoint: 'https://mekongd.cashclaw.cc',
    })

    expect(result).toBeNull()
  })

  it('returns null when withTimeout throws (timeout / network)', async () => {
    mockWithTimeout.mockRejectedValueOnce(new Error('aborted'))

    const result = await callLocalMekongd('x', {
      endpoint: 'https://mekongd.cashclaw.cc',
    })

    expect(result).toBeNull()
  })

  it('returns null when content array is missing or empty', async () => {
    mockWithTimeout.mockResolvedValueOnce(jsonResponse(200, { content: [] }))

    const result = await callLocalMekongd('x', {
      endpoint: 'https://mekongd.cashclaw.cc',
    })

    expect(result).toBeNull()
  })

  it('includes bearer Authorization header when bearer option is set', async () => {
    mockWithTimeout.mockResolvedValueOnce(
      jsonResponse(200, { content: [{ type: 'text', text: '50' }] }),
    )

    await callLocalMekongd('x', {
      endpoint: 'https://mekongd.cashclaw.cc',
      bearer: 'tunnel-secret-xyz',
    })

    const init = mockWithTimeout.mock.calls[0][1] as RequestInit & {
      headers: Record<string, string>
    }
    expect(init.headers.Authorization).toBe('Bearer tunnel-secret-xyz')
  })

  it('normalizes trailing slash on endpoint', async () => {
    mockWithTimeout.mockResolvedValueOnce(
      jsonResponse(200, { content: [{ type: 'text', text: 'ok' }] }),
    )

    await callLocalMekongd('x', {
      endpoint: 'https://mekongd.cashclaw.cc/',
    })

    expect(mockWithTimeout).toHaveBeenCalledWith(
      'https://mekongd.cashclaw.cc/v1/messages',
      expect.anything(),
    )
  })
})
