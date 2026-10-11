import { isHeyGenHealthy } from '@/seed/health/heygen-health-check';
import { getCircuitState } from '@/seed/utils/circuit-breaker';
import type { OpsSnapshotResponse } from './types';

export async function fetchHeyGenHealth(): Promise<OpsSnapshotResponse['heygenHealth']> {
  try {
    const healthy = await Promise.race<boolean>([
      isHeyGenHealthy(),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return {
      healthy,
      providerStatus: healthy ? 'ok' : 'down',
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      healthy: false,
      providerStatus: 'unknown',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function fetchCircuitBreakerState(): Promise<OpsSnapshotResponse['circuitBreaker']> {
  const cbStatus = await getCircuitState();
  return {
    state: cbStatus.state,
    openedAt: cbStatus.openedAt,
    recentFailures: cbStatus.recentFailures,
    recentSuccesses: cbStatus.recentSuccesses,
  };
}
