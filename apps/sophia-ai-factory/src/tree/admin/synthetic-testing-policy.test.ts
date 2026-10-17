import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSyntheticTestingEnvironment } from './synthetic-testing-policy'

describe('isSyntheticTestingEnvironment', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('allows development and test environments', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isSyntheticTestingEnvironment()).toBe(true)

    vi.stubEnv('NODE_ENV', 'test')
    expect(isSyntheticTestingEnvironment()).toBe(true)
  })

  it('fails closed in production and when the environment is unset', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isSyntheticTestingEnvironment()).toBe(false)

    vi.stubEnv('NODE_ENV', '')
    expect(isSyntheticTestingEnvironment()).toBe(false)
  })
})
