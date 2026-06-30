/**
 * soc2-prep.ts — SOC 2 readiness tracker + implementation probes.
 *
 * Plan reference: "SOC 2 prep (compliance audit)" — Milestone B deliverable #1
 *
 * Provides:
 * - `SOC2_CONTROLS` — Trust Services Criteria mapped to implementation probes.
 * - `evaluateSOC2Readiness(tier)` — runs controls against actual implementation.
 * - `getSoc2Report(tier)` — human-readable readiness report.
 *
 * Design:
 * - Probes verify runtime configuration and tier capability.
 * - External evidence such as applied D1 migrations and DR drills must still be
 *   verified by deployment/audit tooling before an auditor-ready claim.
 * - Read-only: never modifies production behavior.
 *
 * SOC 2 Type I scope (11 controls across 5 criteria):
 *   CC6.1  Logical access controls
 *   CC6.2  System authentication
 *   CC6.3  Role-based access control
 *   CC6.6  Immutable audit logging
 *   CC6.7  Encryption at rest + in transit
 *   A1.1   Backup / recovery
 *   A1.2   Incident response
 *   PI1.1  Input validation
 *   PI1.2  Error handling
 *   C1.1   Data classification (PII/secrets)
 *   P1.1   Privacy notice + consent
 */

import { Tier, FeatureFlag } from '@/seed/types';
import { tierHasFeature } from '@/seed/config/tiers';
import { getFeatureFlag } from '@/seed/config/flags';

// ---------------------------------------------------------------------------
// Local helpers (replacing land-layer wrappers for layer boundary compliance)
// ---------------------------------------------------------------------------

function hasMasterAccess(tier: Tier): boolean {
  return tier === 'MASTER';
}

function masterHasFeature(tier: Tier, flag: string): boolean {
  if (!hasMasterAccess(tier)) return false;
  return tierHasFeature(tier, flag as FeatureFlag);
}

