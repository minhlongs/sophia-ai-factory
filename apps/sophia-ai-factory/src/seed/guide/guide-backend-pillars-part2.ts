/**
 * guide-backend-pillars-part2.ts
 * Pillars 5 to 8: Geo-Compliance, 11-Channel Publishing, Telegram Ops, MCU Economics.
 * Layer: seed/guide
 */

import type { BackendPillar } from './guide-backend-pillars';

export const GUIDE_BACKEND_PILLARS_PART2: readonly BackendPillar[] = [
  {
    id: 'geo-compliance',
    number: 5,
    icon: '⚖️',
    badge: 'Fail-Closed An Toàn',
    title: {
      vi: 'Tuân Thủ Pháp Lý & Geo-Fencing',
      en: 'Compliance & Geo-Fencing Engine',
    },
    tag: {
      vi: 'Bảo Vệ Tài Khoản Đa Quốc Gia',
      en: 'Multi-Jurisdiction Account Shield',
    },
    description: {
      vi: 'Hệ thống tự động điều chỉnh theo luật pháp quốc tế của từng quốc gia tiếp cận để bảo vệ kênh truyền thông và doanh nghiệp khỏi nguy cơ vi phạm pháp luật.',
      en: 'The engine dynamically complies with international regulations to protect creator channels and businesses from regulatory strikes.',
    },
    capabilities: [
      { vi: 'Chặn cứng nội dung Crypto tại Việt Nam (NĐ 52/2024/NĐ-CP) và Singapore (MAS Notice PSN08)', en: 'Strict ban on Crypto in Vietnam (Decree 52/2024/NĐ-CP) & Singapore (MAS Notice PSN08)' },
      { vi: 'Chặn hoàn toàn kênh Zalo cho các nội dung tài chính nhạy cảm', en: 'Complete block of Zalo channel for sensitive financial and crypto offers' },
      { vi: 'Tự động chèn công bố tài trợ bắt buộc: FTC + CFTC 4.41 (US), MiCA Art. 7/53 (EU), FSA (JP)', en: 'Mandatory disclaimer injection: FTC + CFTC 4.41 (US), MiCA Art. 7/53 (EU), FSA (JP)' },
    ],
    representativeRoutes: [
      '/api/v1/settings/geo',
      '/api/violations',
      '/api/provenance',
    ],
    representativeJobs: [
      'affiliate-nightly-risk.ts',
      'culture-injector-job.ts',
    ],
    safetyPillar: {
      vi: 'Triết lý Fail-Closed: Bất kỳ quốc gia hay liên kết nào chưa xác minh rủi ro đều bị chặn mặc định.',
      en: 'Fail-Closed Philosophy: Any unassessed jurisdiction or offer is blocked by default.',
    },
  },
  {
    id: 'omnichannel-publish',
    number: 6,
    icon: '📡',
    badge: '11 Nền Tảng Đồng Thời',
    title: {
      vi: 'Phân Phối Đa Nền Tảng 11 Kênh',
      en: '11-Channel Omnichannel Publishing',
    },
    tag: {
      vi: 'Tự Động Lên Lịch Đa Nền Tảng',
      en: 'Automated Multi-Platform Scheduling',
    },
    description: {
      vi: 'Một cú nhấp chuột hoặc một lệnh Telegram để phân phối video đồng loạt lên toàn bộ các mạng xã hội video ngắn và mạng xã hội lớn nhất thế giới.',
      en: 'A single click or Telegram command publishes videos simultaneously across all major global short-form video and social networks.',
    },
    capabilities: [
      { vi: 'Hỗ trợ YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, X (Twitter), LinkedIn, Pinterest, Threads, Bluesky, Mastodon, Zalo', en: 'Supports YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, X (Twitter), LinkedIn, Pinterest, Threads, Bluesky, Mastodon, Zalo' },
      { vi: 'Tự động tạo bình luận ghim (Pinned Comment) chứa shortlink affiliate để tối đa hóa click', en: 'Auto-generates pinned comments with affiliate shortlinks to maximize CTR' },
      { vi: 'Hàng đợi xuất bản tự phục hồi với cơ chế Retry lũy tiến và phân tán khung giờ vàng', en: 'Self-healing publishing queue with exponential backoff retry and peak-hour distribution' },
    ],
    representativeRoutes: [
      '/api/publish/schedule',
      '/api/publish/queue',
      '/api/publish/channels',
      '/api/v1/videos/[id]/distribute',
    ],
    representativeJobs: [
      'social-direct-publish-job.ts',
      'fleet-stagger-publish-job.ts',
      'distribution-fanout.ts',
    ],
    safetyPillar: {
      vi: 'Phân tán tần suất: Giữ khoảng cách giữa các lần đăng để không bị các nền tảng đánh dấu spam.',
      en: 'Staggered Publishing: Paces uploads to prevent social network anti-spam throttling.',
    },
  },
  {
    id: 'telegram-ops',
    number: 7,
    icon: '🤖',
    badge: 'Điều Hành Không Cần Laptop',
    title: {
      vi: 'Trạm Điều Hành Di Động Telegram (@Sophia_Bbot)',
      en: 'Mobile Command Center (@Sophia_Bbot)',
    },
    tag: {
      vi: 'FSM State-Machine Tự Động',
      en: 'Automated FSM State-Machine',
    },
    description: {
      vi: 'Khách hàng có thể điều hành toàn bộ nhà máy ngay trên điện thoại qua Telegram Bot. Tạo chiến dịch, xem số dư, duyệt video chỉ bằng tin nhắn chat.',
      en: 'Customers run the entire factory right from their smartphone via Telegram Bot. Create campaigns, check revenue, and approve videos with simple chat commands.',
    },
    capabilities: [
      { vi: 'Đầy đủ lệnh nghiệp vụ: /campaign, /status, /results, /discover, /payout, /missions, /ticket, /subscribe, /email, /analytics', en: 'Full command set: /campaign, /status, /results, /discover, /payout, /missions, /ticket, /subscribe, /email, /analytics' },
      { vi: 'Bàn phím tương tác Inline Keyboards hỗ trợ xem video mẫu và bấm duyệt một chạm', en: 'Interactive Inline Keyboards for one-tap video preview and approval' },
      { vi: 'Cảnh báo tự động về điện thoại khi có hoa hồng mới hoặc khi số dư tài khoản sắp hết', en: 'Real-time push alerts for new affiliate commissions and low balance warnings' },
    ],
    representativeRoutes: [
      '/api/webhooks/telegram',
      '/api/stream/campaigns/[id]',
      '/api/stats/live',
    ],
    representativeJobs: [
      'ops-telegram-alert.ts',
      'analytics-sync.ts',
    ],
    safetyPillar: {
      vi: 'Luồng bảo vệ bất khả xâm phạm: Webhook Telegram được bảo vệ nghiêm ngặt, không bao giờ ngắt kết nối.',
      en: 'Protected Flow: Telegram bot webhook is monitored and protected from regressions.',
    },
  },
  {
    id: 'economics-settlement',
    number: 8,
    icon: '⚡',
    badge: 'Đơn Vị Tính Toán MCU',
    title: {
      vi: 'Thanh Toán USDT & Kinh Tế Học MCU',
      en: 'USDT Settlement & MCU Economics',
    },
    tag: {
      vi: 'Thanh Toán Tiền Tệ Tự Động',
      en: 'Automated Multi-Currency Billing',
    },
    description: {
      vi: 'Mô hình kinh tế số hóa minh bạch. Thanh toán gói dịch vụ bằng tiền mã hóa USDT (NOWPayments) hoặc nội địa (PayOS), quy đổi thành MCU (Mission Compute Units).',
      en: 'Transparent tokenomics. Settle subscriptions with USDT (NOWPayments) or domestic PayOS, denominated in Mission Compute Units (MCU).',
    },
    capabilities: [
      { vi: 'Thanh toán tức thì không phụ thuộc cổng ngân hàng truyền thống qua NOWPayments IPN', en: 'Instant settlement bypasses legacy banking delays via NOWPayments IPN' },
      { vi: '4 gói cước chuẩn mực: BASIC ($199), PREMIUM ($399), ENTERPRISE ($799), MASTER ($4999)', en: '4 clear tiers: BASIC ($199), PREMIUM ($399), ENTERPRISE ($799), MASTER ($4999)' },
      { vi: 'Cơ chế tính phí vượt hạn mức (Overage Billing) và bù trừ dunning tự động, không khóa tài khoản đột ngột', en: 'Graceful Overage Billing and automated dunning with zero sudden account locks' },
    ],
    representativeRoutes: [
      '/api/checkout',
      '/api/webhooks/nowpayments',
      '/api/webhooks/payos',
      '/api/user/billing-history',
    ],
    representativeJobs: [
      'd1-lock-reaper.ts',
      'dlq-reaper.ts',
    ],
    safetyPillar: {
      vi: 'Khóa nguyên tử D1 Atomic Lock: Chống thanh toán trùng lặp (Double-spend) và chống gian lận IPN.',
      en: 'D1 Atomic Lock: Anti-replay, anti-double-spend idempotency on all IPN webhooks.',
    },
  },
];
