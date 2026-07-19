/**
 * Affiliate Management SOPs
 *
 * Contains SOP definitions for affiliate partner recruitment, commission tracking,
 * and partnership lifecycle management:
 * - Affiliate Partner Program (partner recruitment, tracking, payouts)
 *
 * @module land/operations/sop-affiliate-management
 */

import type { SopDefinition, SopStepDef } from './types';

// ── SOP 6: Affiliate Partner Program ─────────────────────────────────────────

export const affiliatePartnerProgram: SopDefinition = {
  slug: 'affiliate-partner-program',
  name_en: 'Affiliate Partner Program',
  name_vi: 'Chương Trình Affiliate Partner',
  description_en:
    'Launch and manage an affiliate partner program to incentivize referrals and grow customer acquisition through trusted partners. Handle commission tracking, tiered rates, and automated payouts.',
  description_vi:
    'Khởi động và quản lý chương trình affiliate partner để thúc đẩy giới thiệu khách hàng và tăng tuyến đầu qua đối tác đáng tin cậy. Xử lý theo dõi hoa hồng, tỷ lệ cấp bậc và thanh toán tự động.',
  category: 'marketing',
  difficulty: 'intermediate',
  estimated_revenue_min: 3000,
  estimated_revenue_max: 15000,
  setup_time_minutes: 180,
  credits_per_run: 12,
  steps: [
    {
      order: 1,
      name_en: 'Design Commission Structure',
      name_vi: 'Thiết Kế Cấu Trúc Hoa Hồng',
      description_en:
        'Define tiered commission rates (e.g., 20% first sale, 10% recurring) and bonus thresholds.',
      description_vi:
        'Xác định tỷ lệ hoa hồng cấp bậc (vd: 20% cho đơn hàng đầu, 10% cho lặp lại) và ngưỡng thưởng.',
      tool: 'commission-builder',
      tool_config: { tiers: [{ min_sales: 0, rate: 0.2 }, { min_sales: 10, rate: 0.25 }], recurring_rate: 0.1 },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Create Affiliate Portal',
      name_vi: 'Tạo Cổng Affiliate',
      description_en:
        'Build a self-service affiliate dashboard where partners can access links, track referrals, and view earnings.',
      description_vi:
        'Xây dựng dashboard affiliate tự phục vụ nơi đối tác có thể truy cập link, theo dõi giới thiệu và xem thu nhập.',
      tool: 'portal-builder',
      tool_config: { template: 'affiliate-dashboard', include_reports: true, include_payout_history: true },
      estimated_minutes: 45,
      is_automated: false,
    },
    {
      order: 3,
      name_en: 'Generate Unique Affiliate Links',
      name_vi: 'Tạo Link Affiliate Độc Nhất',
      description_en:
        'Create tracked affiliate links with UTM parameters and unique partner codes for each affiliate.',
      description_vi:
        'Tạo link affiliate được theo dõi với UTM parameters và mã đối tác độc nhất cho mỗi affiliate.',
      tool: 'link-generator',
      tool_config: { domain: 'sophia.agencyos.network', add_utm: true, expiration_days: 90 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Onboard Affiliates',
      name_vi: 'Onboard Affiliates',
      description_en:
        'Invite new affiliates, provide welcome kit with marketing materials, and train on program mechanics.',
      description_vi:
        'Mời affiliate mới, cung cấp welcome kit với tài liệu marketing và đào tạo về cơ chế chương trình.',
      tool: 'crm',
      tool_config: { send_welcome_email: true, attach_marketing_kit: true, schedule_training: true },
      estimated_minutes: 20,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Track Referrals & Conversions',
      name_vi: 'Theo Dõi Giới Thiệu & Chuyển Đổi',
      description_en:
        'Monitor affiliate link clicks, signups, and paid conversions in real-time with attribution.',
      description_vi:
        'Theo dõi click link affiliate, đăng ký và chuyển đổi trả phí theo thời gian thực với attribution.',
      tool: 'analytics-tracker',
      tool_config: { attribution_window_days: 30, track_events: ['click', 'signup', 'purchase'] },
      estimated_minutes: 15,
      is_automated: true,
    },
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
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const AFFILIATE_MANAGEMENT_SOPS: SopDefinition[] = [
  affiliatePartnerProgram,
];
