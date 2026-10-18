/**
 * Platform Publish Payload Builder for Autonomous Swarm Syndication
 *
 * @module tree/autonomous/swarm-platform-payloads
 */

import type { ApacMarket } from './swarm-types';
import type { PlatformPublishPayload } from './swarm-auto-publisher';

export function buildPlatformPublishPayload(
  platform: 'youtube' | 'tiktok' | 'instagram',
  utmUrl: string,
  scheduledTimeUtc: string,
  market: ApacMarket,
): PlatformPublishPayload {
  if (platform === 'youtube') {
    return {
      platform: 'youtube',
      title: `Tự Động Hoá Kênh Video Với AI 2026 | Sophia AI Factory`,
      caption: `Hướng dẫn từng bước triển khai hệ thống AI tự động hóa sản xuất video và tiếp thị liên kết.\n\nĐăng ký trải nghiệm: ${utmUrl}\n\n⚠️ Tuyên bố tiếp thị: Video này có chứa đường dẫn tiếp thị liên kết theo chuẩn FTC/YouTube.`,
      aspectRatio: '16:9',
      tags: ['SophiaAI', 'TuDongHoa', 'KiemTienOnline', 'AffiliateMarketing', 'AI2026'],
      utmUrl,
      scheduledTimeUtc,
      targetMarket: market,
    };
  }
  if (platform === 'tiktok') {
    return {
      platform: 'tiktok',
      title: `AI Video Factory 24/7`,
      caption: `3 bước tự động hóa kênh không cần quay hình 🚀 Thử ngay tại link tiểu sử! #sophiaai #kiemtienonline #automation #learnontiktok`,
      aspectRatio: '9:16',
      tags: ['sophiaai', 'kiemtienonline', 'automation', 'learnontiktok'],
      utmUrl,
      scheduledTimeUtc,
      targetMarket: market,
    };
  }
  return {
    platform: 'instagram',
    title: `Sophia AI Reels`,
    caption: `Bí mật tạo chuỗi video viral tự động 24/7. Nhấp vào liên kết trong bio để nhận tài liệu miễn phí! 📲\n\n#SophiaAI #PassiveIncome #MarketingAutomation`,
    aspectRatio: '9:16',
    tags: ['SophiaAI', 'PassiveIncome', 'MarketingAutomation', 'Reels'],
    utmUrl,
    scheduledTimeUtc,
    targetMarket: market,
  };
}
