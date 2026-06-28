import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callWithCache } from './call-with-cache'
import * as cache from './llm-cache'

const baseKey: cache.CacheKey = {
  provider: 'openrouter',
  model:    'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'hello' }],
  orgId:    'test-org-a',
}

const baseEntry: cache.CacheEntry = {
  response:     '{"ok":true}',
  inputTokens:  12,
  outputTokens: 4,
}

describe('callWithCache', () => {
  let lookupSpy: ReturnType<typeof vi.spyOn>
  let writeSpy:  ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lookupSpy = vi.spyOn(cache, 'lookupCache')
    writeSpy  = vi.spyOn(cache, 'writeCache').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns cached entry on hit without calling fetchLive', async () => {
    lookupSpy.mockResolvedValue(baseEntry)
    const fetchLive = vi.fn<() => Promise<cache.CacheEntry>>()

    const result = await callWithCache(baseKey, fetchLive)

    expect(result.fromCache).toBe(true)
    expect(result.response).toBe(baseEntry.response)
    expect(fetchLive).not.toHaveBeenCalled()
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('calls fetchLive + writeCache on miss, returns fromCache=false', async () => {
    lookupSpy.mockResolvedValue(null)
    const fetchLive = vi.fn<() => Promise<cache.CacheEntry>>().mockResolvedValue(baseEntry)

    const result = await callWithCache(baseKey, fetchLive)

    expect(result.fromCache).toBe(false)
    expect(result.response).toBe(baseEntry.response)
    expect(fetchLive).toHaveBeenCalledOnce()
    expect(writeSpy).toHaveBeenCalledOnce()
    expect(writeSpy).toHaveBeenCalledWith(baseKey, baseEntry)
  })

  it('falls through to fetchLive when cache disabled (lookup returns null)', async () => {
    lookupSpy.mockResolvedValue(null)
    const fetchLive = vi.fn<() => Promise<cache.CacheEntry>>().mockResolvedValue(baseEntry)

    const result = await callWithCache(baseKey, fetchLive)

    expect(result.fromCache).toBe(false)
    expect(fetchLive).toHaveBeenCalledOnce()
  })

  it('propagates fetchLive errors and does NOT write cache', async () => {
    lookupSpy.mockResolvedValue(null)
    const fetchLive = vi.fn<() => Promise<cache.CacheEntry>>().mockRejectedValue(new Error('OpenRouter 500'))

    await expect(callWithCache(baseKey, fetchLive)).rejects.toThrow('OpenRouter 500')
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
