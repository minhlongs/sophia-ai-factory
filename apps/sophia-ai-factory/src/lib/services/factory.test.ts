/**
 * Unit tests for ServiceFactory per-service credential gate.
 *
 * 7 scenarios:
 *   1. production + no key          → throws MissingCredentialsError
 *   2. development + no key         → returns mock (with warning)
 *   3. explicit mock flag           → returns mock regardless of keys
 *   4. keys present + prod          → returns real service
 *   5. getVideoService prod no key  → throws MissingCredentialsError('HEYGEN_API_KEY')
 *   6. whitespace-only key in prod  → throws MissingCredentialsError
 *   7. getVoiceService maps key     → uses ELEVENLABS_API_KEY
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ServiceFactory and errors are imported dynamically per-test after vi.resetModules()
// so that env-var-driven module-level constants (isProd, isExplicitMock) are re-evaluated.

describe('ServiceFactory — credential gate', () => {
  function clearServiceKey() {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.HEYGEN_API_KEY
    delete process.env.NOWPAYMENTS_API_KEY
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES
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

    expect(() => ServiceFactory.getScriptService()).toThrow(MissingCredentialsError)
    expect(() => ServiceFactory.getScriptService()).toThrow('OPENROUTER_API_KEY')
  })

  // Case 2: NODE_ENV=development, key absent → returns mock (no throw)
  it('returns mock service in development when key is absent', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.OPENROUTER_API_KEY

    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')

    const service = ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(MockScriptService)
  })

  // Case 3: NEXT_PUBLIC_MOCK_AI_SERVICES=true → mock regardless of keys or env
  it('returns mock when NEXT_PUBLIC_MOCK_AI_SERVICES=true even if keys are set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_MOCK_AI_SERVICES = 'true'
    process.env.OPENROUTER_API_KEY = 'sk-real-key'

    const { ServiceFactory } = await import('./factory')
    const { MockScriptService } = await import('./mock/script-service')

    const service = ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(MockScriptService)
  })

  // Case 4: key present + production → returns real service
  it('returns real service in production when key is present', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENROUTER_API_KEY = 'sk-real-key'
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES

    const { ServiceFactory } = await import('./factory')
    const { RealScriptService } = await import('./real/script-service')

    const service = ServiceFactory.getScriptService()
    expect(service).toBeInstanceOf(RealScriptService)
  })

  // Case 5: getVideoService in production with no HEYGEN_API_KEY → throws MissingCredentialsError
  it('getVideoService throws MissingCredentialsError(HEYGEN_API_KEY) in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.HEYGEN_API_KEY

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    expect(() => ServiceFactory.getVideoService()).toThrow(MissingCredentialsError)
    expect(() => ServiceFactory.getVideoService()).toThrow('HEYGEN_API_KEY')
  })

  // Case 6: whitespace-only OPENROUTER_API_KEY in production → throws MissingCredentialsError
  it('throws MissingCredentialsError when key is whitespace-only in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENROUTER_API_KEY = '   '

    const { ServiceFactory } = await import('./factory')
    const { MissingCredentialsError } = await import('./errors')

    expect(() => ServiceFactory.getScriptService()).toThrow(MissingCredentialsError)
    expect(() => ServiceFactory.getScriptService()).toThrow('OPENROUTER_API_KEY')
  })

  // Case 7: getVoiceService uses ELEVENLABS_API_KEY (guard against key-name typo)
  it('getVoiceService returns real service when ELEVENLABS_API_KEY is set in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.ELEVENLABS_API_KEY = 'el-real-key'
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES

    const { ServiceFactory } = await import('./factory')
    const { RealVoiceService } = await import('./real/voice-service')

    const service = ServiceFactory.getVoiceService()
    expect(service).toBeInstanceOf(RealVoiceService)
  })
})
