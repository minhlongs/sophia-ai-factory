/**
 * Enrichment Log Queue & IP Hashing Utilities
 *
 * Internal queue management and IP privacy helpers for the enrichment logger.
 *
 * @module worker/enrichment-log-queue
 */

import type { EnrichmentLog } from './enrichment-logger-types';
import { logger } from '@/seed/utils/logger-utility';

/** Subset of Cloudflare Worker Env bindings used by the log queue */
interface LogQueueEnv {
  AGENCYOS_NOTIFICATION_URL: string;
  AGENCYOS_WEBHOOK_SECRET: string;
}

/** Queue for async logging */
export interface LogQueue {
  logs: EnrichmentLog[];
  flushIntervalMs: number;
  maxBatchSize: number;
}

/** Logger configuration */
export const LOGGER_CONFIG = {
  flushIntervalMs: 5000,
  maxBatchSize: 100,
  queueEndpoint: '/api/audit/enrichment',
};

/** Global log queue (singleton per worker instance) */
let logQueue: LogQueue | null = null;

/** Initialize the log queue */
export function initializeLogQueue(): LogQueue {
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
 * Flush logs to storage (async, non-blocking).
 */
export async function flushLogs(queue: LogQueue, env: LogQueueEnv): Promise<void> {
  if (queue.logs.length === 0) return;

  const logsToFlush = [...queue.logs];
  queue.logs = [];

  try {
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
      logger.error('[Enrichment Logger] Flush failed', { status: response.status });
      if (queue.logs.length < queue.maxBatchSize * 2) {
        queue.logs.unshift(...logsToFlush);
      }
    }
  } catch (error) {
    logger.error('[Enrichment Logger] Flush error', error instanceof Error ? error : new Error(String(error)));
    if (queue.logs.length < queue.maxBatchSize * 2) {
      queue.logs.unshift(...logsToFlush);
    }
  }
}

/**
 * Hash IP address for privacy (async, one-way SHA-256).
 */
export async function hashIp(ip: string): Promise<string> {
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
 * Synchronous IP hash (simplified, non-blocking).
 */
export function hashIpSync(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
