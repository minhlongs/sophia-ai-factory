/**
 * @module seed/ai/provider-registry
 *
 * Thread-safe provider registry for Cloudflare Workers edge runtime.
 *
 * Uses an in-memory Map (no persistent storage — CF Workers have no
 * local filesystem).  Registration is synchronous; health queries are
 * lock-free reads.  Concurrent writes (register / updateHealth) are
 * serialised through a simple mutex so the registry never enters a
 * torn state during edge handler execution.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { Provider, ProviderId, ProviderHealth, ChatMessage, ChatOptions } from './provider-interface';
import { ProviderHealthTracker } from './provider-health';
import { estimateCost } from './cost-estimator';
import { logger } from '@/seed/utils/logger-utility';

// ── Registry entry ────────────────────────────────────────────────────────────

interface RegistryEntry {
  provider: Provider;
  health: ProviderHealthTracker;
  capabilities: Map<string, ReturnType<Provider['getCapabilities']>>;
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Central registry for AI providers.
 *
 * Usage:
 *   const registry = new ProviderRegistry();
 *   registry.register(openRouterProvider);
 *   const healthy = registry.getHealthy();
 *   const fallback = registry.getFallbackChain('openrouter', 'anthropic');
 */
export class ProviderRegistry {
  private readonly entries = new Map<ProviderId, RegistryEntry>();
  private readonly mutex = { locked: false, waiters: [] as Array<() => void> };
  private readonly fallbackOrder: ProviderId[];

