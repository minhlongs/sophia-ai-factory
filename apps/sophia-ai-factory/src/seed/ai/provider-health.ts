/**
 * @module seed/ai/provider-health
 *
 * In-memory health tracker for AI providers.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ProviderHealth, ProviderId } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import {
  FAILURE_THRESHOLD,
  COOLDOWN_MS,
  createInitialProviderHealthState,
  computeRollingLatency,
} from './provider-health-constants';

export class ProviderHealthTracker {
  private readonly id: ProviderId;
  private state: ProviderHealth;
  private latencySamples: number[] = [];

  constructor(id: ProviderId) {
    this.id = id;
    this.state = createInitialProviderHealthState();
  }

  recordSuccess(latencyMs: number): void {
    const wasInCooldown = this.state.inCooldown;

    this.state.totalRequests++;
    this.state.totalSuccesses++;
    this.state.consecutiveFailures = 0;
    this.state.lastSuccess = Date.now();
    this.state.inCooldown = false;
    delete this.state.cooldownUntil;

    this.state.avgLatencyMs = computeRollingLatency(this.latencySamples, latencyMs);

    if (wasInCooldown) {
      logger.info('[ProviderHealth] Provider recovered from cooldown', undefined, {
        providerId: this.id,
        latencyMs,
      });
    }
  }

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

  getHealth(): ProviderHealth {
    if (this.state.inCooldown && this.state.cooldownUntil !== undefined) {
      if (Date.now() >= this.state.cooldownUntil) {
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

  isHealthy(): boolean {
    return this.getHealth().healthy;
  }

  isInCooldown(): boolean {
    return this.getHealth().inCooldown;
  }

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
}
