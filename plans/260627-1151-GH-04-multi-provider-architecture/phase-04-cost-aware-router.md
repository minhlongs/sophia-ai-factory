# Phase 4.4 — Cost-Aware Router

**Status:** Design  
**Layer:** forest/llm (new)

## Context Links

- Phase 4.2: `phase-02-provider-registry.md` (ProviderRegistry, CostTier)
- Phase 4.3: `phase-03-fallback-chain.md` (FallbackChain)
- Existing cost tracking: `land/openclaw/llm-cost-tracker.ts`
- Existing tier routing: `land/openclaw/llm-router.ts` (routeLLM, routeWithBudget)

## Requirements

1. Select provider based on: cost per token, provider health, user tier, task complexity
2. Budget-aware: pick cheapest provider that fits within budget
3. Tier-aware: MASTER gets premium providers, BASIC gets cost-optimized
4. Complexity-aware: simple tasks → cheap model, complex → capable model
5. Tenant usage tracking (per-tenant cost accumulation)
6. Backward-compatible with existing `resolveLlmRoute` callers

## Architecture

### New Files

```
forest/llm/
├── cost-aware-router.ts       # Main router class
├── cost-aware-router.test.ts  # Tests
├── task-complexity.ts         # Complexity scoring
├── task-complexity.test.ts    # Tests
├── tenant-usage-tracker.ts    # Per-tenant cost tracking
├── tenant-usage-tracker.test.ts
└── index.ts                   # Updated barrel
```

### Task Complexity Scoring

```typescript
// forest/llm/task-complexity.ts

export type TaskComplexity = 'trivial' | 'simple' | 'medium' | 'complex' | 'expert';

export interface ComplexityFactors {
  messageCount: number;
  avgMessageLength: number;
  hasSystemPrompt: boolean;
  hasVisionInput: boolean;
  hasToolCalls: boolean;
  requestedMaxTokens: number;
}

export function scoreComplexity(factors: ComplexityFactors): TaskComplexity {
  let score = 0;

  // Message volume
  if (factors.messageCount > 20) score += 3;
  else if (factors.messageCount > 10) score += 2;
  else if (factors.messageCount > 5) score += 1;

  // Context length
  const totalChars = factors.messageCount * factors.avgMessageLength;
  if (totalChars > 50_000) score += 3;
  else if (totalChars > 20_000) score += 2;
  else if (totalChars > 5_000) score += 1;

  // Feature flags
  if (factors.hasSystemPrompt) score += 1;
  if (factors.hasVisionInput) score += 2;
  if (factors.hasToolCalls) score += 2;
  if (factors.requestedMaxTokens > 4000) score += 1;

  // Map score to complexity
  if (score <= 2) return 'trivial';
  if (score <= 4) return 'simple';
  if (score <= 7) return 'medium';
  if (score <= 10) return 'complex';
  return 'expert';
}

/** Minimum cost tier required for a complexity level */
export function minCostTierForComplexity(
  complexity: TaskComplexity,
): 'free' | 'low' | 'medium' | 'high' | 'premium' {
  const map: Record<TaskComplexity, 'free' | 'low' | 'medium' | 'high' | 'premium'> = {
    trivial: 'free',
    simple: 'low',
    medium: 'medium',
    complex: 'high',
    expert: 'premium',
  };
  return map[complexity];
}
```

### Cost-Aware Router

