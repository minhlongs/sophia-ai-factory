/**
 * amm-clearing-helpers.ts — Shared Auth & Pool Resolution Helpers for AMM Server Actions
 * Layer: LAND (Server Actions / Controllers)
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type { AmmLiquidityPool } from '@/seed/types/amm-clearing';
import { ConcentratedLiquidityEngine } from '@/tree/amm/concentrated-liquidity-engine';

export interface AmmActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function resolveAuthenticatedAmmContext(): Promise<
  { ok: true; db: D1Database } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'Unauthorized: authentication required' };
  }

  const db = await getD1();
  if (!db) {
    return { ok: false, error: 'Database binding not available' };
  }

  return { ok: true, db };
}

export async function resolveAuthenticatedAmmPool(
  poolId: string,
): Promise<
  { ok: true; db: D1Database; pool: AmmLiquidityPool } | { ok: false; error: string }
> {
  const ctx = await resolveAuthenticatedAmmContext();
  if (!ctx.ok) return ctx;

  const pool = await ConcentratedLiquidityEngine.getPoolById(ctx.db, poolId);
  if (!pool) {
    return { ok: false, error: `Pool not found: ${poolId}` };
  }

  return { ok: true, db: ctx.db, pool };
}
