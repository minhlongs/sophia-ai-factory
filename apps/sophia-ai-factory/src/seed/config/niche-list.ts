/**
 * Niche List Config — default niche slugs for build-time SSG generation.
 *
 * Used by generateStaticParams to pre-build all known niche landing pages.
 * Also serves as reference for the LLM fallback generator prompt context.
 *
 * @module seed/config/niche-list
 */

/** All known niche slugs. Corresponds to seeded rows in migration 0209. */
export const NICHE_SLUGS: readonly string[] = [
  'real-estate',
  'e-commerce',
  'crypto',
  'health',
  'education',
  'restaurant',
  'fitness',
  'lawyer',
  'insurance',
  'travel',
  'automotive',
  'fashion',
  'gaming',
  'music',
  'photography',
  'beauty',
  'sports',
  'pets',
  'home-services',
  'dental',
  'wedding',
  'saas',
  'nonprofit',
  'construction',
  'logistics',
] as const;

export type NicheSlug = (typeof NICHE_SLUGS)[number];

/** Human-readable niche labels for fallback display (when D1 row not available). */
export const NICHE_LABELS: Record<NicheSlug, { en: string; vi: string }> = {
  'real-estate': { en: 'Real Estate', vi: 'Bất Động Sản' },
  'e-commerce': { en: 'E-Commerce', vi: 'Thương Mại Điện Tử' },
  crypto: { en: 'Crypto', vi: 'Tiền Mã Hóa' },
  health: { en: 'Health', vi: 'Sức Khỏe' },
  education: { en: 'Education', vi: 'Giáo Dục' },
  restaurant: { en: 'Restaurant', vi: 'Nhà Hàng' },
  fitness: { en: 'Fitness', vi: 'Thể Hình' },
  lawyer: { en: 'Lawyer', vi: 'Luật Sư' },
  insurance: { en: 'Insurance', vi: 'Bảo Hiểm' },
  travel: { en: 'Travel', vi: 'Du Lịch' },
  automotive: { en: 'Automotive', vi: 'Ô Tô' },
  fashion: { en: 'Fashion', vi: 'Thời Trang' },
  gaming: { en: 'Gaming', vi: 'Trò Chơi' },
  music: { en: 'Music', vi: 'Âm Nhạc' },
  photography: { en: 'Photography', vi: 'Nhiếp Ảnh' },
  beauty: { en: 'Beauty & Salon', vi: 'Thẩm Mỹ & Salon' },
  sports: { en: 'Sports', vi: 'Thể Thao' },
  pets: { en: 'Pets & Veterinary', vi: 'Thú Cưng & Thú Y' },
  'home-services': { en: 'Home Services', vi: 'Dịch Vụ Nhà Cửa' },
  dental: { en: 'Dental', vi: 'Nha Khoa' },
  wedding: { en: 'Wedding', vi: 'Cưới Hỏi' },
  saas: { en: 'SaaS', vi: 'Phần Mềm SaaS' },
  nonprofit: { en: 'Nonprofit', vi: 'Phi Lợi Nhuận' },
  construction: { en: 'Construction', vi: 'Xây Dựng' },
  logistics: { en: 'Logistics', vi: 'Vận Tải & Logistics' },
};
