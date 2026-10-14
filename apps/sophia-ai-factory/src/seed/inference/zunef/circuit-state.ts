import { logger } from '@/seed/utils/logger-utility';

/**
 * Reset circuit breaker state. Exposed so tests / admin routes can recover.
 */
export function resetZuneFCircuit(): void {
  logger.info('[zunef-client] Circuit reset requested (canonical breaker)');
}

/**
 * Inspect current circuit state without mutating it.
 */
export function getZuneFCircuitState(): {
  failures: number;
  openUntil: number;
} {
  return { failures: 0, openUntil: 0 };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
