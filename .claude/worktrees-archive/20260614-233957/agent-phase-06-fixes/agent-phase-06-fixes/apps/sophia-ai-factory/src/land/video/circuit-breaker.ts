/**
 * Re-export from canonical seed location.
 * Kept for backwards compatibility with existing imports.
 */
export {
  type BreakerState,
  type BreakerConfig,
  getBreakerState,
  resetBreaker,
  withBreaker,
  BreakerOpenError,
} from '@/seed/utils/circuit-breaker';
