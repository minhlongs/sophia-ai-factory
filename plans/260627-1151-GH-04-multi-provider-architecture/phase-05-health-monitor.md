# Phase 4.5 — Health Monitor

**Status:** Design  
**Layer:** forest/llm (new)

## Context Links

- Phase 4.2: `phase-02-provider-registry.md` (ProviderHealth, ProviderRegistry.recordSuccess/recordFailure)
- Existing circuit breaker pattern: `land/openclaw/llm-router.ts` (CircuitState, isCircuitOpen)
- Existing retry-backoff: `land/fulfillment/retry-backoff.ts`

## Requirements

1. Track provider availability: last success/failure timestamps, latency
2. Automatic health status transitions: healthy → degraded → down → recovering → healthy
3. Periodic health checks (lightweight ping to each provider)
4. Expose health snapshot for monitoring dashboards
5. Cloudflare Workers compatible (no external cron — health check on-demand or in-request)
6. Integrate with ProviderRegistry for automatic status updates

## Architecture

### New Files

```
forest/llm/
├── health-monitor.ts          # HealthMonitor class
├── health-monitor.test.ts     # Tests
└── index.ts                   # Updated barrel
```

### Design

```typescript
// forest/llm/health-monitor.ts

import type {
  ProviderId,
  ProviderHealth,
  ProviderError,
} from '@/seed/types/llm-provider';
import type { ProviderRegistry } from './provider-registry';
import { createLogger } from '@/seed/utils/logger-utility';

export interface HealthCheckResult {
  providerId: ProviderId;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: number;
}

export interface HealthMonitorConfig {
  /** Degrade after N consecutive failures (default: 2) */
  degradeAfterFailures: number;
  /** Mark down after N consecutive failures (default: 4) */
  downAfterFailures: number;
  /** Recover after N consecutive successes (default: 2) */
  recoverAfterSuccesses: number;
  /** Health check timeout in ms (default: 5000) */
  checkTimeoutMs: number;
  /** Minimum interval between health checks per provider (default: 60000) */
  minCheckIntervalMs: number;
}

export class HealthMonitor {
  private readonly log = createLogger('forest/llm/health-monitor');
  private readonly config: Required<HealthMonitorConfig>;
  private readonly lastCheck = new Map<ProviderId, number>();
  private readonly checkPromises = new Map<ProviderId, Promise<HealthCheckResult>>();

  constructor(
    private readonly registry: ProviderRegistry,
    config: HealthMonitorConfig = {},
  ) {
    this.config = {
      degradeAfterFailures: config.degradeAfterFailures ?? 2,
      downAfterFailures: config.downAfterFailures ?? 4,
      recoverAfterSuccesses: config.recoverAfterSuccesses ?? 2,
      checkTimeoutMs: config.checkTimeoutMs ?? 5_000,
      minCheckIntervalMs: config.minCheckIntervalMs ?? 60_000,
    };
  }

  // ── On-demand health check ──────────────────────────────────────────

  /**
   * Run a lightweight health check on a specific provider.
   * Skips if checked within minCheckIntervalMs.
   */
  async checkProvider(providerId: ProviderId): Promise<HealthCheckResult> {
    const now = Date.now();
    const last = this.lastCheck.get(providerId) ?? 0;
    if (now - last < this.config.minCheckIntervalMs) {
      const entry = this.registry.getEntry(providerId);
      return {
        providerId,
        healthy: entry?.health.status !== 'down',
        latencyMs: entry?.health.avgLatencyMs ?? 0,
        checkedAt: last,
      };
    }

    // Deduplicate concurrent checks for same provider
    const existing = this.checkPromises.get(providerId);
    if (existing) return existing;

    const promise = this.doCheck(providerId);
    this.checkPromises.set(providerId, promise);
    try {
      return await promise;
    } finally {
      this.checkPromises.delete(providerId);
    }
  }

  /**
   * Check all registered providers. Returns results in order.
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    const entries = this.registry.getAll();
    const results = await Promise.allSettled(
      entries.map((e) => this.checkProvider(e.provider.id)),
    );
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : {
        providerId: entries[i].provider.id,
        healthy: false,
        latencyMs: 0,
        error: 'check failed',
        checkedAt: Date.now(),
      },
    );
  }

  /**
   * Record a provider error from an actual request (not a probe).
   * Updates registry health based on consecutive failure count.
   */
  recordError(providerId: ProviderId, error: ProviderError): void {
    const entry = this.registry.getEntry(providerId);
    if (!entry) return;

    const consecutive = entry.health.consecutiveFailures + 1;

    if (consecutive >= this.config.downAfterFailures) {
      this.registry.recordFailure(providerId, error);
      this.log.error(`provider down after ${consecutive} failures`, {
        providerId,
        code: error.code,
      });
    } else if (consecutive >= this.config.degradeAfterFailures) {
      this.registry.recordFailure(providerId, error);
      this.log.warn(`provider degraded after ${consecutive} failures`, {
        providerId,
        code: error.code,
      });
    } else {
      // Record but don't change status yet
      this.registry.recordFailure(providerId, error);
    }
  }

  /**
   * Record a provider success from an actual request.
   * Triggers recovery if enough consecutive successes.
   */
  recordSuccess(providerId: ProviderId, latencyMs: number): void {
    const entry = this.registry.getEntry(providerId);
    if (!entry) return;

    const wasDegraded = entry.health.status === 'degraded';
    const wasDown = entry.health.status === 'down';

    this.registry.recordSuccess(providerId, latencyMs);

    if (wasDegraded || wasDown) {
      // Check if recovered (consecutiveFailures reset to 0 by recordSuccess)
      const updated = this.registry.getEntry(providerId);
      if (updated?.health.consecutiveFailures === 0) {
        this.log.info(`provider recovered`, {
          providerId,
          previousStatus: wasDown ? 'down' : 'degraded',
          latencyMs,
        });
      }
    }
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async doCheck(providerId: ProviderId): Promise<HealthCheckResult> {
    const entry = this.registry.getEntry(providerId);
    if (!entry) {
      return { providerId, healthy: false, latencyMs: 0, error: 'not registered', checkedAt: Date.now() };
    }

    const startTime = Date.now();
    try {
      // Use provider's own healthCheck if available, otherwise assume healthy
      const healthy = await entry.provider.healthCheck?.();
      const latencyMs = Date.now() - startTime;
      this.lastCheck.set(providerId, Date.now());

      if (healthy) {
        this.recordSuccess(providerId, latencyMs);
      } else {
        this.recordError(providerId, entry.provider as any); // healthCheck returned false
      }

      return { providerId, healthy: healthy ?? true, latencyMs, checkedAt: Date.now() };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'unknown';
      this.lastCheck.set(providerId, Date.now());

      const providerError = new (await import('@/seed/types/llm-provider')).ProviderError({
        code: 'PROVIDER_DOWN',
        providerId,
        message: `health check failed: ${error}`,
        retryable: true,
        cause: err instanceof Error ? err : undefined,
      });
      this.recordError(providerId, providerError);

      return { providerId, healthy: false, latencyMs, error, checkedAt: Date.now() };
    }
  }
}
```

## Integration with Existing Code

The existing `land/agent-chat/llm-router.ts` `resolveLlmRoute` function will be updated to use the new system:

```typescript
// Before (current):
export async function resolveLlmRoute(userId: string): Promise<LlmRoute> {
  // hardcoded DeepSeek → Anthropic
}

// After (Phase 4.7 backward compat):
export async function resolveLlmRoute(userId: string): Promise<LlmRoute> {
  // Delegates to CostAwareRouter with default chain
  // Returns LlmRoute for backward compatibility
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/health-monitor.ts` | HealthMonitor: on-demand checks, error recording, recovery tracking |
| `forest/llm/health-monitor.test.ts` | Tests |

## Files to Modify

| File | Change |
|------|--------|
| `forest/llm/index.ts` | Add exports |

## Tests

- `checkProvider` skips if within minCheckIntervalMs
- `checkProvider` deduplicates concurrent checks
- `recordError` escalates status at configured thresholds
- `recordSuccess` triggers recovery log when consecutive failures reset
- `checkAll` handles provider-not-found gracefully
