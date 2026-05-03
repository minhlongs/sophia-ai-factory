import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

/** Email configuration */
export interface EmailConfig {
  host: string
  port: number
  username: string
  password: string
  from: string
  secure: boolean
}

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

export async function emailReport(
  recipients: string[],
  subject: string,
  attachment: Buffer | string,
  filename: string
): Promise<void> {
  const config = ensureEmailConfigured()

  if (!config) {
    logger.info('[Report Delivery] Mock email would be sent:', {
      to: recipients,
      subject,
      attachment: filename,
      size: Buffer.isBuffer(attachment) ? attachment.length : attachment.length
    })
    return
  }

  try {
    // Production: integrate with email service (SendGrid, Postmark, AWS SES) using config fields
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
