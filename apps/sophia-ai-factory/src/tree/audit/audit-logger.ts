/**
 * Audit Logger - Barrel Re-export (backward compatibility)
 *
 * Implementation moved to logger/ directory for modular code management.
 * Import from here or directly from '@/lib/audit/logger/*'.
 */

export type {
  ValidationLogParams,
  CreationLogParams,
  RevocationLogParams,
  UsageLogParams,
} from './logger/audit-event-builder'

export {
  logValidationWithReceipt,
  logCreationWithReceipt,
  logRevocationWithReceipt,
} from './logger/audit-writer'

export {
  logUpdateWithReceipt,
  logUsageWithReceipt,
} from './logger/audit-writer-extended'

export {
  serializeReceiptForHeader,
  parseReceiptFromHeader,
  logAuditEvent,
} from './logger/audit-query'
