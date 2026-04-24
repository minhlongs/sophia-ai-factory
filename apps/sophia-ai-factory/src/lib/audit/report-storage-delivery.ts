import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type {
  AuditComplianceReportStorageRow,
} from './types'

interface StorageBucket {
  upload(path: string, data: Buffer, opts: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>
  getPublicUrl(path: string): { data: { publicUrl: string } }
  download(path: string): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> }; error: { message: string } | null }>
}

interface ClientWithStorage {
  storage: {
    from(bucket: string): StorageBucket
  }
}

function getContentType(format: string, filename: string): string {
  if (filename.endsWith('.pdf') || format === 'pdf') return 'application/pdf'
  if (filename.endsWith('.csv') || format === 'csv') return 'text/csv'
  if (filename.endsWith('.json') || format === 'json') return 'application/json'
  if (filename.endsWith('.html') || format === 'html') return 'text/html'
  return 'application/octet-stream'
}

export async function storeReport(
  reportId: string,
  content: Buffer | string,
  format: string
): Promise<string | null> {
  const db = await import('@/lib/db/client').then((m) => m.createServerClient())
  const storageBucket = process.env.REPORTS_STORAGE_BUCKET || 'compliance-reports'

  try {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
    const timestamp = new Date().toISOString().split('T')[0]
    const extension = format === 'pdf' ? 'pdf' : format
    const path = `${timestamp}/${reportId}.${extension}`

    const storageClient = (db as unknown as ClientWithStorage).storage
    const { error } = await storageClient
      .from(storageBucket)
      .upload(path, buffer, {
        contentType: getContentType(format, path),
        upsert: true
      })

    if (error) {
      logger.error('[Report Delivery] Storage upload failed', new Error(error.message))
      return null
    }

    const { data } = storageClient
      .from(storageBucket)
      .getPublicUrl(path)

    logger.info('[Report Delivery] Report stored successfully', {
      reportId,
      path,
      url: data?.publicUrl
    })

    return data?.publicUrl || path
  } catch (error) {
    logger.error('[Report Delivery] Store report failed', toError(error))
    return null
  }
}

export async function downloadStoredReport(
  reportId: string,
  format: string
): Promise<Buffer | null> {
  const db = await import('@/lib/db/client').then((m) => m.createServerClient())
  const storageBucket = process.env.REPORTS_STORAGE_BUCKET || 'compliance-reports'

  try {
    const { data: reportData } = await db.from<AuditComplianceReportStorageRow>('compliance_reports')
      .select('storage_path, format')
      .eq('id', reportId)
      .single()

    if (!reportData) {
      logger.warn('[Report Delivery] Report not found', { reportId })
      return null
    }

    const storageClient = (db as unknown as ClientWithStorage).storage
    const { data, error } = await storageClient
      .from(storageBucket)
      .download(reportData.storage_path)

    if (error) {
      logger.error('[Report Delivery] Download failed', toError(error))
      return null
    }

    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    logger.error('[Report Delivery] Download report failed', toError(error))
    return null
  }
}
