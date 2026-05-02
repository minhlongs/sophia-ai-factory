/**
 * Welcome scripts for one-time bundle purchases.
 * Bilingual (Vi/En) — separate from onboarding scripts (which are subscription-based).
 * 1 credit = 1 video render.
 *
 * @module lib/video/one-time-welcome-script
 */

import type { OneTimeSku } from '@/types'

const SCRIPTS: Record<string, { vi: string; en: string }> = {
  STARTER_BUNDLE: {
    vi: `Chào mừng bạn đến với Sophia AI Factory! Bạn vừa kích hoạt Gói Khởi Đầu với ${10} video AI.

Với gói này, bạn có:
- 10 video AI sẵn sàng sử dụng
- Hiệu lực 12 tháng từ ngày thanh toán
- Tạo video tự động — không cần kỹ thuật

Mỗi video được tạo bằng AI HeyGen chuyên nghiệp, giọng nói tự nhiên, hình ảnh sắc nét.
Khi hết credits, bạn có thể mua thêm gói hoặc nâng cấp lên gói hàng tháng để có nhiều tính năng hơn.

Bắt đầu tạo video đầu tiên của bạn ngay tại Dashboard!`,

    en: `Welcome to Sophia AI Factory! You just activated the Starter Bundle with ${10} AI videos.

With this bundle, you get:
- 10 AI videos ready to use
- 12-month validity from purchase date
- Automated video creation — no technical skills needed

Each video is generated with professional HeyGen AI, natural voice, crisp visuals.
When credits run out, you can buy another bundle or upgrade to a monthly plan for more features.

Start creating your first video right now in the Dashboard!`,
  },
}

/**
 * Get bilingual welcome script for a one-time SKU.
 * Falls back to STARTER_BUNDLE script if SKU-specific one not found.
 *
 * @param sku - The one-time SKU
 * @param locale - User locale preference ('vi' | 'en'), defaults to 'vi'
 */
export function getOneTimeWelcomeScript(
  sku: OneTimeSku,
  locale: string = 'vi',
): string {
  const scripts = SCRIPTS[sku.id] ?? SCRIPTS['STARTER_BUNDLE']!
  const lang: 'vi' | 'en' = locale.startsWith('vi') ? 'vi' : 'en'
  return scripts[lang]
}