  /**
   * @param fallbackOrder — Preferred provider order for automatic
   *   fallback.  First healthy provider wins.  Defaults to
   *   `['openrouter', 'anthropic', 'elevenlabs']`.
   */
  constructor(fallbackOrder: ProviderId[] = ['openrouter', 'anthropic', 'elevenlabs']) {
    this.fallbackOrder = fallbackOrder;
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a provider with the registry.
   *
   * If a provider with the same id is already registered it is
   * replaced (the old provider's health state is discarded).
   *
   * Thread-safe: serialised through the internal mutex.
   *
   * @param provider — Provider implementation to register.
   */
  register(provider: Provider): void {
    this.acquire();
    try {
      const existing = this.entries.get(provider.id);
      // Preserve health across re-registrations so transient blips
      // don't permanently blacklist a provider across deploys.
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
      this.release();
    }
  }

  /**
   * Unregister a provider by id.
   *
   * No-op if the provider is not currently registered.
   *
   * @param id — Provider identifier to remove.
   */
  unregister(id: ProviderId): void {
    this.acquire();
    try {
      const removed = this.entries.delete(id);
      if (removed) {
        logger.info('[ProviderRegistry] Unregistered provider', undefined, { providerId: id });
      }
    } finally {
      this.release();
    }
  }

  // ── Lookup ──────────────────────────────────────────────────────────────────

  /**
   * Get a provider by id, regardless of health state.
   *
   * Returns `undefined` if the provider is not registered.
   *
   * @param id — Provider identifier.
   */
  get(id: ProviderId): Provider | undefined {
    return this.entries.get(id)?.provider;
  }

  /**
   * Get the health tracker for a provider.
   *
   * Returns `undefined` if the provider is not registered.
   *
   * @param id — Provider identifier.
   */
  getHealth(id: ProviderId): ProviderHealth | undefined {
    return this.entries.get(id)?.health.getHealth();
  }

  /**
   * Get all currently healthy providers, in fallback order.
   *
   * A provider is "healthy" when it has no consecutive failures and
   * is not in cooldown.
   *
   * @returns Array of `{ id, provider, health }` for healthy providers.
   */
  getHealthy(): Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> {
    const result: Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> = [];

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

  /**
   * Get the first healthy provider from the fallback chain.
   *
   * Returns `undefined` if no providers are healthy.
   */
  getFirstHealthy(): { id: ProviderId; provider: Provider; health: ProviderHealth } | undefined {
    return this.getHealthy()[0];
  }

  /**
   * Build a fallback chain for a preferred provider.
   *
   * Returns an ordered list starting with the preferred provider (if
   * healthy), followed by the remaining fallback-order providers that
   * are healthy.  Providers not in the fallback order are excluded.
   *
   * @param preferred — Provider to try first.
   * @param alternates — Additional provider ids to include after the
   *   fallback-order list (useful for tenant-specific overrides).
   * @returns Ordered array of `{ id, provider, health }`.
   */
  getFallbackChain(
    preferred: ProviderId,
    alternates: ProviderId[] = [],
  ): Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> {
    const chain: Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> = [];

    // 1. Preferred provider first (if registered and healthy).
    const preferredEntry = this.entries.get(preferred);
    if (preferredEntry) {
      const health = preferredEntry.health.getHealth();
      if (health.healthy) {
        chain.push({ id: preferred, provider: preferredEntry.provider, health });
      }
    }

    // 2. Global fallback order (skip preferred — already handled).
    for (const id of this.fallbackOrder) {
      if (id === preferred) continue;
      const entry = this.entries.get(id);
      if (!entry) continue;
      const health = entry.health.getHealth();
      if (health.healthy) {
        chain.push({ id, provider: entry.provider, health });
      }
    }

    // 3. Tenant-specific alternates (not in fallback order).
    for (const id of alternates) {
      if (this.fallbackOrder.includes(id)) continue; // already handled
      const entry = this.entries.get(id);
      if (!entry) continue;
      const health = entry.health.getHealth();
      if (health.healthy) {
        chain.push({ id, provider: entry.provider, health });
      }
    }

    return chain;
  }

  /**
   * Get all registered providers (healthy or not).
   *
   * @returns Array of `{ id, provider, health }`.
   */
  getAll(): Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> {
    const result: Array<{ id: ProviderId; provider: Provider; health: ProviderHealth }> = [];
    for (const [id, entry] of this.entries) {
      result.push({ id, provider: entry.provider, health: entry.health.getHealth() });
    }
    return result;
  }

  // ── Health updates ──────────────────────────────────────────────────────────

  /**
   * Record a successful request for a provider.
   *
   * Updates the provider's health tracker and refreshes cached
   * capabilities if they haven't been resolved yet.
   *
   * @param id — Provider identifier.
   * @param latencyMs — Round-trip latency in milliseconds.
   */
  updateHealth(id: ProviderId, latencyMs: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    entry.health.recordSuccess(latencyMs);
  }

  /**
   * Record a failed request for a provider.
   *
   * @param id — Provider identifier.
   * @param error — Error that caused the failure (for classification).
   */
  recordFailure(id: ProviderId, error: Error): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    entry.health.recordFailure(error);
  }

  // ── Cost estimation ─────────────────────────────────────────────────────────

  /**
   * Estimate the cost of a request through a specific provider.
   *
   * Delegates to the cost estimator with the provider's model.
   *
   * @param id — Provider identifier.
   * @param messages — Messages that will be sent.
   * @param options — Chat options (model overrides the provider default).
   * @returns Estimated cost in USD.
   */
  estimateCost(id: ProviderId, messages: ChatMessage[], options: ChatOptions): number {
    const entry = this.entries.get(id);
    if (!entry) return 0;
    return estimateCost(messages, options.model, options);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private acquire(): void {
    // Simple spinlock — edge handlers are short-lived so contention
    // is negligible.  If we ever see contention in production we can
    // swap to Atomics.waitAsync (CF Workers stable since 2024).
    while (this.mutex.locked) {
      // Busy-wait: edge runtime has no `Atomics.wait` in main thread.
      // Yield to the event loop.
      (globalThis as unknown as { queueMicrotask?: (cb: () => void) => void }).queueMicrotask?.(() => {});
    }
    this.mutex.locked = true;
  }

  private release(): void {
    this.mutex.locked = false;
  }
}
