/**
 * Production & delivery steps (Steps 6-10) for SOP: AI Avatar Video Agency.
 *
 * @module seed/config/sops/sop-ai-avatar-video-agency-production-steps
 */

import type { SopStepDef } from './sop-definition-types';

export const AI_AVATAR_AGENCY_PRODUCTION_STEPS: SopStepDef[] = [
  {
    order: 6,
    name_en: 'Script Writing',
    name_vi: 'Viết Kịch Bản',
    description_en:
      'Draft professional video scripts aligned with client brand voice and communication goals.',
    description_vi:
      'Soạn kịch bản video chuyên nghiệp phù hợp với giọng nói thương hiệu và mục tiêu truyền thông của khách hàng.',
    tool: 'ai-script-writer',
    tool_config: { model: 'openrouter', style: 'corporate', tone: 'professional' },
    estimated_minutes: 20,
    is_automated: true,
  },
  {
    order: 7,
    name_en: 'AI Avatar Generation',
    name_vi: 'Tạo AI Avatar',
    description_en:
      'Generate high-quality AI avatar videos with the approved script and selected avatar.',
    description_vi:
      'Tạo video AI avatar chất lượng cao với kịch bản đã được duyệt và avatar đã chọn.',
    tool: 'ai-avatar-generator',
    tool_config: { provider: 'd-id', quality: 'hd', background: 'branded' },
    estimated_minutes: 20,
    is_automated: true,
  },
  {
    order: 8,
    name_en: 'Brand Overlay / Editing',
    name_vi: 'Thêm Thương Hiệu / Chỉnh Sửa',
    description_en:
      'Add client logo, lower thirds, brand colors, and CTA overlays to the generated video.',
    description_vi:
      'Thêm logo khách hàng, lower thirds, màu sắc thương hiệu và overlay CTA vào video đã tạo.',
    tool: 'video-editor',
    tool_config: { add_logo: true, add_lower_thirds: true, add_cta: true },
    estimated_minutes: 20,
    is_automated: false,
  },
  {
    order: 9,
    name_en: 'Client Approval',
    name_vi: 'Phê Duyệt Của Khách Hàng',
    description_en:
      'Send video for client review via private portal with structured feedback collection.',
    description_vi:
      'Gửi video để khách hàng review qua cổng riêng tư với thu thập phản hồi có cấu trúc.',
    tool: 'review-portal',
    tool_config: { max_revisions: 2, approval_deadline_days: 5 },
    estimated_minutes: 30,
    is_automated: false,
  },
  {
    order: 10,
    name_en: 'Deliver + Monthly Retainer',
    name_vi: 'Bàn Giao + Hợp Đồng Tháng',
    description_en:
      'Deliver final files and offer a monthly retainer package for ongoing content production.',
    description_vi:
      'Bàn giao file cuối cùng và đề xuất gói hợp đồng tháng cho việc sản xuất nội dung liên tục.',
    tool: 'invoicing',
    tool_config: { offer_retainer: true, retainer_discount: 0.15, payment_methods: ['stripe'] },
    estimated_minutes: 20,
    is_automated: false,
  },
];
