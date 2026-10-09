/**
 * Edge GPU Workload Balancer: D1 Batch Execution Helper
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/batch-executor
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Executes a batch of statements safely across Cloudflare Workers D1 and test shims.
 */
export async function executeBatchStatements(
  db: D1Database,
  statements: Array<{ run: () => Promise<unknown> }>,
): Promise<void> {
  if (typeof db.batch === 'function') {
    const results = await db.batch(
      statements as unknown as Parameters<D1Database['batch']>[0],
    );
    // If test shim returns the statement objects themselves without executing
    if (
      Array.isArray(results) &&
      results.length > 0 &&
      typeof (results[0] as { run?: unknown })?.run === 'function'
    ) {
      for (const stmt of statements) {
        await stmt.run();
      }
    }
  } else {
    for (const stmt of statements) {
      await stmt.run();
    }
  }
}
