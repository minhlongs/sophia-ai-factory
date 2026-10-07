# Báo cáo Brainstorming: Bộ 3 Phân hệ Mở rộng Niche Video & Affiliate Engine

**Ngày lập**: 2026-10-07  
**Mục tiêu**: Tối đa hóa doanh thu Affiliate SaaS Global & Crypto Global qua 3 phân hệ tự động hóa toàn diện.

---

## 1. Yêu cầu & Bối cảnh (Problem Statement)
Hệ thống sản xuất video (B-Roll, Audio Ducking, Hormozi Subtitles, Rotator, Compliance Overlays) và Webhook Postback đã hoàn tất. Để chuyển đổi thành một "cỗ máy in tiền tự động" (Autonomous Affiliate Flywheel), cần giải quyết 3 điểm nghẽn:
1. **Khâu đầu vào (Input)**: Tự động phát hiện sản phẩm / dự án hot (Trend Scraping & Auto-Discovery) thay vì nhập tay.
2. **Khâu chuyển đổi (Conversion Link)**: Trang đệm tối ưu hóa CTR, chống mất link affiliate trên TikTok/IG bio (Bio-Link & Bridge Page Engine).
3. **Khâu phân phối (Distribution)**: Tự động đẩy video đã render lên YouTube Shorts, TikTok, Instagram Reels với lịch đăng giãn cách tránh spam (Auto-Syndication & Publishing Pacing).

---

## 2. Thiết kế Kiến trúc 3 Phân hệ Chi tiết

### Phân hệ 1: Trend Scraping & Auto-Discovery Engine
- **Vị trí**: `src/tree/affiliate/discovery/` & `src/forest/cron/trend-scraper-cron.ts`
- **Chức năng**:
  - Quét ProductHunt RSS Feed / Trending SaaS API để lọc sản phẩm AI/Dev tools mới.
  - Quét CoinGecko Trending / DEX trending tokens để lọc các dự án có thanh khoản và khối lượng giao dịch cao.
  - Tự động gọi `createNicheVideoCampaignPlan()` và sinh kịch bản video tự động khi phát hiện trend đủ điều kiện.

### Phân hệ 2: Bio-Link & High-Converting Bridge Page Engine
- **Vị trí**: `src/tree/affiliate/bridge/` & `src/app/[locale]/bridge/[campaignId]/`
- **Chức năng**:
  - Giao diện siêu tốc (Edge SSR) hiển thị Thumbnail video, Countdown timer, Bullet points lợi ích, và nút CTA gắn link affiliate.
  - Hỗ trợ Dynamic Vanity Coupons (`SOPHIA20`, `CRYPTOVIP`).
  - Geo-Routing tự động chuyển hướng sang link affiliate hợp lệ theo quốc gia của người xem (VD: US redirect sang link tuân thủ FTC, VN redirect sang cổng hỗ trợ VN).

### Phân hệ 3: Multi-Platform Auto-Syndication & Pacing Engine
- **Vị trí**: `src/tree/social/syndication/` & `src/forest/inngest/functions/social-syndication-job.ts`
- **Chức năng**:
  - Quản lý OAuth Refresh Tokens cho YouTube Data API v3, TikTok Content Posting API, Instagram Graph API.
  - Queue phân phối giãn cách thông minh (Staggered Pacing: 45–90 phút giữa các video/kênh) để tăng reach tự nhiên và chống shadowban.
  - Tự động gán caption, hashtag và tracking link phù hợp với từng nền tảng.

---

## 3. Tiêu chí Hoàn thành & Quality Gates (Acceptance Criteria)
- Tuân thủ 100% 4 tầng kiến trúc sạch (`seed` -> `tree` -> `forest` -> `land` -> `app`).
- 0 lỗi TypeScript (`npm run type-check`).
- 0 lỗi vi phạm layer (`scripts/check-layer-boundaries.sh`).
- 100% tests thật trên Vitest (Unit & Integration tests).
- Đảm bảo triết lý BYOK và No-Code / No-Tech doctrine.
