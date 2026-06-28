/**
 * RaaS Module
 *
 * Barrel re-export for all RaaS functionality.
 * Maintains backward compatibility with original raas-audit.ts imports.
 *
 * @module raas
 */

// Audit writes
export {
  logAuditAction,
  logLicenseCreation,
  logLicenseValidation,
  logLicenseRevocation,
  logLicenseExtension,
} from './audit-logging-service';

// Audit queries
export {
  getAuditLogs,
  getAuditLogsByLicense,
  exportAuditLogs,
} from './audit-query-service';

// License CRUD / permission checking
export {
  createLicense,
  getLicenseByNonce,
  getLicenses,
  revokeLicense,
  extendLicense,
  incrementValidationCount,
} from './raas-permission-checker';

// Subscription-driven operations
export {
  reactivateLicenseBySubscription,
  revokeLicenseBySubscription,
} from './raas-invoice-generator';
