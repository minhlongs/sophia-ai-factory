/**
 * Secondary Surfaces Catalog for Sophia AI Factory AEO/GEO.
 * Provides data-driven DualReadPagePayload for 14 secondary public routes.
 * Layer: seed/aeo
 */

import { SOPHIA_BASE_URL, VERIFIED_ISO_DATE } from './ground-truth-catalog';
import { buildEeatTelemetryProof } from './eeat-telemetry-proof';
import type { AeoLocale, AeoSecondarySurface, DualReadPagePayload } from './aeo-types';

interface SecondaryDesc {
  readonly vi: { readonly t: string; readonly s: string };
  readonly en: { readonly t: string; readonly s: string };
}

export const SECONDARY_SURFACE_META: Record<AeoSecondarySurface, SecondaryDesc> = {
  features: {
    vi: { t: 'Tính Năng Nền Tảng Video AI & Tiếp Thị', s: 'Tự động hóa kịch bản, lồng tiếng ElevenLabs và avatar D-ID.' },
    en: { t: 'Platform Features — AI Video Engine', s: 'Automation for AI scripting, voiceover, and multi-channel publishing.' },
  },
  solutions: {
    vi: { t: 'Giải Pháp Video AI Cho 20+ Ngành Nghề', s: 'Công thức hook và kịch bản chuyển đổi theo ngành thương mại.' },
    en: { t: 'Industry-Specific Video Automation', s: 'Tailored psychological hooks and workflows for your commercial niche.' },
  },
  products: {
    vi: { t: 'Danh Mục Gói Cước & Bản Quyền Sophia AI', s: 'Bản quyền vận hành từ BASIC đến MASTER thanh toán USDT / PayOS.' },
    en: { t: 'Product Catalog & Perpetual Licenses', s: 'Factory operational tiers and perpetual licenses via USDT / PayOS.' },
  },
  marketplace: {
    vi: { t: 'Chợ Kịch Bản & Blueprint Video', s: 'Khám phá và triển khai mẫu kịch bản affiliate chuyển đổi cao.' },
    en: { t: 'Creator Video Blueprint Marketplace', s: 'High-converting video blueprints and creator automation recipes.' },
  },
  'sop-marketplace': {
    vi: { t: 'Chợ Quy Trình SOP Doanh Nghiệp', s: 'Thư viện quy trình chuẩn hóa cho đội ngũ sáng tạo và affiliate.' },
    en: { t: 'Enterprise SOP Marketplace', s: 'Standard operating procedures for AI creative teams and agency scaling.' },
  },
  benchmarks: {
    vi: { t: 'Báo Cáo Benchmark Hiệu Suất Nền Tảng', s: 'Chỉ số đo lường render video, Inngest và độ trễ Cloudflare Edge.' },
    en: { t: 'Platform Reliability Benchmarks', s: 'Verified metrics: video render turnaround, Inngest rates, edge latency.' },
  },
  operations: {
    vi: { t: 'Trung Tâm Giám Sát Vận Hành Hàng Đợi', s: 'Theo dõi tác vụ render theo lô, đồng bộ kênh và cảnh báo Telegram.' },
    en: { t: 'Operations Center — Queue Monitoring', s: 'Real-time telemetry for batch render queues and Telegram bot alerts.' },
  },
  partner: {
    vi: { t: 'Cổng Đối Tác Nhãn Trắng & Đại Lý', s: 'Chương trình đại lý hoa hồng trọn đời 35%, hỗ trợ tên miền riêng.' },
    en: { t: 'White-Label Agency & Reseller Portal', s: 'Agency partner program with 35% recurring commissions and custom CNAMEs.' },
  },
  blog: {
    vi: { t: 'Cẩm Nang & Tin Tức Tiếp Thị Video AI', s: 'Chiến lược kiếm tiền faceless YouTube và tối ưu affiliate 2027.' },
    en: { t: 'AI Video Marketing Insights', s: 'Faceless YouTube strategies, affiliate optimization, and 2027 AEO guides.' },
  },
  contact: {
    vi: { t: 'Kênh Liên Hệ & Hỗ Trợ Kỹ Thuật', s: 'Hỗ trợ trực tiếp từ đội ngũ Sophia qua email và Telegram bot.' },
    en: { t: 'Contact Support & Enterprise Inquiries', s: 'Direct support via support@mekongmind.com and autonomous Telegram agents.' },
  },
  terms: {
    vi: { t: 'Điều Khoản Dịch Vụ & Thỏa Thuận', s: 'Quy định pháp lý về sở hữu trí tuệ, mô hình BYOK và điều kiện dùng.' },
    en: { t: 'Terms of Service & Platform Agreement', s: 'Legal conditions governing BYOK key ownership and content rights.' },
  },
  privacy: {
    vi: { t: 'Chính Sách Bảo Mật Dữ Liệu & Mã Hóa', s: 'Khóa API mã hóa cấp cơ sở dữ liệu, không lưu trữ prompt nhạy cảm.' },
    en: { t: 'Privacy Policy & Credential Security', s: 'Customer data protection and encrypted zero-leakage BYOK credentials.' },
  },
  'affiliate-disclosure': {
    vi: { t: 'Nghĩa Vụ Công Khai Minh Bạch Affiliate', s: 'Tuân thủ quy định FTC và minh bạch hoa hồng trên mọi kênh nội dung.' },
    en: { t: 'Affiliate Disclosure & Compliance', s: 'FTC and regulatory disclosure requirements for partners earning commissions.' },
  },
  'affiliate-terms': {
    vi: { t: 'Điều Khoản Đối Tác Tiếp Thị USDT', s: 'Chi trả hoa hồng NET-30 USDT, chống tự ref và cookie 60 ngày.' },
    en: { t: 'Affiliate Program Terms & Settlement', s: 'NET-30 USDT settlements, anti-fraud rules, and 60-day cookie attribution.' },
  },
};

