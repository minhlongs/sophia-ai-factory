/**
 * Tests for upstash-redis-client singleton + helpers.
 *
 * Pins contract for session FSM state in Telegram bot flow (PROTECTED FLOW).
 * Singleton requires module reset between tests — uses vi.resetModules + dynamic import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSet = vi.fn()
const mockGet = vi.fn()
const mockDel = vi.fn()
const mockPing = vi.fn()
const mockConstructor = vi.fn()

vi.mock('@upstash/redis', () => {
  // Class (not arrow) so `new Redis(opts)` works as constructor.
  class Redis {
    set = mockSet
    get = mockGet
    del = mockDel
    ping = mockPing
    constructor(opts: { url: string; token: string }) {
      mockConstructor(opts)
    }
  }
  return { Redis }
})

type RedisClientModule = typeof import('../upstash-redis-client')

async function freshImport(): Promise<RedisClientModule> {
  vi.resetModules()
  return await import('../upstash-redis-client')
}

const originalEnv = process.env

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = originalEnv
})

describe('getRedisClient', () => {
  it('throws in production when env vars are missing', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const mod = await freshImport()

    expect(() => mod.getRedisClient()).toThrow(/must be set in production/)
  })

  it('returns dummy client in non-production when env vars are missing', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const mod = await freshImport()

    const client = mod.getRedisClient()

    expect(client).toBeDefined()
    expect(mockConstructor).toHaveBeenCalledWith({
      url: 'https://dummy-url.upstash.io',
      token: 'dummy_token',
    })
  })

  it('uses env vars when provided (trimmed)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = '  https://real.upstash.io  '
    process.env.UPSTASH_REDIS_REST_TOKEN = '  real-token  '
    const mod = await freshImport()

    mod.getRedisClient()

    expect(mockConstructor).toHaveBeenCalledWith({
      url: 'https://real.upstash.io',
      token: 'real-token',
    })
  })

  it('caches the singleton — second call returns same instance', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
    const mod = await freshImport()

    const first = mod.getRedisClient()
    const second = mod.getRedisClient()

    expect(first).toBe(second)
    expect(mockConstructor).toHaveBeenCalledTimes(1)
  })

  it('default export is the same factory function', async () => {
    const mod = await freshImport()
    expect(mod.default).toBe(mod.getRedisClient)
  })
})

describe('SESSION_TTL', () => {
  it('equals 24 hours in seconds', async () => {
    const mod = await freshImport()
    expect(mod.SESSION_TTL).toBe(86400)
  })
})

describe('redisHelpers.setSession', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
  })

  it('JSON-serializes value and applies TTL', async () => {
    const mod = await freshImport()
    await mod.redisHelpers.setSession('sess:1', { user: 'abc', step: 2 }, 600)

    expect(mockSet).toHaveBeenCalledWith(
      'sess:1',
      JSON.stringify({ user: 'abc', step: 2 }),
      { ex: 600 }
    )
  })

  it('uses default SESSION_TTL (24h) when ttl not provided', async () => {
    const mod = await freshImport()
    await mod.redisHelpers.setSession('sess:2', { foo: 'bar' })

    expect(mockSet).toHaveBeenCalledWith(
      'sess:2',
      JSON.stringify({ foo: 'bar' }),
      { ex: 86400 }
    )
  })
})

describe('redisHelpers.getSession', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
  })

  it('returns null when key is missing', async () => {
    mockGet.mockResolvedValueOnce(null)
    const mod = await freshImport()

    const result = await mod.redisHelpers.getSession<{ x: number }>('missing')

    expect(result).toBeNull()
  })

  it('parses JSON when Upstash returns string', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ step: 3 }))
    const mod = await freshImport()

    const result = await mod.redisHelpers.getSession<{ step: number }>('sess:3')

    expect(result).toEqual({ step: 3 })
  })

  it('returns object as-is when Upstash auto-parsed JSON', async () => {
    mockGet.mockResolvedValueOnce({ step: 4, nested: { v: 'ok' } })
    const mod = await freshImport()

    const result = await mod.redisHelpers.getSession<{ step: number }>('sess:4')

    expect(result).toEqual({ step: 4, nested: { v: 'ok' } })
  })

  it('returns raw string when JSON.parse fails', async () => {
    mockGet.mockResolvedValueOnce('not json {{{')
    const mod = await freshImport()

    const result = await mod.redisHelpers.getSession<string>('sess:5')

    expect(result).toBe('not json {{{')
  })
})

describe('redisHelpers.deleteSession', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
  })

  it('calls del with the key', async () => {
    mockDel.mockResolvedValueOnce(1)
    const mod = await freshImport()

    await mod.redisHelpers.deleteSession('sess:gone')

    expect(mockDel).toHaveBeenCalledWith('sess:gone')
  })
})

describe('redisHelpers.ping', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
  })

  it('returns true on PONG', async () => {
    mockPing.mockResolvedValueOnce('PONG')
    const mod = await freshImport()

    expect(await mod.redisHelpers.ping()).toBe(true)
  })

  it('returns false on non-PONG response', async () => {
    mockPing.mockResolvedValueOnce('something-else')
    const mod = await freshImport()

    expect(await mod.redisHelpers.ping()).toBe(false)
  })

  it('returns false when ping throws (network failure)', async () => {
    mockPing.mockRejectedValueOnce(new Error('network down'))
    const mod = await freshImport()

    expect(await mod.redisHelpers.ping()).toBe(false)
  })
})
