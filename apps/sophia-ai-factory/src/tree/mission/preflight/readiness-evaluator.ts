/**
 * Production-Safe Mission Preflight Checklist: Constants & Subsystem Readiness.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/readiness-evaluator
 */

import { inngest } from '@/seed/inngest/client';
import type { PreflightGateEvaluation } from './types';

/** Maximum allowed cost in cents for a single mission execution ($5.00) */
export const MAX_SINGLE_MISSION_COST_CENTS = 500;

/**
 * Check if storage subsystem is operational.
 */
export function isStorageOperational(storageOverride?: boolean): boolean {
  if (typeof storageOverride === 'boolean') {
    return storageOverride;
  }

  // Cloudflare runtime context check
  try {
    const globalObj = globalThis as unknown as {
      __env__?: { BACKUPS_BUCKET?: unknown; STORAGE_BUCKET?: unknown };
      __env?: { BACKUPS_BUCKET?: unknown; STORAGE_BUCKET?: unknown };
    };

    if (globalObj.__env__?.BACKUPS_BUCKET || globalObj.__env__?.STORAGE_BUCKET) {
      return true;
    }
    if (globalObj.__env?.BACKUPS_BUCKET || globalObj.__env?.STORAGE_BUCKET) {
      return true;
    }

    // In local Node / test environment, environment variables or fallback
    if (
      process.env.R2_ACCOUNT_ID ||
      process.env.STORAGE_BUCKET ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development'
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if Inngest queue subsystem is ready.
 */
export function isQueueOperational(queueOverride?: boolean): boolean {
  if (typeof queueOverride === 'boolean') {
    return queueOverride;
  }

  try {
    return Boolean(inngest && typeof inngest.send === 'function');
  } catch {
    return false;
  }
}

export function evaluateStorageGate(storageOverride?: boolean): PreflightGateEvaluation {
  const storageOk = isStorageOperational(storageOverride);
  if (!storageOk) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'STORAGE_UNAVAILABLE',
        message: 'Storage subsystem is not available or disconnected',
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'STORAGE_OK',
      message: 'Storage subsystem is available',
    },
  };
}

export function evaluateQueueGate(queueOverride?: boolean): PreflightGateEvaluation {
  const queueOk = isQueueOperational(queueOverride);
  if (!queueOk) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'QUEUE_UNAVAILABLE',
        message: 'Inngest queue subsystem is not reachable or unconfigured',
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'QUEUE_OK',
      message: 'Inngest queue subsystem is verified',
    },
  };
}
