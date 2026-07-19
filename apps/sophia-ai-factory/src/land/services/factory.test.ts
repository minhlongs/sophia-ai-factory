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
 *  9. userId + no user key, env present → returns real service (env fallback)
 * 10. userId + nothing                  → returns mock in dev
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

    // Mock the BYOK resolver at module level
    vi.doMock('@/tree/byok/resolve-user-api-key', () => ({
      resolveUserApiKey: vi.fn().mockResolvedValue('byok-user-key-123'),
    }))

    const { ServiceFactory } = await import('./factory')
    const { RealScriptService } = await import('./real/script-service')

    const service = await ServiceFactory.getScriptService('user-abc')
    expect(service).toBeInstanceOf(RealScriptService)
  })

  // Case 9: userId provided, no user key stored, env key present → real service via fallback
  it('returns real service when userId provided but no BYOK key, env key present', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.BYOK_ENABLED = '1'
    process.env.OPENROUTER_API_KEY = 'env-fallback-key'

    // Resolver returns env fallback (user has no stored key)
    vi.doMock('@/tree/byok/resolve-user-api-key', () => ({
      resolveUserApiKey: vi.fn().mockResolvedValue('env-fallback-key'),
    }))

    const { ServiceFactory } = await import('./factory')
    const { RealScriptService } = await import('./real/script-service')

    const service = await ServiceFactory.getScriptService('user-xyz')
    expect(service).toBeInstanceOf(RealScriptService)
  })

  // Case 10: userId provided, no user key, no env key → mock in dev
  it('returns mock when userId provided but no keys available in dev', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.BYOK_ENABLED = '1'
    delete process.env.OPENROUTER_API_KEY

    // Resolver returns null (no user key, no env fallback)
    vi.doMock('@/tree/byok/resolve-user-api-key', () => ({
      resolveUserApiKey: vi.fn().mockResolvedValue(null),
    }))

    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')

    const service = await ServiceFactory.getScriptService('user-noop')
    expect(service).toBeInstanceOf(MockScriptService)
  })
})
