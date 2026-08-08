/**
 * Shared row interfaces for audit module DB queries.
 *
 * These are narrow read-shapes used by db.from<T>() in audit queries.
 * For audit log shapes, use Record<string, unknown>
 * from '@/tree/database/supabase-types'.
 *
 * @module audit/types
 */

// RaaS types removed — use Record<string, unknown> for audit log shapes
import type { Json } from '@/tree/database/supabase-types'

/**
 * DB row shape for compliance_report_schedules table.
 * Moved from report-scheduler.ts to allow cross-file reuse.
 */
export interface AuditScheduledReportRow {
  id: string
  report_type: string
  format: string
  frequency: string
  recipients: string[]
  filters: Json
  next_run_at: number
  created_at: number
  created_by: string
}

/**
 * Narrow row shape for raas_licenses reads in cron-report-runner.
 */

/**
 * Narrow row shape for raas_usage_events reads in cron-report-runner.
 */
export interface AuditUsageEventRow {
  license_nonce: string
  model_name: string
  token_count: number
  tokens_input: number
  tokens_output: number
}

/**
 * Narrow row shape for hash-chain integrity checks.
 */
export interface AuditHashChainRow {
  content_hash: string
  hash_chain_valid: boolean
}

/**
 * Narrow row shape for gdpr_erasure_requests table.
 */

/**
 * Narrow row shape for auth.users metadata reads.
 */
export interface AuditUserMetadataRow {
  raw_user_meta_data: Record<string, unknown>
}

/**
 * Narrow row shape for compliance_reports table.
 */
export interface AuditComplianceReportRow {
  id: string
  report_type: string
  format: string
  generated_at: number
  generated_by: string
  schedule_id: string | null
  storage_path: string | null
  file_size: number | null
}

/**
 * Narrow row shape for compliance_reports storage_path lookup.
 */
export interface AuditComplianceReportStorageRow {
  storage_path: string
  format: string
}
