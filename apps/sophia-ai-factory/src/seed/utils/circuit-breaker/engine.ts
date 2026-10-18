/**
 * Circuit Breaker Core State Machine & Dispatch Logic
 * Layer: seed/utils/circuit-breaker
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  type CircuitStatus,
  type DispatchDecision,
  FAILURE_RATE_THRESHOLD,
  HALF_OPEN_TIMEOUT_MS,
  type KvCircuitData,
  KV_LOG_KEY,
  KV_STATE_KEY,
  KV_TTL_SECONDS,
  MAX_LOG_ENTRIES,
  MIN_ATTEMPTS_TO_OPEN,
  WINDOW_MS,
} from './types';
import { filterWindow, getKv, readLog, readState } from './kv-storage';

export async function recordHeyGenAttempt(
  success: boolean,
  onCircuitOpen?: (context: Record<string, unknown>) => void,
): Promise<void> {
  const kv = await getKv();
  if (!kv) return;

  const [log, state] = await Promise.all([readLog(kv), readState(kv)]);
  const updated = [...log, { ts: Date.now(), ok: success }].slice(-MAX_LOG_ENTRIES);
  await kv.put(KV_LOG_KEY, JSON.stringify(updated), { expirationTtl: KV_TTL_SECONDS });

  if (state.openedAt !== undefined && state.halfOpenProbeAllowed === false) {
    if (success) {
      await kv.delete(KV_STATE_KEY);
      logger.info('[CircuitBreaker] Half-open probe succeeded — circuit closed');
    } else {
      await kv.put(KV_STATE_KEY, JSON.stringify({ openedAt: Date.now() } satisfies KvCircuitData), {
        expirationTtl: KV_TTL_SECONDS,
      });
      logger.warn('[CircuitBreaker] Half-open probe failed — circuit re-opened');
    }
    return;
  }

  if (state.openedAt === undefined) {
    const recent = filterWindow(updated);
    if (recent.length >= MIN_ATTEMPTS_TO_OPEN) {
      const failures = recent.filter((e) => !e.ok).length;
      const rate = failures / recent.length;
      if (rate > FAILURE_RATE_THRESHOLD) {
        const newState: KvCircuitData = { openedAt: Date.now() };
        await kv.put(KV_STATE_KEY, JSON.stringify(newState), { expirationTtl: KV_TTL_SECONDS });
        logger.error('[CircuitBreaker] Circuit OPENED — HeyGen failure rate exceeded threshold', undefined, {
          failures,
          total: recent.length,
          rate: rate.toFixed(2),
        });
        onCircuitOpen?.({ failures, total: recent.length, windowMinutes: WINDOW_MS / 60000 });
      }
    }
  }
}

export async function getCircuitState(): Promise<CircuitStatus> {
  const kv = await getKv();
  if (!kv) return { state: 'closed', recentFailures: 0, recentSuccesses: 0 };

  const [log, state] = await Promise.all([readLog(kv), readState(kv)]);
  const recent = filterWindow(log);
  const recentFailures = recent.filter((e) => !e.ok).length;
  const recentSuccesses = recent.filter((e) => e.ok).length;

  if (state.openedAt === undefined) {
    return { state: 'closed', recentFailures, recentSuccesses };
  }

  if (Date.now() - state.openedAt >= HALF_OPEN_TIMEOUT_MS) {
    if (state.halfOpenProbeAllowed === undefined) {
      const next: KvCircuitData = { openedAt: state.openedAt, halfOpenProbeAllowed: true };
      await kv.put(KV_STATE_KEY, JSON.stringify(next), { expirationTtl: KV_TTL_SECONDS });
    }
    return { state: 'half-open', openedAt: state.openedAt, recentFailures, recentSuccesses };
  }

  return { state: 'open', openedAt: state.openedAt, recentFailures, recentSuccesses };
}

export async function shouldDispatch(): Promise<DispatchDecision> {
  const kv = await getKv();
  if (!kv) return { allowed: true };

  const status = await getCircuitState();
  if (status.state === 'closed') return { allowed: true };

  if (status.state === 'half-open') {
    const state = await readState(kv);
    if (state.halfOpenProbeAllowed) {
      const consumed: KvCircuitData = { openedAt: state.openedAt, halfOpenProbeAllowed: false };
      await kv.put(KV_STATE_KEY, JSON.stringify(consumed), { expirationTtl: KV_TTL_SECONDS });
      return { allowed: true, reason: 'half_open_probe' };
    }
    return { allowed: false, reason: 'half_open_probe_pending' };
  }

  return { allowed: false, reason: `circuit_open since ${new Date(status.openedAt!).toISOString()}` };
}

export async function resetCircuit(): Promise<CircuitStatus> {
  const kv = await getKv();
  if (kv) {
    await Promise.all([kv.delete(KV_STATE_KEY), kv.delete(KV_LOG_KEY)]);
    logger.info('[CircuitBreaker] Circuit manually reset by admin');
  }
  return { state: 'closed', recentFailures: 0, recentSuccesses: 0 };
}
