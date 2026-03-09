/**
 * Enrichment Audit Logger for Cloudflare Worker
 *
 * Logs enrichment decisions for auditability and compliance.
 * Uses async queue to avoid blocking request processing.
 *
 * @module worker/enrichment-logger
 */

/**
 * Enrichment decision log entry
 */
export interface EnrichmentLog {
  id: string;
  timestamp: number;
  licenseNonce: string;
  userId: string;
  tier: string;
  features: string[];
  quotaLimits: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  };
  enrichmentSource: 'cache' | 'database' | 'fallback';
  cacheHit: boolean;
  processingTimeMs: number;
  environment: string;
  requestId?: string;
  userAgent?: string;
  ipHash?: string; // Hashed IP for privacy
}

/**
 * Queue for async logging
 */
interface LogQueue {
  logs: EnrichmentLog[];
  flushIntervalMs: number;
  maxBatchSize: number;
}

/**
 * Logger configuration
 */
const LOGGER_CONFIG = {
  flushIntervalMs: 5000, // Flush every 5 seconds
  maxBatchSize: 100,     // Or when batch reaches 100 entries
  queueEndpoint: '/api/audit/enrichment', // Endpoint to receive logs
};

/**
 * Global log queue (singleton per worker instance)
 */
let logQueue: LogQueue | null = null;

/**
 * Initialize the log queue
 */
function initializeLogQueue(): LogQueue {
  if (!logQueue) {
    logQueue = {
      logs: [],
      flushIntervalMs: LOGGER_CONFIG.flushIntervalMs,
      maxBatchSize: LOGGER_CONFIG.maxBatchSize,
    };
  }
  return logQueue;
}

/**
 * Hash IP address for privacy (one-way hash)
 */
async function hashIp(ip: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'unknown';
  }
}

/**
 * Log enrichment decision (non-blocking)
 *
 * @param log - Enrichment log entry
 * @param env - Worker environment bindings
 * @param ctx - ExecutionContext for waitUntil
 */
export async function logEnrichmentDecision(
  log: Omit<EnrichmentLog, 'id' | 'timestamp'>,
  env: Env,
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

  // Flush if batch is full
  if (queue.logs.length >= queue.maxBatchSize) {
    ctx.waitUntil(flushLogs(queue, env));
  }

  // Log locally for immediate debugging (production: remove console.log)
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
 * Flush logs to storage (async, non-blocking)
 */
async function flushLogs(queue: LogQueue, env: Env): Promise<void> {
  if (queue.logs.length === 0) {
    return;
  }

  const logsToFlush = [...queue.logs];
  queue.logs = [];

  try {
    // Send to audit endpoint for persistent storage
    const response = await fetch(`${env.AGENCYOS_NOTIFICATION_URL}${LOGGER_CONFIG.queueEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': env.AGENCYOS_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        type: 'enrichment-decisions',
        logs: logsToFlush,
        flushedAt: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error('[Enrichment Logger] Flush failed:', response.status);
      // Re-queue on failure (with limit to prevent infinite loop)
      if (queue.logs.length < queue.maxBatchSize * 2) {
        queue.logs.unshift(...logsToFlush);
      }
    }
  } catch (error) {
    console.error('[Enrichment Logger] Flush error:', error instanceof Error ? error.message : error);
    // Re-queue on error
    if (queue.logs.length < queue.maxBatchSize * 2) {
      queue.logs.unshift(...logsToFlush);
    }
  }
}

/**
 * Force flush all pending logs (for shutdown)
 */
export async function forceFlushLogs(env: Env): Promise<void> {
  const queue = initializeLogQueue();
  if (queue.logs.length > 0) {
    await flushLogs(queue, env);
  }
}

/**
 * Create enrichment log from JWT enrichment result
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
    environment: typeof self !== 'undefined' ? (self as any).ENVIRONMENT || 'unknown' : 'unknown',
    requestId,
    userAgent,
    ipHash: ip ? hashIpSync(ip) : undefined,
  };
}

/**
 * Synchronous IP hash (simplified version for sync context)
 */
function hashIpSync(ip: string): string {
  // Simple hash for sync context (less secure but non-blocking)
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Get pending log count for monitoring
 */
export function getPendingLogCount(): number {
  const queue = initializeLogQueue();
  return queue.logs.length;
}
