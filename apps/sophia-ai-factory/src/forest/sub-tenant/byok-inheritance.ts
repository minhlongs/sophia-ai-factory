/**
 * BYOK Inheritance — agency Bring-Your-Own-Key scoping per sub-tenant.
 *
 * Provides credential access patterns that:
 * 1. Store agency-level BYOK keys (in-memory for Phase 3; production: KV)
 * 2. Scope them per sub-tenant (no key leakage between agencies or sub-tenants)
 * 3. Return credential references, never exposing the raw key
 *
 * Layer: forest (infrastructure orchestrator)
 * Dependencies: seed only (logger, Result type)
 */

import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Provider = 'openrouter' | 'elevenlabs' | 'heygen' | 'd-id'

export interface ScopedCredential {
  provider: Provider
  scopedToAgencyId: number
  scopedToSubTenantId: number | null
  /** Opaque reference. Resolved by tree/byok/ at call time — never the raw key. */
  referenceToken: string
  inherited: boolean
}

interface AgencyCredentialStore {
  agencyKeys: Partial<Record<Provider, string>>
  subTenantOverrides: Map<number, Partial<Record<Provider, string>>>
}

// ── In-memory store (Phase 3) ─────────────────────────────────────────────────
// Production: encrypt + store in KV with agency-scoped prefix.
// The encryption utility lives at seed/security/crypto-utils.

const agencyCredentialStores = new Map<number, AgencyCredentialStore>()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register agency-level BYOK credentials.
 * Called during agency onboarding / key update flows.
 */
export function registerAgencyCredentials(
  agencyId: number,
  keys: Partial<Record<Provider, string>>,
): Result<void, { code: string; message: string }> {
  const log = logger.child('byok-inheritance')

  const nonEmptyKeys = Object.fromEntries(
    Object.entries(keys).filter(([, v]) => v && v.trim() !== ''),
  ) as Partial<Record<Provider, string>>

  if (Object.keys(nonEmptyKeys).length === 0) {
    log.warn('Empty credential set rejected', { agencyId })
    return failure({ code: 'INVALID_CREDENTIAL', message: 'At least one non-empty credential required' })
  }

  agencyCredentialStores.set(agencyId, {
    agencyKeys: nonEmptyKeys,
    subTenantOverrides: new Map(),
  })

  log.info('Agency credentials registered', {
    agencyId,
    providers: Object.keys(nonEmptyKeys),
  })

  return success(undefined)
}

/**
 * Set a sub-tenant-level credential override.
 * null key = remove override (sub-tenant inherits from agency).
 */
export function setSubTenantCredentialOverride(
  agencyId: number,
  subTenantId: number,
  provider: Provider,
  key: string | null,
): Result<void, { code: string; message: string }> {
  const log = logger.child('byok-inheritance')
  const store = agencyCredentialStores.get(agencyId)

  if (!store) {
    return failure({ code: 'AGENCY_NOT_FOUND', message: `No credential store for agency ${agencyId}` })
  }

  if (key !== null && key.trim() === '') {
    log.warn('Empty credential override rejected', { agencyId, subTenantId, provider })
    return failure({ code: 'INVALID_CREDENTIAL', message: 'Override must be null or non-empty string' })
  }

  const overrides = new Map(store.subTenantOverrides)

  if (key === null) {
    overrides.delete(subTenantId)
  } else {
    const existing = overrides.get(subTenantId) ?? {}
    overrides.set(subTenantId, { ...existing, [provider]: key })
  }

  agencyCredentialStores.set(agencyId, {
    ...store,
    subTenantOverrides: overrides,
  })

  log.info('Sub-tenant credential override set', { agencyId, subTenantId, provider, hasKey: key !== null })
  return success(undefined)
}

/**
 * Resolve the effective credential for a sub-tenant + provider.
 *
 * Resolution: sub-tenant override → agency-level → failure.
 * NEVER returns the raw key — returns a reference token resolved by tree/byok/.
 */
export function resolveScopedCredential(
  agencyId: number,
  subTenantId: number | null,
  provider: Provider,
): Result<ScopedCredential, { code: string; message: string }> {
  const store = agencyCredentialStores.get(agencyId)

  if (!store) {
    return failure({ code: 'AGENCY_NOT_FOUND', message: `No credential store for agency ${agencyId}` })
  }

  // 1. Sub-tenant override
  if (subTenantId !== null) {
    const overrides = store.subTenantOverrides.get(subTenantId)
    if (overrides?.[provider]) {
      return success({
        provider,
        scopedToAgencyId: agencyId,
        scopedToSubTenantId: subTenantId,
        referenceToken: buildReferenceToken(agencyId, subTenantId, provider, false),
        inherited: false,
      })
    }
  }

  // 2. Agency-level
  if (store.agencyKeys[provider]) {
    return success({
      provider,
      scopedToAgencyId: agencyId,
      scopedToSubTenantId: subTenantId,
      referenceToken: buildReferenceToken(agencyId, subTenantId, provider, true),
      inherited: true,
    })
  }

  return failure({
    code: 'CREDENTIAL_NOT_FOUND',
    message: `No ${provider} credential found for agency ${agencyId}`,
  })
}

/**
 * Fast boolean check: does a sub-tenant have access to a provider?
 */
export function hasProviderAccess(agencyId: number, subTenantId: number | null, provider: Provider): boolean {
  return resolveScopedCredential(agencyId, subTenantId, provider).ok
}

/**
 * Revoke all credentials for an agency (on cancellation).
 */
export function revokeAgencyCredentials(agencyId: number): void {
  agencyCredentialStores.delete(agencyId)
  logger.info('byok-inheritance: credentials revoked', { agencyId })
}

// ── Private ───────────────────────────────────────────────────────────────────

function buildReferenceToken(
  agencyId: number,
  subTenantId: number | null,
  provider: Provider,
  _inherited: boolean,
): string {
  // Base64url-encoded opaque token: agencyId:subTenantId:provider
  // Resolved by tree/byok/resolve-scoped-credential at call time.
  const raw = [String(agencyId), subTenantId != null ? String(subTenantId) : '*', provider].join(':')
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
