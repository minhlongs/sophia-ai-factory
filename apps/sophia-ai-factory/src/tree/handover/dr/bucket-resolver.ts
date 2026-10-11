/**
 * DR Bucket Resolver
 * Layer: tree/handover/dr
 */

import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Resolves the BACKUPS_BUCKET binding from runtime context or environment.
 */
export function resolveBackupsBucket(envOverride?: Record<string, unknown>): R2Bucket | null {
  if (envOverride?.BACKUPS_BUCKET) {
    return envOverride.BACKUPS_BUCKET as R2Bucket;
  }
  try {
    const envDouble = (globalThis as unknown as { __env__?: { BACKUPS_BUCKET?: R2Bucket } }).__env__;
    if (envDouble?.BACKUPS_BUCKET) return envDouble.BACKUPS_BUCKET;

    const envSingle = (globalThis as unknown as { __env?: { BACKUPS_BUCKET?: R2Bucket } }).__env;
    if (envSingle?.BACKUPS_BUCKET) return envSingle.BACKUPS_BUCKET;

    const ctx = (globalThis as Record<symbol, { env?: { BACKUPS_BUCKET?: R2Bucket } }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.BACKUPS_BUCKET) return ctx.env.BACKUPS_BUCKET;

    const g = globalThis as unknown as { BACKUPS_BUCKET?: R2Bucket };
    if (g.BACKUPS_BUCKET) return g.BACKUPS_BUCKET;

    return null;
  } catch {
    return null;
  }
}
