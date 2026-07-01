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
};
