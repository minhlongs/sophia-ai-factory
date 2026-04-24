/**
 * Webhook Notification Service
 *
 * Send quota alerts to custom webhook URLs with HMAC-SHA256 signature verification.
 * Supports retry logic with exponential backoff for failed deliveries.
 *
 * Features:
 * - HMAC-SHA256 signature generation for webhook security
 * - Retry logic (3 attempts with exponential backoff)
 * - Timeout handling (10 second limit)
 * - Delivery status tracking
 * - Support for custom payloads per alert type
 *
 * @module alerts/webhook-notification-service
 */

import { logger } from '@/lib/utils/logger-utility';
import { toError, getErrorMessage } from '@/lib/utils/to-error';
import crypto from 'crypto';
import { triggerWebhookFailedAlert } from '@/lib/alerts/realtime-alert-service';

/**
 * Webhook alert event types
 */
export type WebhookEventType =
  | 'quota.threshold'
  | 'quota.exceeded'
  | 'overage.detected'
  | 'subscription.expiring'
  | 'payment.failed';

/**
 * Webhook alert payload structure
 */
export interface WebhookPayload {
  /** Unique event ID */
  eventId: string;
  /** Event type */
  event: WebhookEventType;
  /** User ID */
  userId: string;
  /** License nonce */
  licenseNonce: string;
  /** Alert threshold percentage (80, 90, 100) */
  threshold?: number;
  /** Current usage percentage */
  percentage: number;
  /** Usage limit */
  limit: number;
  /** Current usage amount */
  currentUsage: number;
  /** Tier level */
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  /** Exceeded type (for quota events) */
  exceededType?: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  /** Timestamp in ISO 8601 format */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  responseStatus?: number;
  error?: string;
  deliveryTimeMs?: number;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 *
 * Signature format: v1={hex_signature}
 * Signed payload: {timestamp}.{json_string}
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret key
 * @param timestamp - Unix timestamp (optional, defaults to now)
 * @returns Signature string
 */
export function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${ts}.${payloadString}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return {
    signature: `v1=${signature}`,
    timestamp: ts,
  };
}

/**
 * Verify HMAC signature (for incoming webhooks)
 *
 * @param signature - Received signature header
 * @param payload - Received payload string
 * @param timestamp - Timestamp from header
 * @param secret - Webhook secret
 * @param tolerance - Tolerance in seconds (default: 5 minutes)
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  signature: string,
  payload: string,
  timestamp: number,
  secret: string,
  tolerance: number = 300
): boolean {
  try {
    // Check timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Verify signature format
    const [version, sig] = signature.split('=');
    if (version !== 'v1' || !sig) {
      return false;
    }

    // Create expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Sleep helper for retry logic
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send webhook alert with retry logic
 *
 * Retry strategy:
 * - Attempt 1: Immediate
 * - Attempt 2: After 2 seconds
 * - Attempt 3: After 4 seconds
 *
 * @param webhookUrl - Target webhook URL
 * @param payload - Alert payload
 * @param secret - Optional webhook secret for signing
 * @returns Delivery result
 */
export async function sendWebhookAlert(
  webhookUrl: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const maxRetries = 3;
  const timeoutMs = 10000; // 10 seconds
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-AI-Factory-Webhook/1.0',
      };

      // Add signature headers if secret provided
      if (secret) {
        const { signature, timestamp } = generateWebhookSignature(payload, secret);
        headers['X-Signature'] = signature;
        headers['X-Timestamp'] = timestamp.toString();
      }

      // Send webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const deliveryTime = Date.now() - startTime;

      if (response.ok) {
        logger.info('[Webhook Alert] Delivered successfully', {
          url: webhookUrl,
          eventId: payload.eventId,
          attempt,
          deliveryTimeMs: deliveryTime,
        });

        return {
          success: true,
          attempts: attempt,
          responseStatus: response.status,
          deliveryTimeMs: deliveryTime,
        };
      }

      // Non-OK response
      lastError = `HTTP ${response.status}: ${response.statusText}`;
      logger.warn('[Webhook Alert] Non-OK response', {
        url: webhookUrl,
        status: response.status,
        attempt,
      });

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);
      lastError = errorMessage;

      logger.warn('[Webhook Alert] Delivery failed', {
        url: webhookUrl,
        error: errorMessage,
        attempt,
        deliveryTimeMs: deliveryTime,
      });

      // Timeout or network error - retry with backoff
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
      }
    }
  }

  // All retries failed
  logger.error('[Webhook Alert] All retries failed', {
    url: webhookUrl,
    eventId: payload.eventId,
    attempts: maxRetries,
    lastError,
  });

  // Phase 7.3: Trigger real-time alert for webhook delivery failure
  await triggerWebhookFailedAlert({
    userId: payload.userId,
    licenseNonce: payload.licenseNonce,
    webhookUrl,
    attempts: maxRetries,
    error: lastError || 'Unknown error',
  }).catch(err => {
    logger.error('[Webhook Alert] Failed to trigger real-time alert', toError(err));
  });

  return {
    success: false,
    attempts: maxRetries,
    error: lastError,
  };
}

/**
 * Create standardized webhook payload for quota threshold alert
 *
 * @param params - Alert parameters
 * @returns Webhook payload
 */
export function createQuotaThresholdPayload(params: {
  userId: string;
  licenseNonce: string;
  threshold: number;
  percentage: number;
  limit: number;
  currentUsage: number;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  metadata?: Record<string, any>;
}): WebhookPayload {
  return {
    eventId: crypto.randomUUID(),
    event: 'quota.threshold',
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    threshold: params.threshold,
    percentage: params.percentage,
    limit: params.limit,
    currentUsage: params.currentUsage,
    tier: params.tier,
    exceededType: params.exceededType,
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  };
}

/**
 * Create standardized webhook payload for overage detected alert
 *
 * @param params - Alert parameters
 * @returns Webhook payload
 */
export function createOverageDetectedPayload(params: {
  userId: string;
  licenseNonce: string;
  percentage: number;
  limit: number;
  currentUsage: number;
  overageAmount: number;
  overageFee: number;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  metadata?: Record<string, any>;
}): WebhookPayload {
  return {
    eventId: crypto.randomUUID(),
    event: 'overage.detected',
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    percentage: params.percentage,
    limit: params.limit,
    currentUsage: params.currentUsage,
    tier: params.tier,
    exceededType: params.exceededType,
    timestamp: new Date().toISOString(),
    metadata: {
      overageAmount: params.overageAmount,
      overageFee: params.overageFee,
      ...params.metadata,
    },
  };
}
