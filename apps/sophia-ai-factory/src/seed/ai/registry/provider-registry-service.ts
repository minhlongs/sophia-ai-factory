/**
 * @module seed/ai/registry/provider-registry-service
 * Thread-safe provider registry implementation for Cloudflare Workers edge runtime.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { Provider, ProviderId, ProviderHealth, ChatMessage, ChatOptions } from '../provider-interface';
import { ProviderHealthTracker } from '../provider-health';
import { logger } from '@/seed/utils/logger-utility';
import type { RegistryEntry, HealthyProviderRecord, RegistryMutex } from './types';
import { DEFAULT_FALLBACK_ORDER, buildFallbackChain } from './provider-definitions';
import { createRegistryMutex, acquireMutex, releaseMutex, estimateEntryCost } from './model-catalog';

/**
 * Central registry for AI providers.
 */
export class ProviderRegistry {
  private readonly entries = new Map<ProviderId, RegistryEntry>();
  private readonly mutex: RegistryMutex = createRegistryMutex();
  private readonly fallbackOrder: ProviderId[];

  constructor(fallbackOrder: ProviderId[] = DEFAULT_FALLBACK_ORDER) {
    this.fallbackOrder = fallbackOrder;
  }

  register(provider: Provider): void {
    acquireMutex(this.mutex);
    try {
      const existing = this.entries.get(provider.id);
      const health = existing?.health ?? new ProviderHealthTracker(provider.id);

      this.entries.set(provider.id, {
        provider,
        health,
        capabilities: new Map(),
      });

      logger.info('[ProviderRegistry] Registered provider', undefined, {
        providerId: provider.id,
        label: provider.label,
      });
    } finally {
      releaseMutex(this.mutex);
    }
  }

  unregister(id: ProviderId): void {
    acquireMutex(this.mutex);
    try {
      const removed = this.entries.delete(id);
      if (removed) {
        logger.info('[ProviderRegistry] Unregistered provider', undefined, { providerId: id });
      }
    } finally {
      releaseMutex(this.mutex);
    }
  }

  get(id: ProviderId): Provider | undefined {
    return this.entries.get(id)?.provider;
  }

  getHealth(id: ProviderId): ProviderHealth | undefined {
    return this.entries.get(id)?.health.getHealth();
  }

  getHealthy(): HealthyProviderRecord[] {
    const result: HealthyProviderRecord[] = [];
    for (const id of this.fallbackOrder) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      const health = entry.health.getHealth();
      if (health.healthy) {
        result.push({ id, provider: entry.provider, health });
      }
    }
    return result;
  }

  getFirstHealthy(): HealthyProviderRecord | undefined {
    return this.getHealthy()[0];
  }

  getFallbackChain(preferred: ProviderId, alternates: ProviderId[] = []): HealthyProviderRecord[] {
    return buildFallbackChain(this.entries, this.fallbackOrder, preferred, alternates);
  }

  getAll(): HealthyProviderRecord[] {
    const result: HealthyProviderRecord[] = [];
    for (const [id, entry] of this.entries) {
      result.push({ id, provider: entry.provider, health: entry.health.getHealth() });
    }
    return result;
  }

  updateHealth(id: ProviderId, latencyMs: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.health.recordSuccess(latencyMs);
  }

  recordFailure(id: ProviderId, error: Error): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.health.recordFailure(error);
  }

  estimateCost(id: ProviderId, messages: ChatMessage[], options: ChatOptions): number {
    const entry = this.entries.get(id);
    return estimateEntryCost(entry, messages, options);
  }
}
