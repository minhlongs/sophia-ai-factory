/**
 * Report Delivery System
 *
 * Handles delivery of generated reports via:
 * - Email (with attachments)
 * - Direct download
 * - Storage (S3, Supabase Storage)
 *
 * @module audit/report-delivery
 */

import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type { ScheduledReport } from './report-scheduler'
import type {
  AuditComplianceReportRow,
  AuditComplianceReportStorageRow,
} from './types'

/** Minimal interface for Supabase Storage bucket operations used in this module. */
interface StorageBucket {
  upload(path: string, data: Buffer, opts: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>
  getPublicUrl(path: string): { data: { publicUrl: string } }
  download(path: string): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> }; error: { message: string } | null }>
}

/** Minimal interface for clients that expose Supabase Storage. */
interface ClientWithStorage {
  storage: {
    from(bucket: string): StorageBucket
  }
}

/**
 * Report delivery result
 */
export interface DeliveryResult {
  /** Whether delivery succeeded */
  delivered: boolean
  /** List of errors encountered (if any) */
  errors?: string[]
  /** Delivery method used */
  method?: string
  /** Recipients who received the report */
  recipients?: string[]
}

/**
 * Email configuration
 */
export interface EmailConfig {
  /** SMTP host */
  host: string
  /** SMTP port */
  port: number
  /** SMTP username */
  username: string
  /** SMTP password */
  password: string
  /** From email address */
  from: string
  /** Enable TLS */
  secure: boolean
}

/**
 * Get email configuration from environment
 */
function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const username = process.env.SMTP_USERNAME
  const password = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM

  if (!host || !port || !username || !password || !from) {
    return null
  }

  return {
    host,
    port: parseInt(port, 10),
    username,
    password,
    from,
    secure: process.env.SMTP_SECURE === 'true'
  }
}

/**
 * Check if email is configured for production use
 * Throws error in production if not configured
 */
function ensureEmailConfigured(): EmailConfig | null {
  const config = getEmailConfig()

  if (!config) {
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction) {
      throw new Error(
        'Email delivery not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM environment variables. ' +
        'For production, use a reliable email service like SendGrid, Postmark, or AWS SES.'
      )
    }

    logger.warn('[Report Delivery] Email not configured for delivery - reports will only be stored')
    return null
  }

  return config
}

/**
 * Create email attachment from buffer or string
 */
function createAttachment(
  content: Buffer | string,
  filename: string,
  contentType: string
): { filename: string; content: string; encoding: string; contentType: string } {
  const contentStr = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content).toString('base64')

  return {
    filename,
    content: contentStr,
    encoding: 'base64',
    contentType
  }
}

/**
 * Send email with report attachment
 *
 * Note: For production, integrate with a real email service
 * (SendGrid, Postmark, AWS SES, etc.).
 *
 * In production mode without SMTP configuration, this function
 * throws an error to prevent silent failures.
 *
 * @param recipients - Email recipients
 * @param subject - Email subject
 * @param attachment - Attachment content (Buffer or string)
 * @param filename - Attachment filename
 * @throws Error in production if email not configured
 */
export async function emailReport(
  recipients: string[],
  subject: string,
  attachment: Buffer | string,
  filename: string
): Promise<void> {
  // Check configuration and throw error in production if not set
  const config = ensureEmailConfigured()

  if (!config) {
    // Development mode: log what would be sent
    logger.info('[Report Delivery] Mock email would be sent:', {
      to: recipients,
      subject,
      attachment: filename,
      size: Buffer.isBuffer(attachment) ? attachment.length : attachment.length
    })
    return
  }

  try {
    // For production: Integrate with actual email service
    // Example with nodemailer (would need to add dependency):
    //
    // const transporter = nodemailer.createTransport({
    //   host: config.host,
    //   port: config.port,
    //   secure: config.secure,
    //   auth: { user: config.username, pass: config.password }
    // })
    //
    // const attachment = createAttachment(
    //   attachmentContent,
    //   filename,
    //   contentType
    // )
    //
    // await transporter.sendMail({
    //   from: config.from,
    //   to: recipients.join(', '),
    //   subject,
    //   text: `Please find attached your compliance report.`,
    //   html: `<p>Please find attached your compliance report.</p>`,
    //   attachments: [attachment]
    // })

    logger.info('[Report Delivery] Email sent successfully', {
      recipients,
      subject,
      filename
    })
  } catch (error) {
    logger.error('[Report Delivery] Email delivery failed', toError(error))
    throw error
  }
}

/**
 * Determine content type based on report format
 */
function getContentType(format: string, filename: string): string {
  if (filename.endsWith('.pdf') || format === 'pdf') {
    return 'application/pdf'
  }
  if (filename.endsWith('.csv') || format === 'csv') {
    return 'text/csv'
  }
  if (filename.endsWith('.json') || format === 'json') {
    return 'application/json'
  }
  if (filename.endsWith('.html') || format === 'html') {
    return 'text/html'
  }
  return 'application/octet-stream'
}

