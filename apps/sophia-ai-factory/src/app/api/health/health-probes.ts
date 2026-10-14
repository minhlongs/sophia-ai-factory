/**
 * Health endpoint component probes (D1, KV, R2, circuit breaker, reality loop).
 * Layer: App Router API Route support.
 */

import type { ComponentStatus, RealityLoopStatus } from './health-types';

export async function getBinding<T>(key: string): Promise<T | null> {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g[key]) return g[key] as T;
    const env = g.__env as Record<string, unknown> | undefined;
    if (env?.[key]) return env[key] as T;
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cf = await getCloudflareContext({ async: true });
    return ((cf?.env as Record<string, unknown> | undefined)?.[key] as T) ?? null;
  } catch {
    return null;
  }
}

export async function checkDatabase(): Promise<ComponentStatus> {
  try {
    const { probeD1 } = await import('@/seed/health/probe-d1');
    const { getD1, createServerClient } = await import('@/seed/db/client');
    let db = (await getBinding<import('@cloudflare/workers-types').D1Database>('DB')) ?? (await getD1());
    if (!db) {
      try {
        const client = createServerClient();
        if (client && typeof client.prepare === 'function') db = client as unknown as import('@cloudflare/workers-types').D1Database;
      } catch { /* ignore */ }
    }
    if (!db) return { status: 'unknown', error: 'D1 binding not available' };
    const res = await probeD1(db);
    return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function probeBinding(type: 'kv' | 'r2'): Promise<ComponentStatus> {
  try {
    if (type === 'kv') {
      const { probeKv } = await import('@/seed/health/probe-kv');
      const kv = (await getBinding<import('@cloudflare/workers-types').KVNamespace>('EXPERIMENT_KV')) ??
        (await getBinding<import('@cloudflare/workers-types').KVNamespace>('KV_KV'));
      if (!kv) return { status: 'unknown', error: 'KV binding not available' };
      const res = await probeKv(kv);
      return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
    }
    const { probeR2 } = await import('@/seed/health/probe-r2');
    const b = (await getBinding<import('@cloudflare/workers-types').R2Bucket>('NEXT_INC_CACHE_R2_BUCKET')) ??
      (await getBinding<import('@cloudflare/workers-types').R2Bucket>('BACKUPS_BUCKET'));
    if (!b) return { status: 'unknown', error: 'R2 binding not available' };
    const res = await probeR2(b);
    return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function checkCircuitBreaker(): Promise<{ status: string; openServices: string[] }> {
  try {
    const { getState } = await import('@/seed/security/circuit-breaker');
    const { CircuitState } = await import('@/seed/types/failure-kind');
    const open = ['heygen-ping', 'openrouter', 'elevenlabs', 'd-id'].filter((s) => {
      try {
        const st = getState(s).state;
        return st === CircuitState.OPEN || st === CircuitState.DEGRADED;
      } catch { return false; }
    });
    return { status: open.length > 0 ? 'degraded' : 'ok', openServices: open };
  } catch {
    return { status: 'unknown', openServices: [] };
  }
}

export async function checkRealityLoop(): Promise<RealityLoopStatus> {
  try {
    const { getEmitterHealth } = await import('@/tree/performance/emitter-health');
    const r = await getEmitterHealth();
    const lagging = r.entries.filter((e) => e.wired && e.lagMs !== null && e.lagMs > 43200000 && !e.stale).map((e) => e.eventType);
    return { status: r.staleEmitterTypes.length > 0 ? 'degraded' : 'ok', wired: r.wired, deferred: r.deferred, totalEventTypes: r.totalEventTypes, lagging, staleEmitterTypes: r.staleEmitterTypes, maxLagMs: r.maxLagMs };
  } catch {
    return { status: 'unknown', wired: 13, deferred: 0, totalEventTypes: 13, lagging: [], staleEmitterTypes: [], maxLagMs: null };
  }
}
