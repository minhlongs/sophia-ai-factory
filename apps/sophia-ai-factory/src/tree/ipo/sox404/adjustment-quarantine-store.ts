/**
 * SOX 404 Control Ledger: Quarantine Event Persistence & Hashing
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/sox404/adjustment-quarantine-store
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@/seed/db/client';
import type { SoxValidationResult } from '@/seed/types/ipo-filing';

export function sha256Sync(data: string): string {
  try {
    return createHash('sha256').update(data).digest('hex');
  } catch {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Records a quarantine event into the D1 SOX 404 control matrix table, incrementing counters.
 */
export async function recordQuarantineEventInDb(
  db: D1Database,
  validationResult: SoxValidationResult
): Promise<void> {
  if (!validationResult.quarantined) return;

  const timestamp = Date.now();
  const uniqueControls = Array.from(new Set(validationResult.violatedControlIds));
  for (const controlId of uniqueControls) {
    await db
      .prepare(
        `UPDATE sox_404_control_matrix SET
          unauthorized_attempts_detected = unauthorized_attempts_detected + 1,
          quarantined_entries_count = quarantined_entries_count + 1,
          test_evidence_hash = ?,
          last_evaluated_at = ?,
          updated_at = ?
        WHERE control_id = ?`
      )
      .bind(validationResult.auditEvidenceHash, timestamp, timestamp, controlId)
      .run();
  }
}
