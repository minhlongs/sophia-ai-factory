/**
 * Unit tests for ServiceFactory — BYOK-aware async credential gate.
 *
 * Covers:
 *  1. production + no key               → throws MissingCredentialsError
 *  2. development + no key              → returns mock (warning)
 *  3. explicit mock flag                → returns mock regardless of keys
 *  4. keys present + prod               → returns real service
 *  5. getVideoService prod no key       → throws MissingCredentialsError('HEYGEN_API_KEY')
 *  6. whitespace-only key in prod       → throws MissingCredentialsError
 *  7. getVoiceService maps key          → uses ELEVENLABS_API_KEY
 *  8. userId + user key via BYOK        → returns real service (key from resolver)
 *  9. userId + no user key, env present → rejects MissingCredentialsError
 * 10. userId + nothing                  → rejects MissingCredentialsError in dev
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { GenerateScriptInput } from './types'
import type { UserApiKeyLookupResult } from '@/tree/byok/user-api-key-store'

describe('ServiceFactory — credential gate', () => {
  function clearServiceKey() {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.HEYGEN_API_KEY
    delete process.env.REPLICATE_API_TOKEN
    delete process.env.NOWPAYMENTS_API_KEY
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES
    delete process.env.BYOK_ENABLED
  }

  beforeEach(() => {
    clearServiceKey()
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('@/tree/byok/user-api-key-store')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // Case 1: NODE_ENV=production, key absent → throws MissingCredentialsError
  it('throws MissingCredentialsError in production when key is absent', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.OPENROUTER_API_KEY

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    await expect(ServiceFactory.getScriptService()).rejects.toThrow(MissingCredentialsError)
    await expect(ServiceFactory.getScriptService()).rejects.toThrow('OPENROUTER_API_KEY')
  }, 20000)

  // Case 2: NODE_ENV=development, key absent → returns mock (no throw)
  it('returns mock service in development when key is absent', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.OPENROUTER_API_KEY

    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')

    const service = await ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(MockScriptService)
  })

  // Case 3: NEXT_PUBLIC_MOCK_AI_SERVICES=true → mock regardless of keys or env
  it('returns mock when NEXT_PUBLIC_MOCK_AI_SERVICES=true even if keys are set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_MOCK_AI_SERVICES = 'true'
    process.env.OPENROUTER_API_KEY = 'sk-real-key'

    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')

    const service = await ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(MockScriptService)
  })

  // Case 4: key present + production → returns real service
  it('returns real service in production when key is present', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENROUTER_API_KEY = 'sk-real-key'
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES

    const { ServiceFactory } = await import('./factory')
    const { RealScriptService } = await import('./real/script-service')

    const service = await ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(RealScriptService)
  })

  // Case 5: getVideoService in production with no keys → throws MissingCredentialsError
  it('getVideoService throws MissingCredentialsError when neither HEYGEN_API_KEY nor REPLICATE_API_TOKEN in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    await expect(ServiceFactory.getVideoService()).rejects.toThrow(MissingCredentialsError)
    await expect(ServiceFactory.getVideoService()).rejects.toThrow('HEYGEN_API_KEY / REPLICATE_API_TOKEN')
  })

  // Case 6: whitespace-only OPENROUTER_API_KEY in production → throws MissingCredentialsError
  it('throws MissingCredentialsError when key is whitespace-only in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENROUTER_API_KEY = '   '

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    await expect(ServiceFactory.getScriptService()).rejects.toThrow(MissingCredentialsError)
    await expect(ServiceFactory.getScriptService()).rejects.toThrow('OPENROUTER_API_KEY')
  })

  // Case 7: getVoiceService uses ELEVENLABS_API_KEY (guard against key-name typo)
  it('getVoiceService returns real service when ELEVENLABS_API_KEY is set in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.ELEVENLABS_API_KEY = 'el-real-key'
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES

    const { ServiceFactory } = await import('./factory')
    const { RealVoiceService } = await import('./real/voice-service')

    const service = await ServiceFactory.getVoiceService()
    expect(service).toBeInstanceOf(RealVoiceService)
  })

  // Case 8: userId provided, BYOK enabled, user has stored key → real service
  it('returns real service when userId provided and BYOK resolver returns user key', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.BYOK_ENABLED = '1'
    delete process.env.OPENROUTER_API_KEY // no env fallback

    // The gate reads the status-aware lookup so it can tell a store outage from
    // an absent key. FOUND means the customer's own key is usable.
    vi.doMock('@/tree/byok/user-api-key-store', () => ({
      lookupUserApiKey: vi.fn().mockResolvedValue({ status: 'FOUND', key: 'byok-user-key-123' }),
      listUserApiKeyProviders: vi.fn().mockResolvedValue([]),
    }))

    const { ServiceFactory } = await import('./factory')
    const { RealScriptService } = await import('./real/script-service')

    const service = await ServiceFactory.getScriptService('user-abc')
    expect(service).toBeInstanceOf(RealScriptService)
  })

  // Customer calls require their own key even when a platform key exists.
  it('rejects missing customer BYOK credentials despite an env key', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.BYOK_ENABLED = '1'
    process.env.OPENROUTER_API_KEY = 'env-fallback-key'

    vi.doMock('@/tree/byok/user-api-key-store', () => ({
      lookupUserApiKey: vi.fn().mockResolvedValue({ status: 'NOT_CONFIGURED' }),
      listUserApiKeyProviders: vi.fn().mockResolvedValue([]),
    }))

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')
    await expect(ServiceFactory.getScriptService('user-xyz')).rejects.toThrow(MissingCredentialsError)
  })

  it('rejects missing customer credentials in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.BYOK_ENABLED = '1'
    delete process.env.OPENROUTER_API_KEY

    vi.doMock('@/tree/byok/user-api-key-store', () => ({
      lookupUserApiKey: vi.fn().mockResolvedValue({ status: 'NOT_CONFIGURED' }),
      listUserApiKeyProviders: vi.fn().mockResolvedValue([]),
    }))

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    await expect(ServiceFactory.getScriptService('user-noop')).rejects.toThrow(MissingCredentialsError)
  })
})


describe('ServiceFactory — customer script funding', () => {
  const input: GenerateScriptInput = {
    topic: 'Customer campaign', audience: 'makers', tier: 'BASIC',
    userId: 'customer-owner', orgId: 'customer-org',
    affiliateOffer: { productName: 'Customer offer', shortUrl: 'https://example.com/offer' },
  }
  const output = { title: 'Generated', scenes: [{ narration: 'Hello' }] }
  const generate = vi.fn().mockResolvedValue(output)
  const lookup = vi.fn<(...args: [string, string]) => Promise<UserApiKeyLookupResult>>()

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('OPENROUTER_API_KEY', 'platform-decoy')
    vi.stubEnv('NEXT_PUBLIC_MOCK_AI_SERVICES', 'false')
    vi.stubEnv('BYOK_ENABLED', '0')
    generate.mockClear()
    lookup.mockReset().mockResolvedValue({ status: 'FOUND', key: 'customer-key' })
    vi.doMock('@/tree/byok/user-api-key-store', () => ({ lookupUserApiKey: lookup }))
    vi.doMock('@/seed/ai/script-generator', () => ({ generateScript: generate, registerApiKeyResolver: vi.fn() }))
  })

  afterEach(() => {
    vi.doUnmock('@/tree/byok/user-api-key-store')
    vi.doUnmock('@/seed/ai/script-generator')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('threads the customer key and original tenant/affiliate input despite an env decoy and disabled BYOK flag', async () => {
    const { ServiceFactory } = await import('./factory')
    const service = await ServiceFactory.getScriptService('customer-owner')
    await expect(service.generateScript(input)).resolves.toEqual(output)
    expect(lookup).toHaveBeenCalledExactlyOnceWith('customer-owner', 'openrouter')
    expect(generate).toHaveBeenCalledExactlyOnceWith(input, {
      funding: { fund: 'byok', apiKey: 'customer-key' },
    })
  })

  it.each<UserApiKeyLookupResult>([
    { status: 'NOT_CONFIGURED' }, { status: 'FOUND', key: '' }, { status: 'FOUND', key: '   ' },
  ])('rejects absent or blank customer credentials: %j', async result => {
    lookup.mockResolvedValue(result)
    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')
    await expect(ServiceFactory.getScriptService('customer-owner')).rejects.toThrow(MissingCredentialsError)
    expect(generate).not.toHaveBeenCalled()
  })

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED', 'rejected'] as const)(
    'sanitizes unreadable customer credentials: %s', async status => {
      if (status === 'rejected') lookup.mockRejectedValue(new Error('secret-decoy database detail'))
      else lookup.mockResolvedValue({ status })
      const { ServiceFactory } = await import('./factory')
      const { ProviderNetworkError } = await import('./errors')
      const error = await ServiceFactory.getScriptService('customer-owner').catch(error => error)
      expect(error).toBeInstanceOf(ProviderNetworkError)
      expect(error.message).not.toMatch(/secret-decoy|database detail|platform-decoy/)
      expect(generate).not.toHaveBeenCalled()
    },
  )

  it('treats an empty userId as a customer call without env fallback', async () => {
    lookup.mockResolvedValue({ status: 'NOT_CONFIGURED' })
    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')
    await expect(ServiceFactory.getScriptService('')).rejects.toThrow(MissingCredentialsError)
    expect(lookup).toHaveBeenCalledExactlyOnceWith('', 'openrouter')
    expect(generate).not.toHaveBeenCalled()
  })

  it('preserves the no-user generator call with one argument', async () => {
    const { ServiceFactory } = await import('./factory')
    const service = await ServiceFactory.getScriptService()
    await expect(service.generateScript(input)).resolves.toEqual(output)
    expect(lookup).not.toHaveBeenCalled()
    expect(generate).toHaveBeenCalledExactlyOnceWith(input)
  })

  it('allows customer mocks only with the explicit flag in the test runtime', async () => {
    vi.stubEnv('NEXT_PUBLIC_MOCK_AI_SERVICES', 'true')
    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')
    expect(await ServiceFactory.getScriptService('customer-owner')).toBeInstanceOf(MockScriptService)
    expect(lookup).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })

  it.each(['production', 'development'])('ignores the customer mock flag in %s and still threads own funding', async runtime => {
    vi.stubEnv('NODE_ENV', runtime)
    vi.stubEnv('NEXT_PUBLIC_MOCK_AI_SERVICES', 'true')
    const { ServiceFactory } = await import('./factory')
    const service = await ServiceFactory.getScriptService('customer-owner')
    await service.generateScript(input)
    expect(lookup).toHaveBeenCalledExactlyOnceWith('customer-owner', 'openrouter')
    expect(generate).toHaveBeenCalledExactlyOnceWith(input, {
      funding: { fund: 'byok', apiKey: 'customer-key' },
    })
  })

  it('cannot bypass missing customer credentials with the mock flag in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_MOCK_AI_SERVICES', 'true')
    lookup.mockResolvedValue({ status: 'NOT_CONFIGURED' })
    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')
    await expect(ServiceFactory.getScriptService('customer-owner')).rejects.toThrow(MissingCredentialsError)
    expect(generate).not.toHaveBeenCalled()
  })
})
