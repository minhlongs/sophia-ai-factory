/**
 * LRU Cache and Row → Domain Mapper for AI Provider Registry.
 * @module tree/ai-providers/registry-cache
 */

import { getState } from '@/seed/security/circuit-breaker';
import type {
  AIModel,
  AIProvider,
  AIModelType,
  ProviderRow,
  ProviderStatus,
} from './types';

const CACHE_MAX = 50;
const cache = new Map<string, AIProvider>();

export function cacheGet(key: string): AIProvider | undefined {
  return cache.get(key);
}

export function cacheSet(key: string, value: AIProvider): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export function invalidateCache(id?: string): void {
  if (id) {
    cache.delete(id);
  } else {
    cache.clear();
  }
}

export function mapRowToProvider(row: ProviderRow): AIProvider {
  const models = JSON.parse(row.models_json) as AIModel[];
  const providerId = row.id;
  const cbState = getState(providerId);

  return {
    id: providerId,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type as AIModelType,
    models,
    status: row.status as ProviderStatus,
    circuitBreakerState: cbState.state,
  };
}