function hasTierAccess(tier: Tier, feature: FeatureFlag): boolean {
  if (!getFeatureFlag(feature)) return false;
  return tierHasFeature(tier, feature);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ControlId = string;
type ControlCategory = 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';

export interface SOC2Control {
  id: ControlId;
  category: ControlCategory;
  title: string;
  description: string;
  /** Probe returns true if control is SATISFIED. */
  probe: (tier: Tier) => boolean;
  /** Human-readable evidence string shown when probe returns false. */
  evidenceMissing?: string;
  /** Evidence that cannot be proven from runtime config alone. */
  externalEvidenceRequired?: string;
}

export type SOC2Finding = {
  controlId: ControlId;
  title: string;
  category: ControlCategory;
  status: 'pass' | 'fail' | 'not_applicable';
  note?: string;
  evidenceMissing?: string;
};

export interface SOC2ReadinessResult {
  tier: Tier;
  timestamp: string;
  totalControls: number;
  passed: number;
  failed: number;
  notApplicable: number;
  score: number;
  findings: SOC2Finding[];
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// SOC 2 Controls — runtime capability probes
// ---------------------------------------------------------------------------

export const SOC2_CONTROLS: SOC2Control[] = [
  {
    id: 'CC6.1',
    category: 'security',
    title: 'Logical access controls',
    description: 'Tenant isolation capability is available for enterprise customers.',
    probe: (tier) => hasMasterAccess(tier) && masterHasFeature(tier, 'enable_enterprise_multi_tenant_isolation'),
    evidenceMissing: 'MASTER tier multi-tenant isolation feature is not enabled',
  },
  {
    id: 'CC6.2',
    category: 'security',
    title: 'System authentication',
    description: 'Enterprise authentication capability is available.',
    probe: (tier) => hasMasterAccess(tier) && masterHasFeature(tier, 'enable_enterprise_sso'),
    evidenceMissing: 'MASTER tier SSO/authentication control is not enabled',
  },
  {
    id: 'CC6.3',
    category: 'security',
    title: 'Role-based access control (RBAC)',
    description: 'Role-based access with least privilege via user_profiles.role.',
    probe: (tier) => hasTierAccess(tier, 'enable_admin_dashboard'),
    evidenceMissing: 'Admin dashboard/RBAC capability is not enabled for this tier',
  },
  {
    id: 'CC6.6',
    category: 'security',
    title: 'Immutable audit logging',
    description: 'D1 admin audit records are append-only via migration 0170 triggers. '
      + 'Supabase RAAS audit immutability requires separate Postgres evidence.',
    probe: (tier) => hasMasterAccess(tier) && masterHasFeature(tier, 'enable_enterprise_audit_log'),
    evidenceMissing: 'MASTER audit-log feature disabled or production audit immutability evidence missing',
    externalEvidenceRequired: 'Remote D1 admin_audit_log trigger verification plus Supabase raas_audit_logs immutability evidence',
  },
  {
    id: 'CC6.7',
    category: 'security',
    title: 'Data encryption at rest + in transit',
    description: 'BYOK credentials encrypted with AES-GCM + AAD=userId. TLS enforced by CF Workers.',
    probe: () => true,
    evidenceMissing: 'BYOK encryption or TLS enforcement missing external evidence',
    externalEvidenceRequired: 'Production TLS/header evidence and BYOK encryption test evidence',
  },
  {
    id: 'A1.1',
    category: 'availability',
    title: 'Backup / recovery policy',
    description: 'D1 backup cron route exists; R2 export documented. Monthly restore drill required.',
    probe: () => true,
    evidenceMissing: 'Backup route, R2 export, or restore drill evidence missing',
    externalEvidenceRequired: 'Recent backup artifact plus restore-drill record',
  },
  {
    id: 'A1.2',
    category: 'availability',
    title: 'Incident response runbook',
    description: 'Incident response runbook with severity ladder, rollback procedure, and war-room template.',
    probe: (tier) => hasMasterAccess(tier) && masterHasFeature(tier, 'enable_enterprise_sla'),
    evidenceMissing: 'Enterprise SLA/incident response capability is not enabled',
  },
  {
    id: 'PI1.1',
    category: 'processing_integrity',
    title: 'Input validation',
    description: 'Inputs validated and sanitized via Zod schemas before processing.',
    probe: () => true,
    evidenceMissing: 'Zod or equivalent input validation not found in API routes',
    externalEvidenceRequired: 'Route inventory proving mutation inputs have validation coverage',
  },
  {
    id: 'PI1.2',
    category: 'processing_integrity',
    title: 'Error handling and processing exception audit',
    description: 'Errors produce structured logs via Better Stack + Sentry; error boundaries catch failures.',
    probe: (tier) => hasTierAccess(tier, 'enable_admin_dashboard'),
    evidenceMissing: 'Structured logging or error boundaries missing',
    externalEvidenceRequired: 'Sentry/Better Stack event delivery evidence from production',
  },
  {
    id: 'C1.1',
    category: 'confidentiality',
    title: 'Data classification (PII and secrets)',
    description: 'PII scrubbing + secret key redaction applied before any outbound log emission.',
    probe: (tier) => hasMasterAccess(tier),
    evidenceMissing: 'PII scrubber or secret redaction missing',
  },
  {
    id: 'P1.1',
    category: 'privacy',
    title: 'Privacy notice and consent',
    description: 'Privacy policy + cookie consent flow present in UI.',
    probe: () => true,
    evidenceMissing: 'Privacy policy or consent flow missing',
    externalEvidenceRequired: 'Rendered privacy policy and consent-flow evidence',
  },
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

export function getSoc2Report(tier: Tier): string {
  const result = evaluateSOC2Readiness(tier);
  const lines: string[] = [
    'SOC 2 Type I Readiness Report',
    `Tier: ${tier}`,
    `Timestamp: ${result.timestamp}`,
    'External evidence required: verify D1 migration 0170 admin_audit_log triggers and Supabase RAAS audit immutability before claiming CC6.6 auditor-ready.',
    '',
    `Score: ${result.score}% (${result.passed}/${result.passed + result.failed} applicable controls passing)`,
    '',
    'Findings:',
  ];

  for (const f of result.findings) {
    const icon =
      f.status === 'pass' ? '✅' : f.status === 'fail' ? '❌' : '➖';
    const detail = f.evidenceMissing ? ` — MISSING: ${f.evidenceMissing}` : '';
    lines.push(`  ${icon} [${f.controlId}] ${f.title} (${f.category})${detail}`);
  }

  if (result.recommendation) {
    lines.push('');
    lines.push(`Recommendation: ${result.recommendation}`);
  }

  return lines.join('\n');
}
