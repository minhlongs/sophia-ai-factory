/**
 * Payout, Reporting & Governance Steps (6–10) for Affiliate Partner Program SOP
 *
 * @module land/operations/sop-affiliate-management-payout-steps
 */

import type { SopStepDef } from './types';

export const AFFILIATE_PAYOUT_GOVERNANCE_STEPS: SopStepDef[] = [
  {
    order: 6,
    name_en: 'Calculate Commissions',
    name_vi: 'Tính Hoa Hồng',
    description_en:
      'Run daily commission calculation based on confirmed conversions and apply tier multipliers.',
    description_vi:
      'Chạy tính toán hoa hồng hàng ngày dựa trên chuyển đổi đã xác nhận và áp dụng hệ số cấp bậc.',
    tool: 'commission-calculator',
    tool_config: { run_frequency: 'daily', include_refunds: false, min_payout_threshold: 50 },
    estimated_minutes: 20,
    is_automated: true,
  },
  {
    order: 7,
    name_en: 'Process Payouts',
    name_vi: 'Xử Lý Thanh Toán',
    description_en:
      'Initiate affiliate payouts via integrated payment providers (PayPal, Stripe, bank transfer) on schedule.',
    description_vi:
      'Kích hoạt thanh toán affiliate qua payment provider tích hợp (PayPal, Stripe, chuyển khoản) theo lịch.',
    tool: 'payout-engine',
    tool_config: { providers: ['paypal', 'stripe', 'wise'], schedule: 'bi-weekly', auto_approve: true },
    estimated_minutes: 25,
    is_automated: true,
  },
  {
    order: 8,
    name_en: 'Generate Affiliate Reports',
    name_vi: 'Tạo Báo Cáo Affiliate',
    description_en:
      'Produce monthly performance reports for affiliates with earnings breakdown and conversion metrics.',
    description_vi:
      'Tạo báo cáo hiệu suất hàng tháng cho affiliate với breakdown thu nhập và metrics chuyển đổi.',
    tool: 'report-generator',
    tool_config: { format: 'pdf', include_charts: true, send_automatically: true },
    estimated_minutes: 15,
    is_automated: true,
  },
  {
    order: 9,
    name_en: 'Manage Tier Upgrades',
    name_vi: 'Quản Lý Nâng Cấp Cấp Bậc',
    description_en:
      'Review affiliate performance and upgrade tiers based on sales volume; notify of status changes.',
    description_vi:
      'Xem xét hiệu suất affiliate và nâng cấp cấp bậc dựa trên khối lượng bán; thông báo thay đổi trạng thái.',
    tool: 'tier-manager',
    tool_config: { review_frequency: 'monthly', auto_upgrade: true, notify_on_change: true },
    estimated_minutes: 10,
    is_automated: false,
  },
  {
    order: 10,
    name_en: 'Handle Disputes & Refunds',
    name_vi: 'Xử Lý Tranh Chấp & Hoàn Tiền',
    description_en:
      'Investigate affiliate disputes, handle refund adjustments, and maintain audit trail.',
    description_vi:
      'Điều tra tranh chấp affiliate, xử lý điều chỉnh hoàn tiền và duy trì audit trail.',
    tool: 'dispute-resolver',
    tool_config: { max_refund_window_days: 30, require_evidence: true, escalate_after_days: 7 },
    estimated_minutes: 20,
    is_automated: false,
  },
];
