import { createHash, timingSafeEqual } from 'crypto'
import { logger } from '@/lib/utils/logger-utility'

/**
 * Polar.sh webhook signature verification
 *
 * Polar.sh signs webhooks using HMAC-SHA256 with the webhook secret.
 * Signature format: "whsec_<base64_encoded_secret>"
 *
 * @see https://docs.polar.sh/webhooks
 */

/**
 * Extract signature components from Polar webhook headers
 */
export function parseWebhookSignature(signature: string): {
  timestamp: number
  signatures: string[]
} | null {
  try {
    // Polar signature format: "t=<timestamp>,v1=<signature>"
    const parts = signature.split(',')
    const timestampPart = parts.find(p => p.startsWith('t='))
    const signatureParts = parts.filter(p => p.startsWith('v'))

    if (!timestampPart) {
      logger.warn('No timestamp in webhook signature')
      return null
    }

    const timestamp = parseInt(timestampPart.substring(2), 10)

    if (isNaN(timestamp)) {
      logger.warn('Invalid timestamp in webhook signature')
      return null
    }

    const signatures = signatureParts.map(p => p.substring(p.indexOf('=') + 1))

    return { timestamp, signatures }
  } catch (error) {
    logger.error('Failed to parse webhook signature', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

/**
 * Compute HMAC-SHA256 signature for webhook payload
 */
export function computeSignature(payload: string, secret: string): string {
  return createHmacSha256(secret, payload)
}

/**
 * Create HMAC-SHA256 hash
 */
function createHmacSha256(secret: string, data: string): string {
  const hmac = createHash('sha256')
  hmac.update(secret + data)
  return hmac.digest('hex')
}

/**
 * Verify webhook signature against expected signature
 * Uses timing-safe comparison to prevent timing attacks
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = computeSignature(payload, secret)

    // Convert to buffers for timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    // Must be same length for timingSafeEqual
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer)
  } catch (error) {
    logger.error('Signature verification failed', error instanceof Error ? error : new Error(String(error)))
    return false
  }
}

/**
 * Check if webhook timestamp is within acceptable tolerance
 * Prevents replay attacks with old webhooks
 */
export function isTimestampWithinTolerance(
  timestamp: number,
  toleranceSeconds: number = 300 // 5 minutes default
): boolean {
  const now = Math.floor(Date.now() / 1000)
  const diff = Math.abs(now - timestamp)

  return diff <= toleranceSeconds
}

/**
 * Get Polar webhook secret from environment
 */
export function getPolarWebhookSecret(): string | null {
  const secret = process.env.POLAR_WEBHOOK_SECRET

  if (!secret) {
    logger.error('POLAR_WEBHOOK_SECRET not configured in environment')
    return null
  }

  // Remove "whsec_" prefix if present
  return secret.startsWith('whsec_') ? secret.substring(6) : secret
}

/**
 * Complete webhook verification flow
 */
export interface WebhookVerificationResult {
  isValid: boolean
  error?: string
  timestamp?: number
}

export async function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null
): Promise<WebhookVerificationResult> {
  // Check signature header exists
  if (!signatureHeader) {
    return {
      isValid: false,
      error: 'Missing webhook signature header',
    }
  }

  // Get secret from environment
  const secret = getPolarWebhookSecret()
  if (!secret) {
    return {
      isValid: false,
      error: 'Webhook secret not configured',
    }
  }

  // Parse signature
  const parsed = parseWebhookSignature(signatureHeader)
  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid signature format',
    }
  }

  const { timestamp, signatures } = parsed

  // Check timestamp tolerance
  if (!isTimestampWithinTolerance(timestamp)) {
    return {
      isValid: false,
      error: 'Webhook timestamp outside tolerance (possible replay attack)',
      timestamp,
    }
  }

  // Verify signature
  const payload = `${timestamp}.${rawBody}`
  const isValid = signatures.some(sig =>
    verifySignature(payload, sig, secret)
  )

  if (!isValid) {
    return {
      isValid: false,
      error: 'Signature verification failed',
      timestamp,
    }
  }

  return {
    isValid: true,
    timestamp,
  }
}
