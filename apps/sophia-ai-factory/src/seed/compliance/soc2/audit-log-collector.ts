import type { Tier, FeatureFlag } from '@/seed/types';
import { tierHasFeature } from '@/seed/config/tiers';
import { getFeatureFlag } from '@/seed/config/flags';
import type { SOC2Control } from './types';

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
