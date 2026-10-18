/**
 * Step Definitions for Compliance Audit Program SOP
 *
 * @module land/operations/sop-compliance-audit-steps
 */

import type { SopStepDef } from './types';
import { COMPLIANCE_AUDIT_REMEDIATION_STEPS } from './sop-compliance-audit-remediation-steps';

export const COMPLIANCE_AUDIT_PROGRAM_STEPS: SopStepDef[] = [
  {
    order: 1,
    name_en: 'Define Audit Scope',
    name_vi: 'Xác Độ Phạm Vi Audit',
    description_en:
      'Determine audit scope: data privacy, financial compliance, AI disclosure, payment processing, or comprehensive.',
    description_vi:
      'Xác định phạm vi audit: quyền riêng tư dữ liệu, tuân thủ tài chính, công bố AI, xử lý thanh toán, hoặc toàn diện.',
    tool: 'audit-scope-builder',
    tool_config: { frameworks: ['gdpr', 'pdpa', 'soc2', 'pci-dss'], include_areas: ['data', 'finance', 'ai'] },
    estimated_minutes: 30,
    is_automated: false,
  },
  {
    order: 2,
    name_en: 'Gather Documentation',
    name_vi: 'Thu Thập Tài Liệu',
    description_en:
      'Collect policies, procedures, data flow diagrams, consent forms, and third-party agreements.',
    description_vi:
      'Thu thập chính sách, quy trình, sơ đồ luồng dữ liệu, form đồng ý và thỏa thuận bên thứ ba.',
    tool: 'document-manager',
    tool_config: { required_docs: ['privacy-policy', 'terms-of-service', 'data-processing-agreement', 'cookie-consent'] },
    estimated_minutes: 60,
    is_automated: false,
  },
  {
    order: 3,
    name_en: 'Review Data Retention & Deletion',
    name_vi: 'Kiểm Tra Lưu Trữ & Xóa Dữ Liệu',
    description_en:
      'Verify data retention policies, automated deletion schedules, and user right-to-deletion implementation.',
    description_vi:
      'Xác minh chính sách lưu trữ dữ liệu, lịch xóa tự động và triển khai quyền xóa của người dùng.',
    tool: 'data-retention-auditor',
    tool_config: { check_retention_periods: true, verify_deletion_mechanism: true, test_user_request_flow: true },
    estimated_minutes: 45,
    is_automated: true,
  },
  {
    order: 4,
    name_en: 'Audit Consent & Transparency',
    name_vi: 'Audit Sự Đồng Ý & Minh Bạch',
    description_en:
      'Check consent collection mechanisms, opt-in/opt-out flows, and transparency notices for AI usage.',
    description_vi:
      'Kiểm tra cơ chế thu thập đồng ý, luồng opt-in/opt-out và thông báo minh bạch về việc sử dụng AI.',
    tool: 'consent-auditor',
    tool_config: { verify_gdpr_consent: true, check_ai_disclosure: true, audit_cookie_banner: true },
    estimated_minutes: 30,
    is_automated: true,
  },
  {
    order: 5,
    name_en: 'Review Payment Processing Compliance',
    name_vi: 'Xem Xét Tuân Thủ Xử Lý Thanh Toán',
    description_en:
      'Audit NOWPayments/PayOS integration for PCI DSS scope, data encryption, and reconciliation controls.',
    description_vi:
      'Audit tích hợp NOWPayments/PayOS cho phạm vi PCI DSS, mã hóa dữ liệu và kiểm soát đối chiếu.',
    tool: 'payment-auditor',
    tool_config: { check_pci_scope: true, verify_encryption: true, review_reconciliation: true },
    estimated_minutes: 40,
    is_automated: false,
  },
  ...COMPLIANCE_AUDIT_REMEDIATION_STEPS,
];
