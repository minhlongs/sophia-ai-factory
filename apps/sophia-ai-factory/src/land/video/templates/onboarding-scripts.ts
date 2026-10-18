/**
 * Templated Bilingual Onboarding Scripts for ENTERPRISE and MASTER tiers.
 *
 * @module land/video/templates/onboarding-scripts
 */

export const ONBOARDING_TIERS = new Set(['ENTERPRISE', 'MASTER']);

export const ONBOARDING_SCRIPTS: Record<string, { vi: string; en: string }> = {
  ENTERPRISE: {
    vi: `Chào mừng bạn đến với Sophia AI Factory! Chúng tôi rất vui mừng khi bạn chọn gói Premium.

Sophia AI Factory là nền tảng tạo video AI hàng đầu, giúp bạn tự động hóa toàn bộ quy trình sản xuất video từ A-Z.

Với gói Premium, bạn có thể:
- Tạo video không giới hạn mỗi tháng
- Sử dụng pipeline "Zero Manual" - tự động hoàn toàn
- Tích hợp API vào hệ thống của bạn
- Hỗ trợ 24/7 với Account Manager riêng

Hãy bắt đầu bằng cách truy cập Dashboard để tạo video đầu tiên của bạn. Chúng tôi luôn sẵn sàng hỗ trợ bạn qua Telegram @Sophia_Bbot hoặc email.`,

    en: `Welcome to Sophia AI Factory! We're excited to have you on the Premium plan.

Sophia AI Factory is the leading AI video creation platform that automates your entire video production pipeline from A to Z.

With the Premium plan, you get:
- Unlimited videos per month
- "Zero Manual" pipeline - fully automated
- API access to integrate with your systems
- 24/7 support with a dedicated Account Manager

Get started by visiting your Dashboard to create your first video. We're always here to help via Telegram @Sophia_Bbot or email.`,
  },
  MASTER: {
    vi: `Chào mừng bạn đến với Sophia AI Factory! Bạn đã sở hữu gói Master - gói cao cấp nhất.

Với gói Master, bạn sở hữu toàn bộ hệ thống:
- Mã nguồn đầy đủ
- Tùy chỉnh không giới hạn
- Hỗ trợ kỹ thuật ưu tiên
- Không phí hàng tháng - trả một lần duy nhất

Chúng tôi sẽ liên hệ với bạn trong 24h để bàn giao mã nguồn và hướng dẫn cài đặt chi tiết. Đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng hỗ trợ bạn.`,

    en: `Welcome to Sophia AI Factory! You now own the Master tier - our ultimate package.

With Master, you get full system ownership:
- Complete source code
- Unlimited customization
- Priority technical support
- No monthly fees - one-time payment

We'll contact you within 24 hours to deliver the source code and provide detailed installation guidance. Our technical team is ready to support you.`,
  },
};

export function getOnboardingScript(tier: string): string {
  const scripts = ONBOARDING_SCRIPTS[tier];
  if (!scripts) return ONBOARDING_SCRIPTS.ENTERPRISE!.vi;
  return scripts.vi; // Default to Vietnamese
}
