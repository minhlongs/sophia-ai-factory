/**
 * Production, Review & Delivery Steps (6–10) for UGC Creator Agency SOP
 *
 * @module land/operations/sop-campaign-distribution-production-steps
 */

import type { SopStepDef } from './types';

export const UGC_PRODUCTION_DELIVERY_STEPS: SopStepDef[] = [
  {
    order: 6,
    name_en: 'Script per Brief',
    name_vi: 'Viết Kịch Bản Theo Brief',
    description_en:
      'Generate a UGC ad script tailored to the client brief and target audience.',
    description_vi:
      'Tạo kịch bản quảng cáo UGC phù hợp với brief khách hàng và đối tượng mục tiêu.',
    tool: 'ai-script-writer',
    tool_config: { model: 'openrouter', style: 'ugc-ad', include_hook_variations: 3 },
    estimated_minutes: 15,
    is_automated: true,
  },
  {
    order: 7,
    name_en: 'Record / Generate UGC Video',
    name_vi: 'Quay / Tạo Video UGC',
    description_en:
      'Produce the UGC video using AI avatar or self-record depending on client preference.',
    description_vi:
      'Sản xuất video UGC bằng AI avatar hoặc tự quay tùy theo sở thích khách hàng.',
    tool: 'ai-avatar-generator',
    tool_config: { provider: 'd-id', style: 'ugc', aspect_ratios: ['9:16', '1:1', '16:9'] },
    estimated_minutes: 30,
    is_automated: true,
  },
  {
    order: 8,
    name_en: 'Client Review Cycle',
    name_vi: 'Chu Kỳ Review Của Khách Hàng',
    description_en:
      'Share draft via private link and collect feedback for up to 2 revision rounds.',
    description_vi:
      'Chia sẻ bản nháp qua link riêng tư và thu thập phản hồi cho tối đa 2 vòng chỉnh sửa.',
    tool: 'review-portal',
    tool_config: { max_revisions: 2, feedback_form: true, expiry_days: 3 },
    estimated_minutes: 20,
    is_automated: false,
  },
  {
    order: 9,
    name_en: 'Deliver Finals',
    name_vi: 'Bàn Giao Bản Cuối',
    description_en:
      'Export and deliver final video files in all required formats and ratios.',
    description_vi:
      'Xuất và bàn giao file video cuối cùng ở tất cả định dạng và tỷ lệ yêu cầu.',
    tool: 'file-delivery',
    tool_config: { formats: ['mp4'], ratios: ['9:16', '1:1', '16:9'], via: 'google-drive' },
    estimated_minutes: 15,
    is_automated: true,
  },
  {
    order: 10,
    name_en: 'Invoice + Collect Payment',
    name_vi: 'Xuất Hóa Đơn + Thu Tiền',
    description_en:
      'Send invoice and collect payment upon delivery completion.',
    description_vi:
      'Gửi hóa đơn và thu tiền khi hoàn thành bàn giao.',
    tool: 'invoicing',
    tool_config: { payment_methods: ['stripe', 'paypal', 'bank-transfer'], auto_reminder: true },
    estimated_minutes: 10,
    is_automated: false,
  },
];