export function buildSecondaryPagePayload(surface: AeoSecondarySurface, locale: AeoLocale): DualReadPagePayload {
  const isVi = locale === 'vi';
  const item = SECONDARY_SURFACE_META[surface];
  const { t: title, s: summary } = isVi ? item.vi : item.en;

  return {
    pageKey: `${surface}-${locale}`,
    surface,
    locale,
    canonicalUrl: `${SOPHIA_BASE_URL}/${locale}/${surface}`,
    title: `Sophia AI Factory — ${title}`,
    answerFirstSummary: summary,
    lastVerifiedIso: VERIFIED_ISO_DATE,
    metrics: [
      { label: isVi ? 'Trạng thái' : 'Status', value: 'Live Edge', sourceNote: 'Cloudflare Workers 2027' },
      { label: isVi ? 'Bảo mật' : 'Security', value: 'BYOK 0% Markup', sourceNote: 'Encrypted Vault' },
      { label: isVi ? 'Hạ tầng' : 'Infrastructure', value: 'Edge CDN', sourceNote: 'Dual-Read Enabled' },
    ],
    comparisonRows: [{
      dimension: isVi ? 'Minh bạch dữ liệu' : 'Data Transparency',
      sophiaValue: isVi ? 'Dual-Read song ngữ HTML + MD' : 'Dual-Read bilingual HTML + MD',
      legacyValue: isVi ? 'Chỉ HTML đóng kín' : 'Opaque legacy HTML',
      advantageMetric: '100% LLM Ready',
    }],
    faqs: [{
      question: isVi ? 'Trang này có thể đọc qua API không?' : 'Can AI agents ingest this page?',
      answer: isVi
        ? 'Có. Bạn có thể thêm đuôi .md vào URL hoặc gửi header Accept: text/markdown để nhận dữ liệu sạch.'
        : 'Yes. Append .md to URL or send Accept: text/markdown header for clean structured markdown.',
    }],
    telemetryProof: buildEeatTelemetryProof(),
  };
}
