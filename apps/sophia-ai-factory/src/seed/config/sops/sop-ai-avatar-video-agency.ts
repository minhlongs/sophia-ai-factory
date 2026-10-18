/**
 * SOP: AI Avatar Video Agency definition.
 *
 * @module seed/config/sops/sop-ai-avatar-video-agency
 */

import type { SopDefinition } from './sop-definition-types';
import { AI_AVATAR_AGENCY_PRODUCTION_STEPS } from './sop-ai-avatar-video-agency-production-steps';

// ── SOP 5: AI Avatar Video Agency ────────────────────────────────────────────

const aiAvatarVideoAgency: SopDefinition = {
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
    ...AI_AVATAR_AGENCY_PRODUCTION_STEPS,
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export { aiAvatarVideoAgency };
