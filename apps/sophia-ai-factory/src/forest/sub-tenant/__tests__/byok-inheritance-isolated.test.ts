import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  registerAgencyCredentials,
  setSubTenantCredentialOverride,
  resolveScopedCredential,
  hasProviderAccess,
  revokeAgencyCredentials,
} from '../byok-inheritance'
// byok-inheritance has zero file-level imports — pure logic module.
// Mock logger to avoid the module resolution error in test environment.
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

describe('byok-inheritance (isolated)', () => {
  beforeEach(() => {
    revokeAgencyCredentials(1)
    revokeAgencyCredentials(999)
  })

  it('register + resolve agency credential', () => {
    registerAgencyCredentials(1, { openrouter: 'sk-or-1' })
    const r = resolveScopedCredential(1, null, 'openrouter')
    expect(r.ok).toBe(true)
    expect(r.value.inherited).toBe(true)
    expect(r.value.scopedToAgencyId).toBe(1)
  })

  it('sub-tenant override takes precedence', () => {
    registerAgencyCredentials(1, { openrouter: 'agency-key' })
    setSubTenantCredentialOverride(1, 99, 'openrouter', 'sub-key')
    const r = resolveScopedCredential(1, 99, 'openrouter')
    expect(r.ok).toBe(true)
    expect(r.value.inherited).toBe(false)
    expect(r.value.scopedToSubTenantId).toBe(99)
  })

  it('removing override falls back to agency', () => {
    registerAgencyCredentials(1, { openrouter: 'agency-key' })
    setSubTenantCredentialOverride(1, 99, 'openrouter', 'sub-key')
    setSubTenantCredentialOverride(1, 99, 'openrouter', null)
    const r = resolveScopedCredential(1, 99, 'openrouter')
    expect(r.ok).toBe(true)
    expect(r.value.inherited).toBe(true)
  })

  it('revoke removes all credentials', () => {
    registerAgencyCredentials(1, { openrouter: 'key' })
    expect(hasProviderAccess(1, null, 'openrouter')).toBe(true)
    revokeAgencyCredentials(1)
    expect(hasProviderAccess(1, null, 'openrouter')).toBe(false)
  })
})
