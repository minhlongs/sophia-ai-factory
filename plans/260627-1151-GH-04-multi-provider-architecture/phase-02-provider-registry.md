# Phase 4.2 — Provider Registry

**Status:** Design  
**Layer:** forest/llm (new)

## Context Links

- Phase 4.1: `phase-01-provider-interface.md` (interfaces this registry stores)
- Existing `forest/llm/` directory: empty (cache subdir only) — clean slate
- BYOK key resolution: `tree/credentials/get-provider-key.ts`
- Tier configs: `seed/config/tiers/`

## Requirements

1. Central registry of all registered LLM providers
2. Each provider has: id, capabilities, pricing, health status, cost tier
3. Lookup by id, by capability, by cost tier
4. Thread-safe for Cloudflare Workers single-threaded model
5. Supports dynamic registration (plugins) and deregistration
6. Exposes health snapshot for monitoring

## Architecture

### New Files

```
forest/llm/
├── provider-registry.ts       # Registry class
├── provider-registry.test.ts  # Tests
└── index.ts                   # Updated barrel
```

### Design

```typescript
// forest/llm/provider-registry.ts

import type {
  LLMProvider,
  ProviderId,
  ProviderCapabilities,
  ProviderPricing,
  ProviderHealth,
  ProviderError,
} from '@/seed/types/llm-provider';
import { createLogger } from '@/seed/utils/logger-utility';

export type CostTier = 'free' | 'low' | 'medium' | 'high' | 'premium';

export interface RegisteredProvider {
  provider: LLMProvider;
  health: ProviderHealth;
  costTier: CostTier;
  registeredAt: number; // epoch ms
  enabled: boolean;
}

export interface RegistrySnapshot {
  providers: Array<{
    id: ProviderId;
    capabilities: ProviderCapabilities;
    pricing: ProviderPricing;
    health: ProviderHealth;
    costTier: CostTier;
    enabled: boolean;
  }>;
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  lastUpdated: number;
}

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, RegisteredProvider>();
  private readonly log = createLogger('forest/llm/registry');

  // ── Registration ────────────────────────────────────────────────────

  register(provider: LLMProvider, costTier: CostTier): void {
    if (this.providers.has(provider.id)) {
      this.log.warn(`provider re-registered`, { id: provider.id });
    }
    this.providers.set(provider.id, {
      provider,
      health: {
        status: 'healthy',
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
        avgLatencyMs: null,
      },
      costTier,
      registeredAt: Date.now(),
      enabled: true,
    });
    this.log.info(`provider registered`, {
      id: provider.id,
      capabilities: provider.capabilities,
      pricing: provider.pricing,
      costTier,
    });
  }

  deregister(providerId: ProviderId): boolean {
    const existed = this.providers.delete(providerId);
    if (existed) {
      this.log.info(`provider deregistered`, { id: providerId });
    }
    return existed;
  }

  setEnabled(providerId: ProviderId, enabled: boolean): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      entry.enabled = enabled;
      this.log.info(`provider ${enabled ? 'enabled' : 'disabled'}`, { id: providerId });
    }
  }

  // ── Lookup ──────────────────────────────────────────────────────────

  get(providerId: ProviderId): LLMProvider | undefined {
    const entry = this.providers.get(providerId);
    return entry?.enabled ? entry.provider : undefined;
  }

  getEntry(providerId: ProviderId): RegisteredProvider | undefined {
    return this.providers.get(providerId);
  }

  getAll(): RegisteredProvider[] {
    return Array.from(this.providers.values()).filter((e) => e.enabled);
  }

  getHealthy(): RegisteredProvider[] {
    return this.getAll().filter((e) => e.health.status === 'healthy');
  }

  /** Find providers that support all required capabilities */
  findByCapabilities(required: Partial<ProviderCapabilities>): RegisteredProvider[] {
    return this.getAll().filter((entry) => {
      const caps = entry.provider.capabilities;
      return Object.entries(required).every(([key, needed]) => {
        if (!needed) return true;
        return caps[key as keyof ProviderCapabilities] === true;
      });
    });
  }

  /** Find providers within a cost tier or cheaper */
  findByCostTier(maxTier: CostTier): RegisteredProvider[] {
    const tierOrder: CostTier[] = ['free', 'low', 'medium', 'high', 'premium'];
    const maxIdx = tierOrder.indexOf(maxTier);
    return this.getAll().filter((entry) => tierOrder.indexOf(entry.costTier) <= maxIdx);
  }

  // ── Health Updates ──────────────────────────────────────────────────

  recordSuccess(providerId: ProviderId, latencyMs: number): void {
    const entry = this.providers.get(providerId);
    if (!entry) return;
    entry.health.lastSuccess = Date.now();
    entry.health.consecutiveFailures = 0;
    // Rolling average latency
    const prev = entry.health.avgLatencyMs;
    entry.health.avgLatencyMs = prev === null ? latencyMs : prev * 0.8 + latencyMs * 0.2;
    if (entry.health.status === 'degraded' || entry.health.status === 'down') {
      entry.health.status = 'healthy';
      this.log.info(`provider recovered`, { id: providerId });
    }
  }

  recordFailure(providerId: ProviderId, error: ProviderError): void {
    const entry = this.providers.get(providerId);
    if (!entry) return;
    entry.health.lastFailure = Date.now();
    entry.health.consecutiveFailures += 1;
    if (entry.health.consecutiveFailures >= 3) {
      entry.health.status = 'down';
      this.log.error(`provider marked down`, {
        id: providerId,
        consecutiveFailures: entry.health.consecutiveFailures,
        code: error.code,
      });
    } else if (entry.health.status === 'healthy') {
      entry.health.status = 'degraded';
      this.log.warn(`provider degraded`, {
        id: providerId,
        consecutiveFailures: entry.health.consecutiveFailures,
        code: error.code,
      });
    }
  }

  // ── Snapshot ────────────────────────────────────────────────────────

  snapshot(): RegistrySnapshot {
    const all = this.getAll();
    return {
      providers: all.map((e) => ({
        id: e.provider.id,
        capabilities: e.provider.capabilities,
        pricing: e.provider.pricing,
        health: e.health,
        costTier: e.costTier,
        enabled: e.enabled,
      })),
      healthyCount: all.filter((e) => e.health.status === 'healthy').length,
      degradedCount: all.filter((e) => e.health.status === 'degraded').length,
      downCount: all.filter((e) => e.health.status === 'down').length,
      lastUpdated: Date.now(),
    };
  }
}
```

## Cost Tier Mapping

```typescript
// forest/llm/cost-tier.ts

import type { CostTier } from './provider-registry';

/** Map provider id → cost tier. Extended as new providers are added. */
export const PROVIDER_COST_TIERS: Record<string, CostTier> = {
  // Free / self-hosted
  'qwen-local': 'free',
  'ollama': 'free',
  // Low cost (< $0.50/1K output)
  'deepseek': 'low',
  'groq': 'low',
  // Medium cost
  'openrouter': 'medium',
  'google': 'medium',
  // High cost
  'anthropic': 'high',
  'openai': 'high',
  // Premium
  'openai-o1': 'premium',
};
```

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/provider-registry.ts` | Registry class with registration, lookup, health tracking |
| `forest/llm/cost-tier.ts` | Provider → cost tier mapping |
| `forest/llm/provider-registry.test.ts` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `forest/llm/index.ts` | Create barrel export (new file) |

## Tests

- Register/deregister providers
- `getHealthy` filters correctly after failures
- `findByCapabilities` matches required features
- `findByCostTier` respects tier ordering
- `recordSuccess` resets consecutive failures
- `recordFailure` escalates healthy → degraded → down at threshold 3