```typescript
// forest/llm/cost-aware-router.ts

import type {
  LLMProvider,
  ProviderId,
  ProviderHealth,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  CostEstimate,
  ProviderError,
} from '@/seed/types/llm-provider';
import type { CostTier, RegisteredProvider, ProviderRegistry } from './provider-registry';
import type { FallbackChain, FallbackResult } from './fallback-chain';
import type { TaskComplexity, ComplexityFactors, scoreComplexity } from './task-complexity';
import { createLogger } from '@/seed/utils/logger-utility';

export interface RouterOptions {
  /** Max USD to spend on a single request (0 = unlimited) */
  maxCostPerRequestUsd?: number;
  /** Max USD to spend per tenant per day (0 = unlimited) */
  maxDailyBudgetUsd?: number;
  /** Force a specific provider (bypass routing logic) */
  forceProvider?: ProviderId;
  /** Force a specific cost tier */
  forceCostTier?: CostTier;
}

export interface RouterResult<T> {
  response: T;
  providerId: ProviderId;
  costEstimate: CostEstimate;
  complexity: TaskComplexity;
  fallbackUsed: boolean;
  fallbackChain: FallbackResult<T>['chain'];
}

export class CostAwareRouter {
  private readonly log = createLogger('forest/llm/router');
  private readonly options: Required<RouterOptions>;

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly fallbackChain: FallbackChain,
    options: RouterOptions = {},
  ) {
    this.options = {
      maxCostPerRequestUsd: options.maxCostPerRequestUsd ?? 0,
      maxDailyBudgetUsd: options.maxDailyBudgetUsd ?? 0,
      forceProvider: options.forceProvider ?? '',
      forceCostTier: options.forceCostTier ?? 'medium',
    };
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
    context: { userId?: string; tenantId?: string; userTier?: string } = {},
  ): Promise<RouterResult<ChatResponse>> {
    const complexity = scoreComplexity(this.analyzeFactors(messages, options));
    const minTier = this.resolveTier(complexity, context.userTier);

    this.log.info('routing chat request', {
      userId: context.userId,
      tenantId: context.tenantId,
      userTier: context.userTier,
      complexity,
      minTier,
      messageCount: messages.length,
    });

    // Budget check
    if (this.options.maxDailyBudgetUsd > 0 && context.tenantId) {
      const dailySpend = TenantUsageTracker.getDailySpend(context.tenantId);
      if (dailySpend >= this.options.maxDailyBudgetUsd) {
        throw new Error(`DAILY_BUDGET_EXCEEDED: ${dailySpend.toFixed(4)}/${this.options.maxDailyBudgetUsd}`);
      }
    }

    // Provider selection
    const chain = this.buildChain(minTier, complexity, context);
    const providers = this.buildProviderMap(chain.providerIds);

    // Execute with fallback
    const result = await this.fallbackChain.chat(providers, messages, options);

    if (!result.success || !result.result) {
      throw new Error(`ALL_PROVIDERS_FAILED: ${result.chain.map((c) => c.providerId).join(' → ')}`);
    }

    // Track usage
    if (context.tenantId) {
      TenantUsageTracker.recordChat(context.tenantId, result.result);
    }

    // Estimate cost for the winning provider
    const winner = this.registry.getEntry(result.providerId);
    const costEstimate = winner
      ? winner.provider.estimateCost(messages, result.result.usage.completionTokens)
      : { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0, model: result.providerId };

    return {
      response: result.result,
      providerId: result.providerId,
      costEstimate,
      complexity,
      fallbackUsed: result.chain.length > 1,
      fallbackChain: result.chain,
    };
  }

  async stream(
    messages: ChatMessage[],
    options: ChatOptions = {},
    context: { userId?: string; tenantId?: string; userTier?: string } = {},
  ): Promise<RouterResult<AsyncIterable<StreamChunk>>> {
    const complexity = scoreComplexity(this.analyzeFactors(messages, options));
    const minTier = this.resolveTier(complexity, context.userTier);
    const chain = this.buildChain(minTier, complexity, context);
    const providers = this.buildProviderMap(chain.providerIds);

    const result = await this.fallbackChain.stream(providers, messages, options);

    if (!result.success || !result.result) {
      throw new Error(`ALL_PROVIDERS_FAILED`);
    }

    return {
      response: result.result,
      providerId: result.providerId,
      costEstimate: { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0, model: result.providerId },
      complexity,
      fallbackUsed: result.chain.length > 1,
      fallbackChain: result.chain,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────

  private analyzeFactors(messages: ChatMessage[], options: ChatOptions): ComplexityFactors {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return {
      messageCount: messages.length,
      avgMessageLength: messages.length > 0 ? totalChars / messages.length : 0,
      hasSystemPrompt: messages.some((m) => m.role === 'system'),
      hasVisionInput: false, // detected from message content type (future)
      hasToolCalls: false,   // detected from options (future)
      requestedMaxTokens: options.maxTokens ?? 4096,
    };
  }

  private resolveTier(
    complexity: TaskComplexity,
    userTier?: string,
  ): CostTier {
    // Force override
    if (this.options.forceCostTier) return this.options.forceCostTier;

    // Tier-based minimum
    const tierHierarchy: Record<string, CostTier> = {
      MASTER: 'premium',
      ENTERPRISE: 'high',
      PREMIUM: 'medium',
      BASIC: 'low',
    };

    const tierMin = tierHierarchy[userTier ?? ''] ?? 'medium';
    const complexityMin = minCostTierForComplexity(complexity);

    // Take the higher of the two (more capable)
    const tierOrder: CostTier[] = ['free', 'low', 'medium', 'high', 'premium'];
    return tierOrder[Math.max(tierOrder.indexOf(tierMin), tierOrder.indexOf(complexityMin))];
  }

  private buildChain(minTier: CostTier, _complexity: TaskComplexity, _context: { userId?: string }): FallbackChain {
    // Force specific provider
    if (this.options.forceProvider) {
      return new FallbackChain({ providerIds: [this.options.forceProvider] });
    }

    // Get eligible providers by cost tier and health
    const eligible = this.registry.findByCostTier(minTier).filter((e) => {
      const health = e.health;
      return health.status !== 'down' || e.provider.capabilities.chat;
    });

    // Sort: healthy first, then by cost tier (cheapest first)
    const tierOrder: CostTier[] = ['free', 'low', 'medium', 'high', 'premium'];
    eligible.sort((a, b) => {
      const healthA = a.health.status === 'healthy' ? 0 : a.health.status === 'degraded' ? 1 : 2;
      const healthB = b.health.status === 'healthy' ? 0 : b.health.status === 'degraded' ? 1 : 2;
      if (healthA !== healthB) return healthA - healthB;
      return tierOrder.indexOf(a.costTier) - tierOrder.indexOf(b.costTier);
    });

    const providerIds = eligible.map((e) => e.provider.id);
    if (providerIds.length === 0) {
      throw new Error('NO_HEALTHY_PROVIDERS');
    }

    return new FallbackChain({ providerIds });
  }

  private buildProviderMap(ids: ProviderId[]): Map<ProviderId, LLMProvider> {
    const map = new Map<ProviderId, LLMProvider>();
    for (const id of ids) {
      const provider = this.registry.get(id);
      if (provider) map.set(id, provider);
    }
    return map;
  }
}
```

