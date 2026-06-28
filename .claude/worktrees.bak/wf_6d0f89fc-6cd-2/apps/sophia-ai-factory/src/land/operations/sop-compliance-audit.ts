/**
 * Compliance & Audit SOPs
 *
 * Contains SOP definitions for regulatory compliance, internal audits,
 * and financial/legal oversight workflows:
 * - Compliance Audit Program (data privacy, financial, content)
 *
 * @module land/operations/sop-compliance-audit
 */

import type { SopDefinition, SopStepDef } from './types';

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
  steps: [
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
    {
      order: 6,
      name_en: 'Validate AI Content Disclosures',
      name_vi: 'Xác Thực Công Bố Nội Dung AI',
      description_en:
        'Ensure all AI-generated content includes appropriate disclosures per platform policy and legal requirements.',
      description_vi:
        'Đảm bảo tất cả nội dung AI tạo ra bao gồm công bố thích hợp theo chính sách nền tảng và yêu cầu pháp lý.',
      tool: 'ai-disclosure-checker',
      tool_config: { scan_videos: true, scan_text: true, check_watermarks: true, verify_disclosure_text: true },
      estimated_minutes: 35,
      is_automated: true,
    },
    {
      order: 7,
      name_en: 'Test Access Controls',
      name_vi: 'Kiểm Tra Kiểm Soát Truy Cập',
      description_en:
        'Review role-based access control (RBAC), least privilege enforcement, and admin activity logging.',
      description_vi:
        'Xem xét RBAC, thực thi least privilege và logging hoạt động admin.',
      tool: 'access-control-auditor',
      tool_config: { review_rbac_policies: true, check_least_privilege: true, audit_admin_logs: true },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 8,
      name_en: 'Examine Vendor Compliance',
      name_vi: 'Kiểm Tra Tuân Thủ Nhà Cung Cấp',
      description_en:
        'Review third-party vendor agreements for data processing addendums, SOC 2 reports, and security attestations.',
      description_vi:
        'Xem xét thỏa thuận nhà cung cấp bên thứ ba cho data processing addendum, báo cáo SOC 2 và chứng nhận bảo mật.',
      tool: 'vendor-compliance-checker',
      tool_config: { require_soc2: true, check_dpa: true, verify_insurance: true },
      estimated_minutes: 40,
      is_automated: false,
    },
    {
      order: 9,
      name_en: 'Document Findings',
      name_vi: 'Ghi Nhận Kết Quả',
      description_en:
        'Compile audit findings into structured report with severity ratings, evidence, and remediation recommendations.',
      description_vi:
        'Tổng hợp kết quả audit thành báo cáo có cấu trúc với mức độ nghiêm trọng, bằng chứng và đề xuất khắc phục.',
      tool: 'report-generator',
      tool_config: { template: 'compliance-audit', include_evidence: true, generate_remediation_plan: true },
      estimated_minutes: 30,
      is_automated: true,
    },
    {
      order: 10,
      name_en: 'Track Remediation',
      name_vi: 'Theo Dõi Khắc Phục',
      description_en:
        'Create remediation tickets, assign owners, and verify closure of all high/medium findings.',
      description_vi:
        'Tạo ticket khắc phục, phân công chủ sở hữu và xác minh đóng tất cả phát hiện nghiêm trọng/trung bình.',
      tool: 'remediation-tracker',
      tool_config: { auto_create_tickets: true, escalate_overdue: true, require_verification: true },
      estimated_minutes: 20,
      is_automated: false,
    },
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const COMPLIANCE_AUDIT_SOPS: SopDefinition[] = [
  complianceAuditProgram,
];
