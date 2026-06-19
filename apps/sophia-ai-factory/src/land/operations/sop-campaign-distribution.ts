/**
 * Campaign Distribution SOPs
 *
 * Contains SOP definitions for campaign management and content distribution workflows:
 * - UGC Creator Agency (content distribution for brands)
 *
 * @module land/operations/sop-campaign-distribution
 */

import type { SopDefinition, SopStepDef } from './types';

// ── SOP 4: UGC Creator Agency ────────────────────────────────────────────────

export const ugcCreatorAgency: SopDefinition = {
  slug: 'ugc-creator-agency',
  name_en: 'UGC Creator Agency',
  name_vi: 'Agency Tạo Nội Dung UGC',
  description_en:
    'Start and scale a User-Generated Content (UGC) agency that produces authentic-looking ad videos for brands. Charge per video or on a monthly retainer using AI-assisted production.',
  description_vi:
    'Khởi động và mở rộng agency nội dung UGC sản xuất video quảng cáo có vẻ chân thực cho thương hiệu. Tính phí theo video hoặc hợp đồng tháng với sản xuất hỗ trợ AI.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 5000,
  estimated_revenue_max: 20000,
  setup_time_minutes: 180,
  credits_per_run: 20,
  steps: [
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
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const CAMPAIGN_DISTRIBUTION_SOPS: SopDefinition[] = [
  ugcCreatorAgency,
];
