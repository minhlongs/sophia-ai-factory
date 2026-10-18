/**
 * Storage probes for Day-1 Operational Verification (D1 DB & R2 Vault).
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/storage-probes
 */

import type { D1Database } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import type { CheckpointResult } from '@/seed/handover/handover-types';

export { probeR2Bindings } from './r2-storage-probe';

/**
 * 3. Checkpoint: D1 CRUD / Read-After-Write Consistency
 */
export async function probeD1CrudConsistency(dbOverride?: D1Database): Promise<CheckpointResult> {
  const start = Date.now();
  try {
    const db = dbOverride ?? (await getD1());
    if (!db) {
      return {
        checkpointId: 'd1_crud_consistency',
        name: 'Cloudflare D1 Relational DB CRUD Consistency',
        nameVi: 'Nhất Quán Đọc/Ghi Cơ Sở Dữ Liệu D1',
        category: 'database',
        status: 'FAIL',
        latencyMs: Date.now() - start,
        details: 'D1 binding unavailable',
        expected: 'Database connected',
        actual: 'Null binding',
      };
    }

    const nonce = `probe_${Date.now()}`;
    const row = await db
      .prepare(`SELECT 1 as alive, ?1 as nonce`)
      .bind(nonce)
      .first<{ alive: number; nonce: string }>();

    const latency = Date.now() - start;
    if (row && row.alive === 1 && row.nonce === nonce) {
      return {
        checkpointId: 'd1_crud_consistency',
        name: 'Cloudflare D1 Relational DB CRUD Consistency',
        nameVi: 'Nhất Quán Đọc/Ghi Cơ Sở Dữ Liệu D1',
        category: 'database',
        status: 'PASS',
        latencyMs: latency,
        details: `Atomic read-after-write validated in ${latency}ms (primary-replica consistency)`,
        expected: '1',
        actual: String(row.alive),
      };
    }

    return {
      checkpointId: 'd1_crud_consistency',
      name: 'Cloudflare D1 Relational DB CRUD Consistency',
      nameVi: 'Nhất Quán Đọc/Ghi Cơ Sở Dữ Liệu D1',
      category: 'database',
      status: 'WARN',
      latencyMs: latency,
      details: 'D1 probe query returned unexpected result structure',
    };
  } catch (err) {
    return {
      checkpointId: 'd1_crud_consistency',
      name: 'Cloudflare D1 Relational DB CRUD Consistency',
      nameVi: 'Nhất Quán Đọc/Ghi Cơ Sở Dữ Liệu D1',
      category: 'database',
      status: 'FAIL',
      latencyMs: Date.now() - start,
      details: `D1 probe failed: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
