/**
 * @module seed/ai/registry/types
 * Type definitions for AI Provider Registry.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { Provider, ProviderId, ProviderHealth } from '../provider-interface';
import type { ProviderHealthTracker } from '../provider-health';

export interface RegistryEntry {
  provider: Provider;
  health: ProviderHealthTracker;
  capabilities: Map<string, ReturnType<Provider['getCapabilities']>>;
}

export interface HealthyProviderRecord {
  id: ProviderId;
  provider: Provider;
  health: ProviderHealth;
}

export interface RegistryMutex {
  locked: boolean;
  waiters: Array<() => void>;
}
