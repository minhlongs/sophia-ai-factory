/**
 * Compliance & Audit SOPs
 *
 * Contains SOP definitions for regulatory compliance, internal audits,
 * and financial/legal oversight workflows:
 * - Compliance Audit Program (data privacy, financial, content)
 *
 * @module land/operations/sop-compliance-audit
 */

import type { SopDefinition } from './types';
import { COMPLIANCE_AUDIT_PROGRAM_STEPS } from './sop-compliance-audit-steps';

// ── SOP 7: Compliance Audit Program ──────────────────────────────────────────

export const complianceAuditProgram: SopDefinition = {
  slug: 'compliance-audit-program',
  name_en: 'Compliance Audit Program',
  name_vi: 'Chương Trình Audit Tuân Thủ',
  description_en:
    'Conduct systematic compliance audits covering data privacy (GDPR/PDPA), financial regulations, AI content disclosure requirements, and payment processing standards. Maintain audit trails and remediation workflows.',
  description_vi:
    'Thực hiện audit tuân thủ hệ thống bao gồm quyền riêng tư dữ liệu (GDPR/PDPA), quy định tài chính, yêu cầu công bố nội dung AI và tiêu chuẩn xử lý thanh toán. Duy trì audit trail và quy trình khắc phục.',
  category: 'operations',
  difficulty: 'advanced',
  estimated_revenue_min: 0,
  estimated_revenue_max: 0,
  setup_time_minutes: 300,
  credits_per_run: 25,
  steps: COMPLIANCE_AUDIT_PROGRAM_STEPS,
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const COMPLIANCE_AUDIT_SOPS: SopDefinition[] = [
  complianceAuditProgram,
];
