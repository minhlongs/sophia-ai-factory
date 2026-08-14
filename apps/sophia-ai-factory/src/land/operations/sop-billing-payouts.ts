/**
 * Billing & Payouts SOPs
 *
 * Contains SOP definitions for revenue operations, invoicing, and payment workflows:
 * - AI Avatar Video Agency (premium B2B service with retainers)
 *
 * @module land/operations/sop-billing-payouts
 */

import type { SopDefinition } from './types';

// ── SOP 5: AI Avatar Video Agency ────────────────────────────────────────────

export const aiAvatarVideoAgency: SopDefinition = {
  slug: 'ai-avatar-video-agency',
  name_en: 'AI Avatar Video Agency',
  name_vi: 'Agency Video AI Avatar',
  description_en:
    'Launch a premium AI avatar video agency targeting corporate clients who need spokesperson videos, training content, and multilingual communications at scale — without hiring actors.',
  description_vi:
    'Ra mắt agency video AI avatar cao cấp nhắm vào khách hàng doanh nghiệp cần video người phát ngôn, nội dung đào tạo và truyền thông đa ngôn ngữ quy mô lớn — không cần thuê diễn viên.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 10000,
  estimated_revenue_max: 50000,
  setup_time_minutes: 240,
  credits_per_run: 20,
  steps: [
    {
      order: 1,
      name_en: 'Define Service Tiers',
      name_vi: 'Xác Định Cấp Dịch Vụ',
      description_en:
        'Create Starter / Professional / Enterprise packages with deliverables, turnaround time, and pricing for each.',
      description_vi:
        'Tạo gói Starter / Professional / Enterprise với kết quả bàn giao, thời gian hoàn thành và định giá cho từng gói.',
      tool: 'template-builder',
      tool_config: { template: 'agency-tiers', include_sla: true },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Create Demo Reel (AI Avatars)',
      name_vi: 'Tạo Demo Reel (AI Avatar)',
      description_en:
        'Produce a 2-minute demo reel showcasing diverse AI avatars across corporate, educational, and multilingual use cases.',
      description_vi:
        'Sản xuất demo reel 2 phút thể hiện các AI avatar đa dạng trong các trường hợp sử dụng doanh nghiệp, giáo dục và đa ngôn ngữ.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', avatars: ['professional-male', 'professional-female', 'asian', 'multilingual'], duration: 120 },
      estimated_minutes: 45,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Build Agency Website',
      name_vi: 'Xây Dựng Website Agency',
      description_en:
        'Launch a one-page agency website with demo reel, service packages, testimonials, and contact form.',
      description_vi:
        'Ra mắt website agency một trang với demo reel, gói dịch vụ, testimonial và form liên hệ.',
      tool: 'website-builder',
      tool_config: { template: 'agency', include_demo: true, include_pricing: true },
      estimated_minutes: 60,
      is_automated: false,
    },
    {
      order: 4,
      name_en: 'LinkedIn / Cold Email Outreach',
      name_vi: 'Tiếp Cận LinkedIn / Email Lạnh',
      description_en:
        'Run targeted outreach to HR directors, L&D managers, and marketing VPs at mid-market companies.',
      description_vi:
        'Chạy tiếp cận có mục tiêu đến giám đốc HR, quản lý L&D và VP Marketing tại các công ty tầm trung.',
      tool: 'outreach-tool',
      tool_config: { platforms: ['linkedin', 'email'], target_roles: ['HR Director', 'L&D Manager', 'VP Marketing'], daily_limit: 30 },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Client Onboarding',
      name_vi: 'Onboarding Khách Hàng',
      description_en:
        'Collect brand kit, script preferences, avatar selection, and language requirements.',
      description_vi:
        'Thu thập bộ nhận diện thương hiệu, sở thích kịch bản, lựa chọn avatar và yêu cầu ngôn ngữ.',
      tool: 'crm',
      tool_config: { send_onboarding_kit: true, collect_brand_assets: true },
      estimated_minutes: 30,
      is_automated: false,
    },
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
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const BILLING_PAYOUTS_SOPS: SopDefinition[] = [
  aiAvatarVideoAgency,
];
