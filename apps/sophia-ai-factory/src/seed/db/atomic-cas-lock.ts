/**
 * Seed Layer: Atomic CAS Distributed Lock Helper
 * Pure D1 SQLite distributed lock primitive enforcing atomic ownership via ON CONFLICT DO UPDATE.
 * Includes automatic 5-minute stale lock recovery.
 * Layer: seed/db | Max LOC: < 200 | Zero :any
 * @module seed/db/atomic-cas-lock
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface CasLockOptions {
  ttlMs?: number;
  now?: number;
}

export interface CasLockResult {
  acquired: boolean;
  lockKey: string;
  ownerId: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Attempts to acquire an atomic distributed lock in D1.
 * If lock exists but has expired (expires_at < now), reclaims it atomically.
 */
export async function acquireCasLock(
  lockKey: string,
  ownerId: string,
  options?: CasLockOptions
): Promise<CasLockResult> {
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = now + ttlMs;

  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for acquireCasLock', { lockKey });
    return { acquired: false, lockKey, ownerId, expiresAt: 0 };
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO growth_distributed_locks (lock_key, owner_id, acquired_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (lock_key) DO UPDATE SET
         owner_id = excluded.owner_id,
         acquired_at = excluded.acquired_at,
         expires_at = excluded.expires_at
       WHERE growth_distributed_locks.expires_at < ?`
    );

    const res = await stmt.bind(lockKey, ownerId, now, expiresAt, now).run();
    const changes = res.meta?.changes ?? 0;

    return {
      acquired: changes === 1,
      lockKey,
      ownerId,
      expiresAt: changes === 1 ? expiresAt : 0,
    };
  } catch (error) {
    logger.error('Failed to acquire CAS lock in D1', { lockKey, ownerId, error });
    return { acquired: false, lockKey, ownerId, expiresAt: 0 };
  }
}

/**
 * Releases a previously acquired lock, verifying ownership atomically.
 */
export async function releaseCasLock(
  lockKey: string,
  ownerId: string
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for releaseCasLock', { lockKey });
    return false;
  }

  try {
    const stmt = db.prepare(
      `DELETE FROM growth_distributed_locks
       WHERE lock_key = ? AND owner_id = ?`
    );

    const res = await stmt.bind(lockKey, ownerId).run();
    return (res.meta?.changes ?? 0) === 1;
  } catch (error) {
    logger.error('Failed to release CAS lock in D1', { lockKey, ownerId, error });
    return false;
  }
}
