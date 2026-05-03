/**
 * Enrichment Audit Logger for Cloudflare Worker
 *
 * Logs enrichment decisions for auditability and compliance.
 * Uses async queue to avoid blocking request processing.
 *
 * @module worker/enrichment-logger
 */

import type { EnrichmentLog } from './enrichment-logger-types';
import {
  initializeLogQueue,
  flushLogs,
  hashIpSync,
  LOGGER_CONFIG,
} from './enrichment-log-queue';

/** Subset of Cloudflare Worker Env bindings used by the enrichment logger */
interface EnrichmentLoggerEnv {
  ENVIRONMENT: string;
  AGENCYOS_NOTIFICATION_URL: string;
  AGENCYOS_WEBHOOK_SECRET: string;
}

export type { EnrichmentLog } from './enrichment-logger-types';

/**
 * Log enrichment decision (non-blocking).
 */
export async function logEnrichmentDecision(
  log: Omit<EnrichmentLog, 'id' | 'timestamp'>,
  env: EnrichmentLoggerEnv,
  ctx: ExecutionContext
): Promise<void> {
  const queue = initializeLogQueue();
  const startTime = Date.now();

  const logEntry: EnrichmentLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: startTime,
  };

  queue.logs.push(logEntry);

  if (queue.logs.length >= queue.maxBatchSize) {
    ctx.waitUntil(flushLogs(queue, env));
  }

  if (env.ENVIRONMENT === 'development') {
    console.log('[Enrichment Logger] Decision logged:', {
      licenseNonce: log.licenseNonce.slice(0, 8) + '...',
      tier: log.tier,
      cacheHit: log.cacheHit,
      processingTimeMs: log.processingTimeMs,
    });
  }
}

/**
 * Force flush all pending logs (for shutdown).
 */
export async function forceFlushLogs(env: EnrichmentLoggerEnv): Promise<void> {
  const queue = initializeLogQueue();
  if (queue.logs.length > 0) {
    await flushLogs(queue, env);
  }
}

/**
 * Create enrichment log from JWT enrichment result.
 */
export function createEnrichmentLog(
  licenseNonce: string,
  userId: string,
  tier: string,
  features: string[],
  quotaLimits: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  },
  source: 'cache' | 'database' | 'fallback',
  cacheHit: boolean,
  processingTimeMs: number,
  requestId?: string,
  userAgent?: string,
  ip?: string
): Omit<EnrichmentLog, 'id' | 'timestamp'> {
  return {
    licenseNonce,
    userId,
    tier,
    features,
    quotaLimits,
    enrichmentSource: source,
    cacheHit,
    processingTimeMs,
    environment: typeof self !== 'undefined' ? ((self as unknown as Record<string, string>).ENVIRONMENT || 'unknown') : 'unknown',
    requestId,
    userAgent,
    ipHash: ip ? hashIpSync(ip) : undefined,
  };
}

/**
 * Get pending log count for monitoring.
 */
export function getPendingLogCount(): number {
  const queue = initializeLogQueue();
  return queue.logs.length;
}

export { LOGGER_CONFIG } from './enrichment-log-queue';
