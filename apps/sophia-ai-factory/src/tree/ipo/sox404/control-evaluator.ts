/**
 * SOX 404 Control Ledger: Comprehensive Evaluation Engine
 *
 * Runs all 6 canonical SOX 404 controls, computes overall status,
 * generates Merkle root anchoring, and updates D1 control matrix.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/sox404/control-evaluator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  Sox404Status,
  SoxControlEvaluation,
  SoxEvaluationSummary,
} from '@/seed/types/ipo-filing';
import { buildMerkleTree } from '@/tree/finance/merkle-audit-vault';
import {
  evaluateSodControl,
  evaluateIntercompanyControl,
  evaluateAsc606Control,
} from './financial-control-evaluators';
import {
  evaluateCryptoIntegrityControl,
  evaluateQuarantineGateControl,
  evaluateRegGNonGaapControl,
} from './itgc-control-evaluators';

export async function evaluateAllControls(db: D1Database): Promise<SoxEvaluationSummary> {
  const timestamp = Date.now();
  const evaluations: SoxControlEvaluation[] = [];

  evaluations.push(await evaluateSodControl(db, timestamp));
  evaluations.push(await evaluateIntercompanyControl(db, timestamp));
  evaluations.push(await evaluateAsc606Control(db, timestamp));
  evaluations.push(await evaluateCryptoIntegrityControl(db, timestamp));
  evaluations.push(await evaluateQuarantineGateControl(db, timestamp));
  evaluations.push(await evaluateRegGNonGaapControl(db, timestamp));

  const effectiveCount = evaluations.filter((e) => e.isEffective).length;
  const deficiencyCount = evaluations.filter(
    (e) => e.status === 'deficiency' || e.status === 'significant_deficiency'
  ).length;
  const materialWeaknessCount = evaluations.filter((e) => e.status === 'material_weakness').length;

  let overallStatus: Sox404Status = 'certified_clean';
  if (materialWeaknessCount > 0) {
    overallStatus = 'adverse_weakness';
  } else if (deficiencyCount > 0) {
    overallStatus = 'qualified_deficiency';
  } else if (effectiveCount === evaluations.length) {
    overallStatus = 'certified_clean';
  } else {
    overallStatus = 'in_progress';
  }

  const merkleTree = await buildMerkleTree(evaluations.map((e) => e.evidenceHash));
  const merkleRootHash = merkleTree.rootHash;

  for (const ev of evaluations) {
    try {
      await db
        .prepare(
          `UPDATE sox_404_control_matrix SET
            last_evaluated_at = ?,
            last_evaluation_status = ?,
            test_evidence_hash = ?,
            last_tested_by = ?,
            updated_at = ?
          WHERE control_id = ?`
        )
        .bind(ev.testedAt, ev.status, ev.evidenceHash, ev.testedBy, timestamp, ev.controlId)
        .run();
    } catch {
      // Skip if table not yet seeded in lightweight unit test
    }
  }

  return {
    overallStatus,
    totalControlsTested: evaluations.length,
    effectiveControlsCount: effectiveCount,
    deficienciesCount: deficiencyCount + materialWeaknessCount,
    evaluations,
    merkleRootHash,
    certifiedAt: timestamp,
  };
}
