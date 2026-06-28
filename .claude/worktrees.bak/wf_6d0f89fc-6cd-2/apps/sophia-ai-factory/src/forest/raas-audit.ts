/**
 * RaaS Audit Service — backward-compatibility re-export
 *
 * All functionality moved to ./raas/* modules.
 * This file re-exports everything so existing imports continue to work.
 *
 * @module lib/raas-audit
 * @deprecated Import from '@/forest/raas' directly
 */

export {
  createLicense,
  getLicenseByNonce,
  getLicenses,
  revokeLicense,
  extendLicense,
  incrementValidationCount,
  logAuditAction,
  logLicenseCreation,
  logLicenseValidation,
  logLicenseRevocation,
  logLicenseExtension,
  getAuditLogs,
  getAuditLogsByLicense,
  exportAuditLogs,
  reactivateLicenseBySubscription,
  revokeLicenseBySubscription,
} from './raas';
