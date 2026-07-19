/**
 * @module seed/ai/provider-health
 *
 * In-memory health tracker for AI providers.
 *
 * Uses a plain `Map` because Cloudflare Workers have no persistent
 * local storage.  State is rebuilt from scratch on each cold start;
 * the registry re-populates health from the provider's runtime
 * behaviour.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ProviderHealth, ProviderId } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Consecutive failures before a provider is marked unhealthy. */
const FAILURE_THRESHOLD = 3;

/** Cooldown duration after exceeding the failure threshold (ms). */
const COOLDOWN_MS = 30_000; // 30 seconds

/** Maximum samples kept for rolling average latency. */
const LATENCY_WINDOW_SIZE = 20;

// ── Tracker ───────────────────────────────────────────────────────────────────

/**
 * Per-provider health state machine.
 *
 * State transitions:
 *
 *   healthy ──(consecutiveFailures >= FAILURE_THRESHOLD)──► cooldown
 *   cooldown ──(cooldown expires)──────────────────────────► healthy
 *   cooldown ──(success during cooldown)───────────────────► healthy
 *
 * All transitions are logged at `warn` or `error` level.
 */
export class ProviderHealthTracker {
  private readonly id: ProviderId;
  private state: ProviderHealth;

  constructor(id: ProviderId) {
    this.id = id;
    // Epoch 0 means "never observed" — the provider starts healthy
    // until the first failure pushes it over the threshold.
    this.state = {
      healthy: true,
      inCooldown: false,
      avgLatencyMs: 0,
      lastSuccess: 0,
      lastFailure: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
    };
  }

  // ── Recording ───────────────────────────────────────────────────────────────

  /**
   * Record a successful request.
   *
   * Resets consecutive failure count, updates rolling average
   * latency, and clears cooldown if the provider was in one.
   *
   * @param latencyMs — Round-trip latency in milliseconds.
   */
  recordSuccess(latencyMs: number): void {
    const wasInCooldown = this.state.inCooldown;

    this.state.totalRequests++;
    this.state.totalSuccesses++;
    this.state.consecutiveFailures = 0;
    this.state.lastSuccess = Date.now();
    this.state.inCooldown = false;
    delete this.state.cooldownUntil;

    // Update rolling average latency.
    this.state.avgLatencyMs = this.computeAvgLatency(latencyMs);

    if (wasInCooldown) {
      logger.info('[ProviderHealth] Provider recovered from cooldown', undefined, {
        providerId: this.id,
        latencyMs,
      });
    }
  }

  /**
   * Record a failed request.
   *
   * Increments consecutive failure count.  When the count reaches
   * `FAILURE_THRESHOLD` the provider enters cooldown.
   *
   * @param error — Error that caused the failure (used for logging).
   */
  recordFailure(error: Error): void {
    this.state.totalRequests++;
    this.state.totalFailures++;
    this.state.consecutiveFailures++;
    this.state.lastFailure = Date.now();

    if (this.state.consecutiveFailures >= FAILURE_THRESHOLD && !this.state.inCooldown) {
      this.enterCooldown();
    }

    logger.warn('[ProviderHealth] Request failed', error instanceof Error ? error : undefined, {
      providerId: this.id,
      consecutiveFailures: this.state.consecutiveFailures,
      totalFailures: this.state.totalFailures,
    });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Return the current health snapshot.
   *
   * The returned object is a shallow copy — callers can read it
   * freely without affecting internal state.
   */
  getHealth(): ProviderHealth {
    // Re-evaluate cooldown expiry on every read so callers always
    // see an up-to-date `inCooldown` flag without polling.
    if (this.state.inCooldown && this.state.cooldownUntil !== undefined) {
      if (Date.now() >= this.state.cooldownUntil) {
        // Cooldown expired — reset to healthy.
        this.state.inCooldown = false;
        delete this.state.cooldownUntil;
        this.state.consecutiveFailures = 0;
        logger.info('[ProviderHealth] Cooldown expired — provider restored', undefined, {
          providerId: this.id,
        });
      }
    }

    return { ...this.state };
  }

  /**
   * Whether the provider is currently healthy (not in cooldown and
   * consecutive failures below threshold).
   */
  isHealthy(): boolean {
    return this.getHealth().healthy;
  }

  /**
   * Whether the provider is currently in a failure cooldown.
   */
  isInCooldown(): boolean {
    return this.getHealth().inCooldown;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private enterCooldown(): void {
    this.state.inCooldown = true;
    this.state.cooldownUntil = Date.now() + COOLDOWN_MS;
    this.state.healthy = false;

    logger.warn('[ProviderHealth] Provider entered cooldown', undefined, {
      providerId: this.id,
      cooldownMs: COOLDOWN_MS,
      consecutiveFailures: this.state.consecutiveFailures,
    });
  }

  private latencySamples: number[] = [];

  private computeAvgLatency(newSample: number): number {
    this.latencySamples.push(newSample);
    if (this.latencySamples.length > LATENCY_WINDOW_SIZE) {
      this.latencySamples.shift();
    }
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencySamples.length);
  }
}
