/**
 * Autonomy Repository Logging & Error Helpers
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/autonomy/repo/execution-logger
 */

import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_OVERRIDES, type AutonomyRepoError } from './types';

export function parseOverrides(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return { ...DEFAULT_OVERRIDES };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { ...DEFAULT_OVERRIDES };
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
}

export function toErrorCode(err: unknown): { code: AutonomyRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  return { code: 'DB_ERROR', message };
}

export function logRepoError(method: string, message: string, meta: Record<string, unknown>): void {
  logger.error(`[AutonomyRepo] ${method} failed`, { error: message, ...meta });
}

export function logRepoWarn(method: string, meta: Record<string, unknown>): void {
  logger.warn(`[AutonomyRepo] ${method}`, meta);
}
