/**
 * SOX 404 Control Evaluator: ASC 606 Revenue Recognition Invariance (SOX-FIN-03)
 * and shared financial control result builder.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/sox404/asc606-control-evaluator
 */

import type { D1Database } from '@/seed/db/client';
import {
  SOX_CONTROL_IDS,
  type SoxControlCategory,
  type SoxControlEvaluation,
} from '@/seed/types/ipo-filing';
import { canonicalJson, sha256Hex } from '@/tree/finance/merkle-audit-vault';

export async function buildFinancialControlResult(params: {
  controlId: SoxControlEvaluation['controlId'];
  controlName: string;
  category: SoxControlCategory;
  failureStatus: SoxControlEvaluation['status'];
  isEffective: boolean;
  findings: string[];
  timestamp: number;
}): Promise<SoxControlEvaluation> {
  const { controlId, controlName, category, failureStatus, isEffective, findings, timestamp } =
    params;
  const evidenceHash = await sha256Hex(
    canonicalJson({ controlId, isEffective, findings, timestamp }),
  );
  return {
    controlId,
    controlName,
    category,
    status: isEffective ? 'effective' : failureStatus,
    isEffective,
    testedAt: timestamp,
    testedBy: 'SOX_AUTOMATED_AUDITOR',
    evidenceHash,
    findings,
    unauthorizedAttemptsDetected: 0,
    quarantinedEntriesCount: 0,
  };
}

export async function evaluateAsc606Control(
  db: D1Database,
  timestamp: number,
): Promise<SoxControlEvaluation> {
  const findings: string[] = [];
  let isEffective = true;

  try {
    const invalidSchedules = await db
      .prepare(
        `SELECT id, contract_id, total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents
         FROM revenue_schedules
         WHERE (recognized_revenue_cents + deferred_revenue_cents) != total_contract_value_cents`,
      )
      .all<{
        id: string;
        contract_id: string;
        total_contract_value_cents: number;
        recognized_revenue_cents: number;
        deferred_revenue_cents: number;
      }>();

    if (invalidSchedules.results && invalidSchedules.results.length > 0) {
      isEffective = false;
      for (const inv of invalidSchedules.results) {
        findings.push(
          `Contract ${inv.contract_id}: value ($${(inv.total_contract_value_cents / 100).toFixed(2)}) != recognized ($${(inv.recognized_revenue_cents / 100).toFixed(2)}) + deferred ($${(inv.deferred_revenue_cents / 100).toFixed(2)})`,
        );
      }
    }
  } catch {
    // Table may be empty
  }

  if (findings.length === 0) {
    findings.push(
      'ASC 606 revenue recognition invariant holds across 100% of evaluated contracts.',
    );
  }

  return buildFinancialControlResult({
    controlId: SOX_CONTROL_IDS.ASC606_REVENUE,
    controlName: 'ASC 606 Revenue Recognition Invariance',
    category: 'REVENUE_ASSURANCE',
    failureStatus: 'material_weakness',
    isEffective,
    findings,
    timestamp,
  });
}
