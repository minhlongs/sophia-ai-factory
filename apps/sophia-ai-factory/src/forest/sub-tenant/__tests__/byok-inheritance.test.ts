import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/seed/types/result';
import {
  registerAgencyCredentials,
  setSubTenantCredentialOverride,
  resolveScopedCredential,
  hasProviderAccess,
  revokeAgencyCredentials,
} from '../byok-inheritance'

describe('byok-inheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── registerAgencyCredentials ──────────────────────────────────────────────
  describe('registerAgencyCredentials', () => {
    it('stores credentials for an agency', () => {
      const result = registerAgencyCredentials(1, {
        openrouter: 'sk-or-key-1',
        elevenlabs: 'sk-el-key-1',
      })

      expect(result.ok).toBe(true)

      const resolved = resolveScopedCredential(1, null, 'openrouter')
      expect(resolved.ok).toBe(true)
      expect(isOk(resolved) ? resolved.value.inherited : '').toBe(true)
    })

    it('rejects all-empty credentials', () => {
      const result = registerAgencyCredentials(1, {
        openrouter: '',
        elevenlabs: ' ',
      })

      expect(result.ok).toBe(false)
      expect(isOk(result) ? '' : result.error.code).toBe('INVALID_CREDENTIAL')
    })

    it('ignores empty values and stores valid ones', () => {
      const result = registerAgencyCredentials(1, {
        openrouter: 'sk-or-key',
        elevenlabs: '',
        heygen: undefined,
      })

      expect(result.ok).toBe(true)

      const openrouter = resolveScopedCredential(1, null, 'openrouter')
      expect(openrouter.ok).toBe(true)

      const elevenlabs = resolveScopedCredential(1, null, 'elevenlabs')
      expect(elevenlabs.ok).toBe(false)
      expect(isOk(elevenlabs) ? '' : elevenlabs.error.code).toBe('CREDENTIAL_NOT_FOUND')
    })
  })

  // ── resolveScopedCredential ────────────────────────────────────────────────
  describe('resolveScopedCredential', () => {
    beforeEach(() => {
      registerAgencyCredentials(1, {
        openrouter: 'agency-or-key',
        elevenlabs: 'agency-el-key',
      })
    })

    it('returns agency credential when no sub-tenant override', () => {
      const result = resolveScopedCredential(1, null, 'elevenlabs')
      expect(result.ok).toBe(true)
      expect(isOk(result) ? result.value.inherited : '').toBe(true)
      expect(isOk(result) ? result.value.provider : '').toBe('elevenlabs')
    })

    it('returns inherited=true for agency-level', () => {
      const result = resolveScopedCredential(1, null, 'openrouter')
      expect(result.ok).toBe(true)
      expect(isOk(result) ? result.value.inherited : '').toBe(true)
    })

    it('returns fictional sub-tenant override when set', () => {
      setSubTenantCredentialOverride(1, 99, 'openrouter', 'sub-tenant-or-key')

      const result = resolveScopedCredential(1, 99, 'openrouter')
      expect(result.ok).toBe(true)
      expect(isOk(result) ? result.value.inherited : '').toBe(false)
      expect(isOk(result) ? result.value.scopedToSubTenantId : 0).toBe(99)
    })

    it('falls back to agency when sub-tenant override is removed', () => {
      setSubTenantCredentialOverride(1, 99, 'openrouter', 'sub-tenant-key')
      setSubTenantCredentialOverride(1, 99, 'openrouter', null)

      const result = resolveScopedCredential(1, 99, 'openrouter')
      expect(result.ok).toBe(true)
      expect(isOk(result) ? result.value.inherited : '').toBe(true)
    })

    it('returns failure for unknown agency', () => {
      const result = resolveScopedCredential(999, null, 'openrouter')
      expect(result.ok).toBe(false)
      expect(isOk(result) ? '' : result.error.code).toBe('AGENCY_NOT_FOUND')
    })

    it('returns failure when agency has no credential for provider', () => {
      const result = resolveScopedCredential(1, null, 'heygen')
      expect(result.ok).toBe(false)
      expect(isOk(result) ? '' : result.error.code).toBe('CREDENTIAL_NOT_FOUND')
    })
  })

  // ── hasProviderAccess ──────────────────────────────────────────────────────
  describe('hasProviderAccess', () => {
    beforeEach(() => {
      registerAgencyCredentials(1, { openrouter: 'key' })
    })

    it('returns true when credential exists', () => {
      expect(hasProviderAccess(1, null, 'openrouter')).toBe(true)
    })

    it('returns false when credential does not exist', () => {
      expect(hasProviderAccess(1, null, 'heygen')).toBe(false)
    })

    it('returns false for unknown agency', () => {
      expect(hasProviderAccess(999, null, 'openrouter')).toBe(false)
    })
  })

  // ── revokeAgencyCredentials ────────────────────────────────────────────────
  describe('revokeAgencyCredentials', () => {
    it('removes all credentials for agency', () => {
      registerAgencyCredentials(1, { openrouter: 'key' })
      expect(hasProviderAccess(1, null, 'openrouter')).toBe(true)

      revokeAgencyCredentials(1)
      expect(hasProviderAccess(1, null, 'openrouter')).toBe(false)
    })
  })
})
