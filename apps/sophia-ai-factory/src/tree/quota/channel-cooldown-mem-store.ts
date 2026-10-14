/**
 * In-memory cooldown store and D1 binding helper for tree channel cooldown enforcement.
 * @module tree/quota/channel-cooldown-mem-store
 */

import {
  BURST_LIMIT_PER_HOUR,
  BURST_WINDOW_SECONDS,
} from '@/seed/config/channel-cooldown-rules';

export type CooldownViolationReason = 'cooldown' | 'burst';

export interface CooldownCheckResult {
  allowed: boolean;
  deferUntil?: number;
  reason?: CooldownViolationReason;
  deferSeconds?: number;
}

export async function tryGetRawDb(): Promise<D1Database | null> {
  try {
    const { getD1 } = await import('@/seed/db/client');
    return await getD1();
  } catch {
    return null;
  }
}

interface MemRecord {
  finishedAt: number;
}

const memStore = new Map<string, MemRecord[]>();

function memKey(tenantId: string, channelId: string): string {
  return `${tenantId}:${channelId}`;
}

export function checkCooldownInMemory(
  tenantId: string,
  channelId: string,
  cooldownSecs: number,
  burstWindow: number,
  nowSeconds: number,
): CooldownCheckResult {
  const key = memKey(tenantId, channelId);
  const records = memStore.get(key) ?? [];
  const recent = records.filter((r) => r.finishedAt >= burstWindow);

  if (recent.length >= BURST_LIMIT_PER_HOUR) {
    const deferUntil = nowSeconds + Math.ceil(BURST_WINDOW_SECONDS / BURST_LIMIT_PER_HOUR);
    return { allowed: false, deferUntil, reason: 'burst', deferSeconds: deferUntil - nowSeconds };
  }

  const lastAt = records.length > 0 ? Math.max(...records.map((r) => r.finishedAt)) : null;
  if (lastAt !== null && nowSeconds - lastAt < cooldownSecs) {
    const deferUntil = lastAt + cooldownSecs;
    return { allowed: false, deferUntil, reason: 'cooldown', deferSeconds: deferUntil - nowSeconds };
  }

  return { allowed: true };
}

export function recordPostInMemory(
  tenantId: string,
  channelId: string,
  publishedAt: number = Math.floor(Date.now() / 1000),
): void {
  const key = memKey(tenantId, channelId);
  const records = memStore.get(key) ?? [];
  records.push({ finishedAt: publishedAt });
  const cutoff = publishedAt - 86400;
  memStore.set(key, records.filter((r) => r.finishedAt >= cutoff));
}

export function _resetMemStoreForTests(): void {
  memStore.clear();
}
