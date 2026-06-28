/**
 * Land Operations Module — Barrel Exports
 *
 * Central export point for all SOP definitions and operations types.
 *
 * @module land/operations
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export * from './types';

// ── Video Generation SOPs ────────────────────────────────────────────────────

export {
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
  VIDEO_GENERATION_SOPS,
} from './sop-video-generation';

// ── Campaign Distribution SOPs ───────────────────────────────────────────────

export {
  ugcCreatorAgency,
  CAMPAIGN_DISTRIBUTION_SOPS,
} from './sop-campaign-distribution';

// ── Billing & Payouts SOPs ───────────────────────────────────────────────────

export {
  aiAvatarVideoAgency,
  BILLING_PAYOUTS_SOPS,
} from './sop-billing-payouts';

// ── Affiliate Management SOPs ────────────────────────────────────────────────

export {
  affiliatePartnerProgram,
  AFFILIATE_MANAGEMENT_SOPS,
} from './sop-affiliate-management';

// ── Compliance & Audit SOPs ──────────────────────────────────────────────────

export {
  complianceAuditProgram,
  COMPLIANCE_AUDIT_SOPS,
} from './sop-compliance-audit';

// ── Aggregate All SOPs ───────────────────────────────────────────────────────

import { SopDefinition } from './types';
import { VIDEO_GENERATION_SOPS } from './sop-video-generation';
import { CAMPAIGN_DISTRIBUTION_SOPS } from './sop-campaign-distribution';
import { BILLING_PAYOUTS_SOPS } from './sop-billing-payouts';
import { AFFILIATE_MANAGEMENT_SOPS } from './sop-affiliate-management';
import { COMPLIANCE_AUDIT_SOPS } from './sop-compliance-audit';

export const ALL_OPERATIONS_SOPS: SopDefinition[] = [
  ...VIDEO_GENERATION_SOPS,
  ...CAMPAIGN_DISTRIBUTION_SOPS,
  ...BILLING_PAYOUTS_SOPS,
  ...AFFILIATE_MANAGEMENT_SOPS,
  ...COMPLIANCE_AUDIT_SOPS,
];
