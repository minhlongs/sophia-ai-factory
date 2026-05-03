/**
 * DB queries and receipts for usage export cron
 * @module app/api/cron/usage-export/cron-usage-export-db
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { RaasLicenseRow } from '@/lib/supabase/types'

interface ExportJobInsert {
  id: string
  org_id?: string | null
  license_nonce: string
  export_format: 'json' | 'csv'
  period_start: number
  period_end: number
  record_count: number
  success: number
  error_message: string | null
  created_at: number
}

export async function getActiveLicenses(): Promise<RaasLicenseRow[]> {
  const db = createServerClient()
  const { data: rawData, error } = await db.from('raas_licenses').select('*').eq('is_revoked', false)
  if (error) {
    logger.error('[Usage Export Cron] Failed to query licenses', toError(error))
    throw new Error(`Database query failed: ${error.message}`)
  }
  const data = rawData as unknown as RaasLicenseRow[] | null
  const now = Math.floor(Date.now() / 1000)
  const activeLicenses = (data || []).filter((license: RaasLicenseRow) => !license.expires_at || license.expires_at > now)
  logger.info('[Usage Export Cron] Found active licenses', { total: data?.length || 0, active: activeLicenses.length })
  return activeLicenses
}

export async function storeExportReceipt(params: {
  licenseNonce: string
  recordCount: number
  format: 'json' | 'csv'
  periodStart: number
  periodEnd: number
  success: boolean
  errorMessage?: string
}): Promise<string | null> {
  try {
    const db = createServerClient()
    const jobId = crypto.randomUUID()
    const { error } = await db.from<ExportJobInsert>('export_jobs').insert({
      id: jobId,
      license_nonce: params.licenseNonce,
      record_count: params.recordCount,
      export_format: params.format,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      success: params.success ? 1 : 0,
      error_message: params.errorMessage || null,
      created_at: Math.floor(Date.now() / 1000),
    })
    if (error) {
      logger.warn('[Usage Export Cron] Failed to store export receipt', { jobId, error: error.message })
      return null
    }
    logger.info('[Usage Export Cron] Stored export receipt', { jobId })
    return jobId
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.warn('[Usage Export Cron] Exception storing export receipt', { error: err.message })
    return null
  }
}
