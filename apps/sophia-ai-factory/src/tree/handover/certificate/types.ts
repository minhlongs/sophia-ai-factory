/**
 * Handover Certificate Types & Constants
 *
 * @module tree/handover/certificate/types
 */

export const CANONICAL_ACCEPTANCE_STATEMENTS: string[] = [
  'Access to all 10 Customer Runbooks received, reviewed, and archived.',
  'Test video generated and verified through creative mission pipeline.',
  'Sensitive API keys and BYOK credentials verified under exclusive customer control.',
  'Support escalation channels, diagnostic export procedures, and disaster recovery validated.',
];

export type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  HandoverCertificatePayload,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
