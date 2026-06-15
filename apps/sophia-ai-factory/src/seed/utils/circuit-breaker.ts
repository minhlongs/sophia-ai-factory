/**
 * Lightweight circuit breaker for upstream service calls.
 *
 * Three states: CLOSED (normal) → OPEN (fail-fast) → HALF_OPEN (one trial).
 *
 * Why hand-rolled and not a dep: CF Workers value tiny bundles, this fits in
 * 50 LoC, the API is enough for our single fly upstream, and named per-service
 * instances (`getBreaker(name)`) avoid shared global state.
 *
 * @module seed/utils/circuit-breaker
 */

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerConfig {
  /** consecutive failures before opening */
  failureThreshold: number;
  /** ms the breaker stays OPEN before allowing a single HALF_OPEN trial */
  resetTimeoutMs: number;
}

interface BreakerInstance {
  state: BreakerState;
  failures: number;
  openedAt: number;
  config: BreakerConfig;
}

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
};

const breakers = new Map<string, BreakerInstance>();

function getOrCreate(name: string, config?: Partial<BreakerConfig>): BreakerInstance {
  let b = breakers.get(name);
  if (!b) {
    b = {
      state: 'closed',
      failures: 0,
      openedAt: 0,
      config: { ...DEFAULT_CONFIG, ...config },
    };
    breakers.set(name, b);
  } else if (config) {
    b.config = { ...b.config, ...config };
  }
  return b;
}

/** Named breaker for agent fleet spawner */
export const FLEET_BREAKER = 'agent-fleet-spawner';

/** Get breaker state — returns just the state string */
export function getBreakerState(name: string): BreakerState {
  const b = getOrCreate(name);
  return b.state;
}

/** Get breaker detailed state (for monitoring/debugging) */
export function getBreakerDetails(name: string): { failures: number; state: BreakerState; openedAt: number } {
  const b = getOrCreate(name);
  return { failures: b.failures, state: b.state, openedAt: b.openedAt };
}

/** Reset a breaker (used by tests + manual ops) */
export function resetBreaker(name: string): void {
  breakers.delete(name);
}

/**
 * Run `fn` through the named breaker. When OPEN, fail fast without invoking fn.
 * When HALF_OPEN, allow exactly one probe; success → CLOSED, failure → OPEN.
 */
export async function withBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: Partial<BreakerConfig>,
): Promise<T> {
  const b = getOrCreate(name, config);

  if (b.state === 'open') {
    // After resetTimeout, transition OPEN → HALF_OPEN to trial one call.
    if (Date.now() - b.openedAt >= b.config.resetTimeoutMs) {
      b.state = 'half_open';
    } else {
      throw new BreakerOpenError(name);
    }
  }

  try {
    const result = await fn();
    // Success: close the breaker, reset counters.
    if (b.state === 'half_open' || b.failures > 0) {
      b.state = 'closed';
      b.failures = 0;
    }
    return result;
  } catch (err) {
    b.failures += 1;
    if (b.state === 'half_open' || b.failures >= b.config.failureThreshold) {
      b.state = 'open';
      b.openedAt = Date.now();
    }
    throw err;
  }
}

/** Thrown when a breaker is OPEN. Callers can map to 503/queue-retry. */
export class BreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — upstream service likely degraded`);
    this.name = 'BreakerOpenError';
  }
}
