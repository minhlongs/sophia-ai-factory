/**
 * Step Definitions for Affiliate Partner Program SOP
 *
 * @module land/operations/sop-affiliate-management-steps
 */

import type { SopStepDef } from './types';
import { AFFILIATE_PAYOUT_GOVERNANCE_STEPS } from './sop-affiliate-management-payout-steps';

export const AFFILIATE_PARTNER_PROGRAM_STEPS: SopStepDef[] = [
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
  ...AFFILIATE_PAYOUT_GOVERNANCE_STEPS,
];
