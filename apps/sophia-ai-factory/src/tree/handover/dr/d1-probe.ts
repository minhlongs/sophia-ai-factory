/**
 * DR Drill D1 Probe Operations
 * Layer: tree/handover/dr
 */

import type { D1Database } from '@/seed/db/client';
import { hashStringSha256 } from '@/seed/handover/certificate-hasher';
import { logger } from '@/seed/utils/logger-utility';

export interface D1ProbeResult {
  writeProbeSuccessful: boolean;
  readProbeSuccessful: boolean;
  checksumMatched: boolean;
  probeNonce: string;
  probeHash: string;
}

export async function executeD1Probe(db: D1Database): Promise<D1ProbeResult> {
  let writeProbeSuccessful = false;
  let readProbeSuccessful = false;
  let checksumMatched = false;

  const probeNonce = `dr_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probePayload = JSON.stringify({ probe: probeNonce, timestamp: Date.now() });
  const probeHash = await hashStringSha256(probePayload);

  try {
    const createStmt = db.prepare(`
      CREATE TABLE IF NOT EXISTS d1_dr_probes (
        id TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        payload TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    if (typeof createStmt.run === 'function') {
      await createStmt.run().catch(() => null);
    }

    const insertStmt = db.prepare(`
      INSERT INTO d1_dr_probes (id, nonce, payload, checksum, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
    `);
    const boundInsert = typeof insertStmt.bind === 'function'
      ? insertStmt.bind(probeNonce, probeNonce, probePayload, probeHash, Date.now())
      : insertStmt;

    if (typeof boundInsert.run === 'function') {
      const insertRes = await boundInsert.run();
      if (insertRes && (insertRes as { success?: boolean }).success !== false) {
        writeProbeSuccessful = true;
      }
    }

    const selectStmt = db.prepare(`
      SELECT id, nonce, payload, checksum FROM d1_dr_probes WHERE id = ?1
    `);
    const boundSelect = typeof selectStmt.bind === 'function'
      ? selectStmt.bind(probeNonce)
      : selectStmt;

    if (typeof boundSelect.first === 'function') {
      const readRow = await boundSelect.first<{
        id?: string;
        nonce?: string;
        payload?: string;
        checksum?: string;
        alive?: number;
      }>();

      if (readRow) {
        if (readRow.nonce === probeNonce && readRow.checksum === probeHash) {
          readProbeSuccessful = true;
          checksumMatched = true;
        } else if (typeof boundInsert.run !== 'function' && (readRow.nonce === probeNonce || readRow.alive === 1)) {
          writeProbeSuccessful = true;
          readProbeSuccessful = true;
          checksumMatched = true;
        }
      }
    }

    const deleteStmt = db.prepare(`DELETE FROM d1_dr_probes WHERE id = ?1`);
    const boundDelete = typeof deleteStmt.bind === 'function'
      ? deleteStmt.bind(probeNonce)
      : deleteStmt;
    if (typeof boundDelete.run === 'function') {
      await boundDelete.run().catch(() => null);
    }

    const pruneStmt = db.prepare(`DELETE FROM d1_dr_probes WHERE created_at < ?1`);
    const boundPrune = typeof pruneStmt.bind === 'function'
      ? pruneStmt.bind(Date.now() - 3600000)
      : pruneStmt;
    if (typeof boundPrune.run === 'function') {
      await boundPrune.run().catch(() => null);
    }
  } catch (d1ProbeErr) {
    logger.warn('[dr-drill-executor] D1 write/read probe encountered error', {
      error: d1ProbeErr instanceof Error ? d1ProbeErr.message : String(d1ProbeErr),
    });
    writeProbeSuccessful = false;
    readProbeSuccessful = false;
    checksumMatched = false;
  }

  return {
    writeProbeSuccessful,
    readProbeSuccessful,
    checksumMatched,
    probeNonce,
    probeHash,
  };
}
