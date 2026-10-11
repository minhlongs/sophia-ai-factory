/**
 * @module seed/ai/registry/provider-definitions
 * Fallback chains and default provider configurations.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ProviderId } from '../provider-interface';
import { isCertificationBlocking, getCertification } from '@/seed/ai/provider-certification';
import { logger } from '@/seed/utils/logger-utility';
import type { RegistryEntry, HealthyProviderRecord } from './types';

export const DEFAULT_FALLBACK_ORDER: ProviderId[] = ['openrouter', 'anthropic', 'elevenlabs'];

/**
 * Resolves a healthy, certified fallback chain starting with the preferred provider.
 */
export function buildFallbackChain(
  entries: Map<ProviderId, RegistryEntry>,
  fallbackOrder: ProviderId[],
  preferred: ProviderId,
  alternates: ProviderId[] = [],
): HealthyProviderRecord[] {
  const chain: HealthyProviderRecord[] = [];

  // 1. Preferred provider first (if registered, healthy, and certified).
  const preferredEntry = entries.get(preferred);
  if (preferredEntry) {
    const health = preferredEntry.health.getHealth();
    if (health.healthy && isCertificationBlocking(preferred)) {
      logger.warn('[ProviderRegistry] Preferred provider blocked by certification — excluded from chain', undefined, {
        providerId: preferred,
        certState: getCertification(preferred).state,
      });
    } else if (health.healthy) {
      chain.push({ id: preferred, provider: preferredEntry.provider, health });
    }
  }

  // 2. Global fallback order (skip preferred — already handled).
  for (const id of fallbackOrder) {
    if (id === preferred) continue;
    const entry = entries.get(id);
    if (!entry) continue;
    const health = entry.health.getHealth();
    if (health.healthy && isCertificationBlocking(id)) {
      logger.warn('[ProviderRegistry] Provider blocked by certification — excluded from chain', undefined, {
        providerId: id,
        certState: getCertification(id).state,
      });
    } else if (health.healthy) {
      chain.push({ id, provider: entry.provider, health });
    }
  }

  // 3. Tenant-specific alternates (not in fallback order).
  for (const id of alternates) {
    if (fallbackOrder.includes(id)) continue; // already handled
    const entry = entries.get(id);
    if (!entry) continue;
    const health = entry.health.getHealth();
    if (health.healthy && isCertificationBlocking(id)) {
      logger.warn('[ProviderRegistry] Alternate provider blocked by certification — excluded from chain', undefined, {
        providerId: id,
        certState: getCertification(id).state,
      });
    } else if (health.healthy) {
      chain.push({ id, provider: entry.provider, health });
    }
  }

  return chain;
}