### Tenant Usage Tracker

```typescript
// forest/llm/tenant-usage-tracker.ts

import { createLogger } from '@/seed/utils/logger-utility';

export interface TenantUsage {
  tenantId: string;
  totalCostUsd: number;
  callCount: number;
  byProvider: Record<string, { calls: number; costUsd: number }>;
  firstCallAt: number;
  lastCallAt: number;
  dailySpend: Record<string, number>; // YYYY-MM-DD → spend
}

const _usageMap = new Map<string, TenantUsage>();
const _log = createLogger('forest/llm/usage-tracker');

export function recordChat(tenantId: string, response: { usage: { completionTokens: number }; model: string }): void {
  const today = new Date().toISOString().slice(0, 10);
  const existing = _usageMap.get(tenantId);

  const entry: TenantUsage = existing
    ? {
        ...existing,
        totalCostUsd: existing.totalCostUsd + estimateTokensCost(response),
        callCount: existing.callCount + 1,
        lastCallAt: Date.now(),
        dailySpend: {
          ...existing.dailySpend,
          [today]: (existing.dailySpend[today] ?? 0) + estimateTokensCost(response),
        },
      }
    : {
        tenantId,
        totalCostUsd: estimateTokensCost(response),
        callCount: 1,
        byProvider: { [response.model]: { calls: 1, costUsd: estimateTokensCost(response) } },
        firstCallAt: Date.now(),
        lastCallAt: Date.now(),
        dailySpend: { [today]: estimateTokensCost(response) },
      };

  _usageMap.set(tenantId, entry);
  _log.debug('usage recorded', { tenantId, model: response.model });
}

export function getUsage(tenantId: string): TenantUsage | null {
  return _usageMap.get(tenantId) ?? null;
}

export function getDailySpend(tenantId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const usage = _usageMap.get(tenantId);
  return usage?.dailySpend[today] ?? 0;
}

function estimateTokensCost(response: { usage: { completionTokens: number }; model: string }): number {
  // Rough: $0.003/1K input + $0.015/1K output (Sonnet baseline)
  // Real pricing comes from provider.pricing; this is a placeholder for tracking
  const outputCost = (response.usage.completionTokens / 1000) * 0.015;
  return outputCost;
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/task-complexity.ts` | Complexity scoring from message features |
| `forest/llm/task-complexity.test.ts` | Tests |
| `forest/llm/tenant-usage-tracker.ts` | Per-tenant cost accumulation |
| `forest/llm/tenant-usage-tracker.test.ts` | Tests |
| `forest/llm/cost-aware-router.ts` | Main router: tier + complexity + budget → provider selection |
| `forest/llm/cost-aware-router.test.ts` | Tests |

## Files to Modify

| File | Change |
|------|--------|
| `forest/llm/index.ts` | Add new exports |

## Tests

- `task-complexity.test.ts`: score each complexity level with varying inputs
- `cost-aware-router.test.ts`: mock registry + fallback chain, verify provider selection per tier
- Budget exceeded throws `DAILY_BUDGET_EXCEEDED`
- `forceProvider` bypasses routing logic
- `tenant-usage-tracker.test.ts`: daily spend resets on new day
