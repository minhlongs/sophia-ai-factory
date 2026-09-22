/**
 * Sample Video Demo Catalog per Industry Niche
 * Milestone M2 (Requirement R2)
 * Layer: land (domain content and video catalog)
 * @module land/telegram-sales/sample-video-catalog
 */

export interface SampleVideoItem {
  niche: string;
  nicheNameVi: string;
  nicheNameEn: string;
  videoUrl: string;
  durationSec: number;
  retentionRate: string;
  traditionalCost: string;
  sophiaCost: string;
  descriptionVi: string;
  descriptionEn: string;
}

export const SAMPLE_VIDEO_CATALOG: Record<string, SampleVideoItem> = {
  ai_agency: {
    niche: 'ai_agency',
    nicheNameVi: 'AI Automation & Agency',
    nicheNameEn: 'AI Automation & Agency',
    videoUrl: 'https://assets.agencyos.network/demos/demo_ai_agency.mp4',
    durationSec: 42,
    retentionRate: '72%',
    traditionalCost: '4.500.000 VNĐ (~$180)',
    sophiaCost: '82.500 VNĐ (~$3.3)',
    descriptionVi: 'Video AI case study tự động hóa lead gen & phễu chuyển đổi cho B2B Agency.',
    descriptionEn: 'Automated AI case study & lead generation funnel for B2B Agencies.',
  },
  ecommerce: {
    niche: 'ecommerce',
    nicheNameVi: 'E-commerce & Dropshipping',
    nicheNameEn: 'E-commerce & Dropshipping',
    videoUrl: 'https://assets.agencyos.network/demos/demo_ecommerce.mp4',
    durationSec: 35,
    retentionRate: '68%',
    traditionalCost: '3.500.000 VNĐ (~$140)',
    sophiaCost: '75.000 VNĐ (~$3.0)',
    descriptionVi: 'Video review sản phẩm viral đa góc quay, tối ưu tỉ lệ click vào giỏ hàng TikTok Shop.',
    descriptionEn: 'Viral multi-angle product showcase optimized for TikTok Shop checkout conversion.',
  },
  solopreneur: {
    niche: 'solopreneur',
    nicheNameVi: 'Solopreneur & Coaching',
    nicheNameEn: 'Solopreneur & Coaching',
    videoUrl: 'https://assets.agencyos.network/demos/demo_solopreneur.mp4',
    durationSec: 45,
    retentionRate: '65%',
    traditionalCost: '3.000.000 VNĐ (~$120)',
    sophiaCost: '75.000 VNĐ (~$3.0)',
    descriptionVi: 'Avatar AI người thật phát triển thương hiệu cá nhân, chia sẻ kiến thức chuyên sâu.',
    descriptionEn: 'Photorealistic AI avatar building founder personal brand and authoritative thought leadership.',
  },
  real_estate: {
    niche: 'real_estate',
    nicheNameVi: 'Bất Động Sản & Cho Thuê',
    nicheNameEn: 'Real Estate & Rentals',
    videoUrl: 'https://assets.agencyos.network/demos/demo_real_estate.mp4',
    durationSec: 50,
    retentionRate: '64%',
    traditionalCost: '5.000.000 VNĐ (~$200)',
    sophiaCost: '95.000 VNĐ (~$3.8)',
    descriptionVi: 'Giới thiệu căn hộ thực tế ảo, lời bình chuyên nghiệp thu hút khách xem nhà.',
    descriptionEn: 'Virtual property walkthrough with professional AI narration driving booking visits.',
  },
  beauty: {
    niche: 'beauty',
    nicheNameVi: 'Mỹ Phẩm & Thời Trang',
    nicheNameEn: 'Beauty & Fashion',
    videoUrl: 'https://assets.agencyos.network/demos/demo_beauty.mp4',
    durationSec: 30,
    retentionRate: '70%',
    traditionalCost: '3.800.000 VNĐ (~$150)',
    sophiaCost: '75.000 VNĐ (~$3.0)',
    descriptionVi: 'UGC phong cách đời thực trải nghiệm mỹ phẩm, bắt trend âm nhạc TikTok mới nhất.',
    descriptionEn: 'Authentic lifestyle UGC skincare review synced to trending audio.',
  },
  other: {
    niche: 'other',
    nicheNameVi: 'Đa Ngành Nghề Viral',
    nicheNameEn: 'Multi-Industry Viral Demo',
    videoUrl: 'https://assets.agencyos.network/demos/demo_general.mp4',
    durationSec: 40,
    retentionRate: '67%',
    traditionalCost: '3.500.000 VNĐ (~$140)',
    sophiaCost: '75.000 VNĐ (~$3.0)',
    descriptionVi: 'Tổng quan công nghệ tạo video ngắn tự động bằng Sophia AI Factory.',
    descriptionEn: 'Overview of autonomous short-form video generation by Sophia AI Factory.',
  },
};

export function getSampleVideoForNiche(niche?: string | null): SampleVideoItem {
  if (!niche) return SAMPLE_VIDEO_CATALOG.other;
  const normalized = niche.toLowerCase().trim();
  return SAMPLE_VIDEO_CATALOG[normalized] || SAMPLE_VIDEO_CATALOG.other;
}
