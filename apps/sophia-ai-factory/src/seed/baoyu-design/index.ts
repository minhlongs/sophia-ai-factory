/**
 * Baoyu-Design × Sophia AI Factory — Seed Barrel & Canonical Presets
 *
 * @module seed/baoyu-design
 */

export * from './baoyu-schema-types';
export * from './oklch-palette-validator';

import type {
  BaoyuArtboardPreset,
  BaoyuCommentItem,
  BaoyuDataSourceTrace,
  BaoyuTweakPropSpec,
} from './baoyu-schema-types';

export const SOPHIA_STUDIO_ARTBOARDS: readonly BaoyuArtboardPreset[] = [
  {
    id: 'shorts_9_16',
    file: 'ShortsVertical.dc.html',
    aspectRatio: '9:16',
    dimensions: '1080×1920',
    titleVi: '01. YouTube Shorts / Reels (9:16)',
    titleEn: '01. YouTube Shorts / Reels (9:16)',
    hookVi: 'Phí giao dịch CEX ẩn & cách kiểm chứng bằng sổ cái không lưu ký.',
    hookEn: 'Hidden CEX trading fees & how to verify via non-custodial ledger.',
    ctaVi: 'Xem bảng đối soát minh bạch dưới mô tả',
    ctaEn: 'Inspect the verified fee breakdown in description',
  },
  {
    id: 'youtube_16_9',
    file: 'YouTubeWidescreen.dc.html',
    aspectRatio: '16:9',
    dimensions: '1920×1080',
    titleVi: '02. Video Phân Tích Chuyên Sâu (16:9)',
    titleEn: '02. Deep-Dive Review Video (16:9)',
    hookVi: 'So sánh toàn diện chương trình Affiliate CEX & Global SaaS năm 2026.',
    hookEn: 'Complete 2026 CEX & Global SaaS Affiliate Program Walkthrough.',
    ctaVi: 'Bản nháp $0.00 • Chờ chữ ký SHA-256 CEO',
    ctaEn: '$0.00 AI Draft • Awaiting CEO SHA-256 Signature',
  },
  {
    id: 'social_1_1',
    file: 'ThumbnailCard.dc.html',
    aspectRatio: '1:1',
    dimensions: '1080×1080',
    titleVi: '03. Thumbnail & Thẻ Cộng Đồng (1:1)',
    titleEn: '03. Thumbnail & Community Card (1:1)',
    hookVi: 'Bằng chứng đối soát S2S Postback • 0% Phí Nền Tảng.',
    hookEn: 'Verified S2S Postback Evidence • 0% Platform Fee.',
    ctaVi: 'Đã gắn nhãn công bố FTC / MiCA / Nghị định 52',
    ctaEn: 'FTC / MiCA / VN Decree 52 Disclosure Attached',
  },
] as const;

export const SOPHIA_STUDIO_TWEAK_PROPS: readonly BaoyuTweakPropSpec[] = [
  {
    key: 'accentColor',
    labelVi: 'Màu nhấn thương hiệu (OKLCH)',
    labelEn: 'Brand Accent Color (OKLCH)',
    editor: 'select',
    defaultValue: '#6366f1',
    options: ['#6366f1', '#f59e0b', '#10b981'],
  },
  {
    key: 'displayWidth',
    labelVi: 'Độ rộng chữ Archivo (wdth)',
    labelEn: 'Archivo Display Width (wdth)',
    editor: 'number',
    defaultValue: 104,
    min: 100,
    max: 112,
  },
  {
    key: 'showComplianceBadge',
    labelVi: 'Hiển thị nhãn pháp lý (FTC / MiCA / NĐ52)',
    labelEn: 'Show Compliance Disclosure (FTC / MiCA / VN52)',
    editor: 'boolean',
    defaultValue: true,
  },
] as const;

export const SOPHIA_INITIAL_CANVAS_COMMENTS: readonly BaoyuCommentItem[] = [
  {
    id: 'cmt-1',
    artboardId: 'shorts_9_16',
    author: 'CEO Operator',
    textVi: 'Giữ nhãn công bố FTC/Nghị định 52 ở 3 giây đầu trước khi duyệt SHA-256.',
    textEn: 'Keep the FTC/Decree 52 disclosure in the first 3 seconds before SHA-256 lock.',
    resolved: false,
    createdAt: '2026-11-07T18:00:00Z',
  },
  {
    id: 'cmt-2',
    artboardId: 'youtube_16_9',
    author: 'Sophia Compliance Guard',
    textVi: 'Đã khóa mức phí nháp $0.00. Chỉ gọi ElevenLabs/HeyGen sau khi CEO ký duyệt.',
    textEn: 'Draft locked at $0.00 spend. ElevenLabs/HeyGen synthesis waits for CEO signature.',
    resolved: true,
    createdAt: '2026-11-07T18:02:00Z',
  },
] as const;

export const SOPHIA_DASHBOARD_SOURCE_TRACES: readonly BaoyuDataSourceTrace[] = [
  {
    id: 'src-revenue',
    metricLabelVi: 'Tổng Hoa Hồng Đã Đối Soát',
    metricLabelEn: 'Net Reconciled Commission',
    d1Table: 'd1.affiliate_conversions',
    queryColumn: 'SUM(net_commission_usd) WHERE status = "verified"',
    verificationMechanism: 'S2S Postback HMAC-SHA256',
    platformFeePolicy: 'Domain B — 0% Platform Fee (100% Workspace-Owned)',
  },
  {
    id: 'src-campaigns',
    metricLabelVi: 'Chiến Dịch Đã Duyệt & Đang Chạy',
    metricLabelEn: 'Approved & Active Campaigns',
    d1Table: 'd1.campaigns',
    queryColumn: 'COUNT(id) WHERE ceo_approval_digest IS NOT NULL',
    verificationMechanism: 'CEO SHA-256 Payload Signature',
    platformFeePolicy: '$0.00 AI Draft • BYOK Spend Cap Enforced',
  },
  {
    id: 'src-conversions',
    metricLabelVi: 'Tỷ Lệ Chuyển Đổi Thực Tế',
    metricLabelEn: 'Verified Conversion Rate',
    d1Table: 'd1.click_attributions × d1.affiliate_conversions',
    queryColumn: 'verified_conversions / unique_tracked_clicks',
    verificationMechanism: 'Non-Custodial Click-ID Attribution',
    platformFeePolicy: 'Zero Fabricated Social Proof Contract',
  },
  {
    id: 'src-readiness',
    metricLabelVi: 'Trạng Thái Khóa BYOK & Sổ Cái',
    metricLabelEn: 'BYOK Vault & Ledger Readiness',
    d1Table: 'd1.workspace_credentials',
    queryColumn: 'AES-256-GCM encrypted key fingerprint',
    verificationMechanism: 'Tree BYOK Key Format Validator',
    platformFeePolicy: 'Direct Provider Billing (OpenRouter / ElevenLabs)',
  },
] as const;