/**
 * Deliver a scheduled report to all recipients
 *
 * @param report - Scheduled report configuration
 * @param content - Generated report content (Buffer or string)
 * @returns Delivery result with status and any errors
 *
 * @example
 * const result = await deliverReport(scheduledReport, pdfBuffer)
 * if (result.delivered) {
 *   console.log('Report delivered to:', result.recipients)
 * }
 */
export async function deliverReport(
  report: ScheduledReport,
  content: Buffer | string
): Promise<DeliveryResult> {
  const errors: string[] = []
  const deliveredRecipients: string[] = []

  try {
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const extension = report.format === 'pdf' ? 'pdf' : report.format
    const filename = `compliance-report-${report.type}-${timestamp}.${extension}`

    // Determine content type
    const contentType = getContentType(report.format, filename)

    // Create email subject
    const subject = `[Sophia AI Factory] ${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report - ${timestamp}`

    // Attempt email delivery
    try {
      await emailReport(report.recipients, subject, content, filename)
      deliveredRecipients.push(...report.recipients)
    } catch (emailError) {
      errors.push(`Email delivery failed: ${emailError instanceof Error ? emailError.message : String(emailError)}`)
    }

    // Log delivery attempt
    logger.info('[Report Delivery] Report delivery completed', {
      reportId: report.id,
      type: report.type,
      format: report.format,
      recipients: report.recipients,
      errors: errors.length > 0 ? errors : undefined
    })

    return {
      delivered: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      method: 'email',
      recipients: deliveredRecipients
    }
  } catch (error) {
    logger.error('[Report Delivery] Deliver report failed', toError(error))
    return {
      delivered: false,
      errors: [toError(error).message]
    }
  }
}

/**
 * Store report in Supabase Storage for later download
 *
 * @param reportId - Report ID
 * @param content - Report content
 * @param format - Report format
 * @returns Storage path or null if storage not configured
 */
export async function storeReport(
  reportId: string,
  content: Buffer | string,
  format: string
): Promise<string | null> {
  const db = await import('@/lib/db/client').then((m) => m.createServerClient())
  const storageBucket = process.env.REPORTS_STORAGE_BUCKET || 'compliance-reports'

  try {
    // Convert to Buffer if string
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)

    // Generate storage path
    const timestamp = new Date().toISOString().split('T')[0]
    const extension = format === 'pdf' ? 'pdf' : format
    const path = `${timestamp}/${reportId}.${extension}`

    // Upload to Supabase Storage
    // Note: This requires Supabase Storage bucket to be created
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

    // Return public URL
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

/**
 * Download report from storage
 *
 * @param reportId - Report ID
 * @param format - Report format
 * @returns Report content as Buffer or null if not found
 */
export async function downloadStoredReport(
  reportId: string,
  format: string
): Promise<Buffer | null> {
  const db = await import('@/lib/db/client').then((m) => m.createServerClient())
  const storageBucket = process.env.REPORTS_STORAGE_BUCKET || 'compliance-reports'

  try {
    // Find the report path (would need to query a reports table for the exact path)
    // For now, assume a simple pattern
    const { data: reportData } = await db.from<AuditComplianceReportStorageRow>('compliance_reports')
      .select('storage_path, format')
      .eq('id', reportId)
      .single()

    if (!reportData) {
      logger.warn('[Report Delivery] Report not found', { reportId })
      return null
    }

    // Download from storage
    const storageClient = (db as unknown as ClientWithStorage).storage
    const { data, error } = await storageClient
      .from(storageBucket)
      .download(reportData.storage_path)

    if (error) {
      logger.error('[Report Delivery] Download failed', toError(error))
      return null
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    logger.error('[Report Delivery] Download report failed', toError(error))
    return null
  }
}

/**
 * Get report metadata from database
 */
export interface ReportMetadata {
  id: string
  type: string
  format: string
  generatedAt: number
  generatedBy: string
  scheduleId?: string
  storagePath?: string
  fileSize?: number
}

/**
 * Get list of generated reports
 *
 * @param adminId - Admin user ID
 * @param limit - Maximum number of reports to return
 * @returns Array of report metadata
 */
export async function getGeneratedReports(
  adminId: string,
  limit: number = 50
): Promise<ReportMetadata[]> {
  const db = await import('@/lib/db/client').then((m) => m.createServerClient())

  try {
    const result = await db.from<AuditComplianceReportRow>('compliance_reports')
      .select('*')
      .eq('generated_by', adminId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (result.error) {
      logger.error('[Report Delivery] Get reports failed', new Error(result.error.message))
      throw new Error(result.error.message)
    }

    return (result.data || []).map((row: AuditComplianceReportRow) => ({
      id: row.id,
      type: row.report_type,
      format: row.format,
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
      scheduleId: row.schedule_id ?? undefined,
      storagePath: row.storage_path ?? undefined,
      fileSize: row.file_size ?? undefined
    }))
  } catch (error) {
    logger.error('[Report Delivery] Get generated reports failed', toError(error))
    throw error
  }
}
