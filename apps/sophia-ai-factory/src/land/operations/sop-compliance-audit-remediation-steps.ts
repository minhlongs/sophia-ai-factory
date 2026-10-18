/**
 * Validation, Vendor Review & Remediation Steps (6–10) for Compliance Audit Program SOP
 *
 * @module land/operations/sop-compliance-audit-remediation-steps
 */

import type { SopStepDef } from './types';

export const COMPLIANCE_AUDIT_REMEDIATION_STEPS: SopStepDef[] = [
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
];
