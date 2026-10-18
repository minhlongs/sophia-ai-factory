/**
 * Step Definitions for AI Avatar Video Agency SOP
 *
 * @module land/operations/sop-billing-payouts-steps
 */

import type { SopStepDef } from './types';
import { AI_AVATAR_PRODUCTION_DELIVERY_STEPS } from './sop-billing-payouts-delivery-steps';

export const AI_AVATAR_VIDEO_AGENCY_STEPS: SopStepDef[] = [
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
  ...AI_AVATAR_PRODUCTION_DELIVERY_STEPS,
];
