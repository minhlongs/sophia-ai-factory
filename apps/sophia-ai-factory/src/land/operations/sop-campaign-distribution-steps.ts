/**
 * Step Definitions for UGC Creator Agency SOP
 *
 * @module land/operations/sop-campaign-distribution-steps
 */

import type { SopStepDef } from './types';
import { UGC_PRODUCTION_DELIVERY_STEPS } from './sop-campaign-distribution-production-steps';

export const UGC_CREATOR_AGENCY_STEPS: SopStepDef[] = [
  {
    order: 1,
    name_en: 'Define Service Packages',
    name_vi: 'Xác Định Gói Dịch Vụ',
    description_en:
      'Create 3 service tiers (Starter / Growth / Pro) with clear deliverables and pricing.',
    description_vi:
      'Tạo 3 cấp dịch vụ (Starter / Growth / Pro) với kết quả bàn giao và định giá rõ ràng.',
    tool: 'template-builder',
    tool_config: { template: 'ugc-packages', tiers: 3 },
    estimated_minutes: 30,
    is_automated: false,
  },
  {
    order: 2,
    name_en: 'Create Portfolio',
    name_vi: 'Tạo Portfolio',
    description_en:
      'Produce 3–5 sample UGC videos using AI avatars to showcase agency capabilities.',
    description_vi:
      'Sản xuất 3–5 video UGC mẫu bằng AI avatar để thể hiện năng lực của agency.',
    tool: 'ai-avatar-generator',
    tool_config: { provider: 'd-id', style: 'ugc-ad', count: 5 },
    estimated_minutes: 60,
    is_automated: true,
  },
  {
    order: 3,
    name_en: 'Set Up Client Intake Form',
    name_vi: 'Thiết Lập Form Tiếp Nhận Khách Hàng',
    description_en:
      'Create a branded intake form to collect brief, brand assets, and payment from new clients.',
    description_vi:
      'Tạo form tiếp nhận có thương hiệu để thu thập brief, tài sản thương hiệu và thanh toán từ khách hàng mới.',
    tool: 'form-builder',
    tool_config: { fields: ['brand_name', 'brief', 'target_audience', 'budget', 'assets'] },
    estimated_minutes: 20,
    is_automated: false,
  },
  {
    order: 4,
    name_en: 'Prospect via DM Outreach',
    name_vi: 'Tìm Kiếm Khách Qua DM',
    description_en:
      'Send personalized DM pitches to 20+ DTC brand founders on Instagram and LinkedIn daily.',
    description_vi:
      'Gửi tin nhắn pitch cá nhân hóa cho 20+ nhà sáng lập thương hiệu DTC trên Instagram và LinkedIn mỗi ngày.',
    tool: 'outreach-tool',
    tool_config: { platforms: ['instagram', 'linkedin'], daily_limit: 20, personalize: true },
    estimated_minutes: 30,
    is_automated: false,
  },
  {
    order: 5,
    name_en: 'Client Onboarding',
    name_vi: 'Onboarding Khách Hàng',
    description_en:
      'Welcome new client, confirm scope, collect assets, and set timeline expectations.',
    description_vi:
      'Chào đón khách hàng mới, xác nhận phạm vi, thu thập tài sản và thiết lập kỳ vọng về timeline.',
    tool: 'crm',
    tool_config: { send_welcome_email: true, create_project_folder: true },
    estimated_minutes: 20,
    is_automated: false,
  },
  ...UGC_PRODUCTION_DELIVERY_STEPS,
];
