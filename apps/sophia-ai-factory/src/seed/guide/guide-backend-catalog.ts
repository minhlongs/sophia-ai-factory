/**
 * guide-backend-catalog.ts
 * Canonical bilingual catalog for the 5-stage visual pipeline and 8 backend pillars.
 * Layer: seed/guide
 */

import type { BackendPillar, PipelineStage } from './guide-backend-pillars';

export const GUIDE_BACKEND_STATS = {
  apiRoutesCount: 350,
  inngestJobsCount: 132,
  d1MigrationsCount: 434,
  productionFilesCount: 7384,
  affiliateNetworksCount: 10,
  publishingChannelsCount: 11,
  supportedNichesCount: 51,
} as const;

export const GUIDE_PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    step: 1,
    name: { vi: 'Thiết Lập BYOK & Ví Thanh Toán', en: 'BYOK & Settlement Wallet Setup' },
    subtitle: { vi: 'Nhập khóa API 1 lần duy nhất tại Setup Wizard', en: 'One-time encrypted key onboarding in Setup Wizard' },
    input: {
      vi: 'Khóa OpenRouter, ElevenLabs, HeyGen/D-ID, fal.ai, Replicate & ví nhận USDT/Bank',
      en: 'OpenRouter, ElevenLabs, HeyGen/D-ID, fal.ai, Replicate keys & USDT/Bank payout wallet',
    },
    engine: {
      vi: 'Mã hóa đối xứng trên Cloudflare D1 + Circuit Breaker chống lỗi tự động',
      en: 'Symmetric encryption on Cloudflare D1 + automatic Circuit Breaker protection',
    },
    output: {
      vi: 'Workspace sẵn sàng 100% với chi phí AI giá gốc (0% markup)',
      en: 'Workspace 100% ready at direct provider cost (0% platform markup)',
    },
    sampleCommand: 'POST /api/setup-wizard/save-credentials',
    sampleResult: '{"ready":true,"encryptedProviders":6,"circuitState":"CLOSED"}',
  },
  {
    step: 2,
    name: { vi: 'AI Săn Kèo & Khởi Tạo Shortlink', en: 'Agentic Offer Discovery & Shortlink' },
    subtitle: { vi: 'Quét 10 mạng lưới Affiliate toàn cầu (Domain A & Domain B)', en: 'Scan 10 global Affiliate networks (Domain A & Domain B)' },
    input: {
      vi: 'Chọn 1 trong 51 ngách hoặc gõ lệnh /discover trên Telegram @Sophia_Bbot',
      en: 'Pick from 51 verticals or run /discover via Telegram @Sophia_Bbot',
    },
    engine: {
      vi: 'Agentic Discovery Wave chấm điểm EPC, lọc scam gate & gắn mã SubID',
      en: 'Agentic Discovery Wave scores EPC, runs scam gate & binds SubID tracking',
    },
    output: {
      vi: 'Danh sách Offer chuyển đổi cao kèm link rút gọn /r/{code} định danh riêng',
      en: 'High-converting offers with dedicated /r/{code} edge tracking shortlinks',
    },
    sampleCommand: 'POST /api/affiliate-discovery {"niche":"saas","minScore":0.75}',
    sampleResult: '{"qualifiedCount":15,"topOffer":"PartnerStack AI CRM (40% recurring)"}',
  },
  {
    step: 3,
    name: { vi: 'Dựng Video Hybrid Scene-Graph', en: 'Hybrid Scene-Graph Video Rendering' },
    subtitle: { vi: 'Kết hợp AI Avatar, Voiceover & Đồ họa Edge SVG 0% Hallucination', en: 'Combines AI Avatar, Voiceover & 0% Hallucination Edge SVG Cards' },
    input: {
      vi: 'Chủ đề chiến dịch + Offer đã chọn (hoặc gõ /campaign trên Telegram)',
      en: 'Campaign topic + selected offer (or /campaign command on Telegram)',
    },
    engine: {
      vi: 'Inngest điều phối kịch bản SEO, giọng đọc, B-roll & biểu đồ SVG chuẩn số liệu',
      en: 'Inngest orchestrates SEO script, voiceover, B-roll & exact SVG data charts',
    },
    output: {
      vi: 'File MP4 hoàn chỉnh kèm phụ đề động .vtt, watermark & 3 phương án Thumbnail A/B',
      en: 'Mastered MP4 with dynamic .vtt captions, watermark & 3 A/B Thumbnails',
    },
    sampleCommand: 'POST /api/v1/video/autonomous {"niche":"fintech","offerId":"ps_01"}',
    sampleResult: '{"status":"COMPLETED","durationSec":58,"svgDataCards":3,"hallucination":0}',
  },
  {
    step: 4,
    name: { vi: 'Cổng Duyệt CEO (SHA-256) & Đăng 11 Kênh', en: 'CEO SHA-256 Gate & 11-Channel Publish' },
    subtitle: { vi: 'Kiểm duyệt chống sửa đổi ngầm & lọc pháp lý tự động theo quốc gia', en: 'Tamper-proof approval hash & automated jurisdiction compliance' },
    input: {
      vi: 'Bản nháp Video + Caption gắn link + Quốc gia mục tiêu (US, EU, JP, VN, SG)',
      en: 'Draft Video + Affiliate Caption + Target Jurisdiction (US, EU, JP, VN, SG)',
    },
    engine: {
      vi: 'Khóa mã băm payload_sha256 + Geo-Fencing (chặn VN/SG cho Crypto, gắn nhãn FTC/MiCA)',
      en: 'Locks payload_sha256 hash + Geo-Fencing (blocks VN/SG for Crypto, injects FTC/MiCA)',
    },
    output: {
      vi: 'Tự động đăng đồng loạt lên YouTube, TikTok, Instagram, Facebook, X, LinkedIn...',
      en: 'Auto-published across YouTube, TikTok, Instagram, Facebook, X, LinkedIn...',
    },
    sampleCommand: 'POST /api/publish/approve {"approvalId":"apr_99","payloadSha256":"8f4e..."}',
    sampleResult: '{"verified":true,"compliance":"FTC_CFTC_INJECTED","publishedChannels":11}',
  },
  {
    step: 5,
    name: { vi: 'Đối Soát S2S & Thu Hoa Hồng 100%', en: 'S2S Reconciliation & 100% Payouts' },
    subtitle: { vi: 'Sổ cái bất biến Domain B (0% phí nền tảng) & Báo cáo về điện thoại', en: 'Immutable Domain B ledger (0% platform fee) & instant phone alerts' },
    input: {
      vi: 'Khách nhấp link /r/{code} và thanh toán trên sàn/nhà cung cấp (PartnerStack, Binance...)',
      en: 'Audience clicks /r/{code} and converts on provider (PartnerStack, Binance...)',
    },
    engine: {
      vi: 'Xác thực chữ ký S2S HMAC-SHA256 + Ghi sổ cái bất biến (pending → approved → paid)',
      en: 'Verifies S2S HMAC-SHA256 signature + Immutable ledger (pending → approved → paid)',
    },
    output: {
      vi: '100% hoa hồng chảy thẳng về ví của bạn + Tin nhắn báo số dư qua @Sophia_Bbot',
      en: '100% commission credited to your workspace + Realtime alert via @Sophia_Bbot',
    },
    sampleCommand: 'POST /api/postback/partnerstack (X-PartnerStack-Signature: HMAC-SHA256)',
    sampleResult: '{"ok":true,"commissionCents":4500,"platformFeeCents":0,"status":"approved"}',
  },
];
