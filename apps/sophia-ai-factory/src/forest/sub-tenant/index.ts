/**
 * Sub-tenant module — barrel exports.
 *
 * Provides:
 * - Agency middleware: X-Agency-Key header validation + agency context injection
 * - Credit meter: reserve / commit / refund with retry
 * - BYOK inheritance: scoped credential resolution per sub-tenant
 */

export { validateAgencyKey, type AgencyAuthResult, type AgencyAuthError } from './agency-middleware'
export { CreditMeter, DEFAULT_CREDIT_METER_CONFIG, type CreditMeterConfig, type ReservationReceipt, type ConsumedReceipt } from './credit-meter'
export {
  registerAgencyCredentials,
  setSubTenantCredentialOverride,
  resolveScopedCredential,
  hasProviderAccess,
  revokeAgencyCredentials,
  type Provider,
  type ScopedCredential,
} from './byok-inheritance'
export type { Agency, SubTenant, AgencyContext, AgencyTier, AgencyStatus, SubTenantStatus } from './types'
