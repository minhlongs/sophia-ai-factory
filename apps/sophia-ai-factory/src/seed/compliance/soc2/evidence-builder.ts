import type { Tier } from '@/seed/types';
import type { SOC2Finding, SOC2ReadinessResult } from './types';
import { SOC2_CONTROLS } from './audit-log-collector';

export function evaluateSOC2Readiness(tier: Tier): SOC2ReadinessResult {
  const findings: SOC2Finding[] = [];

  for (const ctrl of SOC2_CONTROLS) {
    let implementationPass: boolean;
    try {
      implementationPass = ctrl.probe(tier);
    } catch {
      implementationPass = false;
    }
    const pass = implementationPass && !ctrl.externalEvidenceRequired;

    findings.push({
      controlId: ctrl.id,
      title: ctrl.title,
      category: ctrl.category,
      status: pass ? 'pass' : 'fail',
      note: pass
        ? undefined
        : implementationPass && ctrl.externalEvidenceRequired
          ? `External evidence required for ${ctrl.id}`
          : `Implementation probe failed for ${ctrl.id}`,
      evidenceMissing: pass
        ? undefined
        : implementationPass && ctrl.externalEvidenceRequired
          ? ctrl.externalEvidenceRequired
          : ctrl.evidenceMissing,
    });
  }

  const applicable = findings.filter((f) => f.status !== 'not_applicable');
  const passed = applicable.filter((f) => f.status === 'pass').length;
  const failed = applicable.filter((f) => f.status === 'fail').length;
  const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

  let recommendation: string | undefined;
  if (score < 60) {
    recommendation =
      'Remediate failed controls before external audit. '
      + 'Priority: CC6.6 (immutable audit triggers), CC6.2 (MFA), A1.1 (backup).';
  } else if (score < 90) {
    recommendation =
      'Address remaining failed controls. Obtain signed-off risk assessment from third-party assessor. '
      + 'Complete DR drill cadence and quarterly access review.';
  } else {
    recommendation = 'All SOC 2 Type I controls passing. Proceed with external auditor engagement.';
  }

  return {
    tier,
    timestamp: new Date().toISOString(),
    totalControls: SOC2_CONTROLS.length,
    passed,
    failed,
    notApplicable: findings.length - applicable.length,
    score,
    findings,
    recommendation,
  };
}
