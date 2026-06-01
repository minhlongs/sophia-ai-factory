/**
 * RaaS Gate - Barrel Re-export (backward compatibility)
 *
 * Implementation split into raas/ directory for modular code management.
 * Import from here or directly from '@/forest/raas/*'.
 */

export { raasGate, raasGate as default } from './raas/raas-auth-gate'
export type { RaasGateResult } from './raas/raas-auth-gate'

export {
  extractLicenseKey,
  validateLicenseKey,
  createForbiddenResponse,
  shouldApplyRaasGate,
  getRaaSConfig,
} from './raas/raas-validation'

export type { RaaSValidationResult } from './raas/raas-validation'

export { enforceRaasQuota } from './raas/raas-rate-limiter'
