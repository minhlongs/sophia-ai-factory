/**
 * Audit Logger - Barrel Re-export
 *
 * All audit logging functions and types consolidated for import.
 * Import from '@/lib/audit/audit-logger' (backward compat) or this barrel.
 */

export type {
  ValidationLogParams,
  CreationLogParams,
  RevocationLogParams,
  UsageLogParams,
} from './audit-event-builder'

export {
  logValidationWithReceipt,
  logCreationWithReceipt,
  logRevocationWithReceipt,
} from './audit-writer'

export {
  logUpdateWithReceipt,
  logUsageWithReceipt,
} from './audit-writer-extended'

export {
  serializeReceiptForHeader,
  parseReceiptFromHeader,
  logAuditEvent,
} from './audit-query'
