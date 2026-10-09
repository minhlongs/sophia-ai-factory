/**
 * Solutions Catalog Lookup & Dynamic Fallback Generator.
 *
 * Provides resolution of canonical slugs, aliases, and 52-niche fallback profiles.
 *
 * Layer: Seed (Configuration and static data, imports only seed)
 *
 * @module seed/config/solutions/solutions-lookup
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';

/** Mapping aliases to canonical slugs for seamless navigation */
export const SOLUTION_ALIASES: Record<string, string> = {
  beauty: 'cosmetics',
  restaurant: 'f-and-b',
  education: 'courses',
  legal: 'lawyer',
  health: 'medical',
  crypto: 'financial-advisor',
  accounting: 'lawyer',
  cleaning: 'home-services',
  spa: 'cosmetics',
  barber: 'cosmetics',
};

/** Get canonical list of primary solution slugs */
export function getAllSolutionSlugs(primarySolutions: readonly SolutionIndustry[]): string[] {
  return primarySolutions.map((s) => s.slug);
}

/**
 * Find solution industry profile by slug or alias.
 * If slug belongs to the broader 52-niche catalog (`NICHE_LABELS`),
 * a high-quality deterministic fallback profile is generated automatically.
 */
export function resolveSolutionIndustry(
  primarySolutions: readonly SolutionIndustry[],
  slugOrAlias: string
): SolutionIndustry {
  const normalized = slugOrAlias.toLowerCase().trim();
  const canonicalSlug = SOLUTION_ALIASES[normalized] || normalized;

  const found = primarySolutions.find((s) => s.slug === canonicalSlug);
  if (found) return found;

  // Fallback generation for any niche in the 52-niche catalog
  const labels = NICHE_LABELS[canonicalSlug as NicheSlug] || {
    en: canonicalSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    vi: canonicalSlug.replace(/-/g, ' '),
  };

  return {
    slug: canonicalSlug,
    nameEn: labels.en,
    nameVi: labels.vi,
    category: 'Commercial Solutions',
    iconName: 'Sparkles',
    heroHeadlineEn: `Scale Your ${labels.en} Business With Automated Viral AI Video Production`,
    heroHeadlineVi: `Bứt Phá Tăng Trưởng Ngành ${labels.vi} Với Video AI Tự Động Triệu View`,
    heroSubheadlineEn: `Generate tailored hooks, high-converting scripts, and automated social videos for ${labels.en} in 60 seconds with Sophia AI Factory.`,
    heroSubheadlineVi: `Tự động tạo câu mở đầu thu hút, kịch bản chuyển đổi cao và video đa kênh cho lĩnh vực ${labels.vi} chỉ trong 60 giây cùng Sophia AI Factory.`,
    painPoints: [
      {
        titleEn: `High Video Production Costs for ${labels.en}`,
        titleVi: `Chi Phí Sản Xuất Video Ngành ${labels.vi} Quá Đắt`,
        descEn: `Traditional videography agencies charge upwards of $2,000/month with lengthy editing turnaround times.`,
        descVi: `Thuê đơn vị quay phim bên ngoài tốn hàng chục triệu mỗi tháng nhưng tốc độ bàn giao rất chậm.`,
      },
      {
        titleEn: `Struggling to Consistently Publish Social Content`,
        titleVi: `Không Đủ Thời Gian Để Đăng Video Đều Đặn`,
        descEn: `Social algorithms punish accounts that fail to upload daily short-form video content.`,
        descVi: `Thuật toán mạng xã hội ưu tiên tài khoản đăng video mỗi ngày, gây áp lực lớn cho đội ngũ marketing.`,
      },
      {
        titleEn: `Low Conversion From Generic Video Ads`,
        titleVi: `Tỉ Lệ Chuyển Đổi Kém Do Video Chung Chung`,
        descEn: `Generic marketing fails to touch real pain points; industry-tailored psychological hooks are essential.`,
        descVi: `Các mẫu quảng cáo rập khuôn không chạm đúng nỗi đau của khách hàng trong ngành ${labels.vi}.`,
      },
    ],
    samplePromptTitleEn: `${labels.en} Viral Short Video Formula`,
    samplePromptTitleVi: `Công Thức Video Ngắn Viral Cho ${labels.vi}`,
    samplePromptEn: `Create a 30-second high-energy problem-solution video for ${labels.en}. Hook: "If you are in ${labels.en} and struggling with customer acquisition in 2026, stop making this one costly mistake."`,
    samplePromptVi: `Tạo video 30 giây giải quyết vấn đề cho ngành ${labels.vi}. Hook: "Nếu bạn đang kinh doanh ${labels.vi} mà chưa có nhiều khách hàng trong năm 2026, dừng ngay lỗi sai tốn kém này lại."`,
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2500,
      traditionalTurnaroundDays: 10,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 60,
      estimatedMonthlySavingsUsd: 2301,
      estimatedVideoOutputPerMonth: 60,
    },
    testimonial: {
      quoteEn: `Sophia transformed how we produce video content for our ${labels.en} business. The ROI has been remarkable.`,
      quoteVi: `Sophia đã thay đổi hoàn toàn cách chúng tôi làm video cho mảng ${labels.vi}. Hiệu quả mang lại vượt xa mong đợi.`,
      author: 'Nguyen Van Anh',
      roleEn: 'Business Owner',
      roleVi: 'Chủ Doanh Nghiệp',
      company: `${labels.en} Enterprise`,
      metrics: '3.4x lead generation increase',
    },
    faqs: [
      {
        questionEn: `How quickly can I generate videos for ${labels.en}?`,
        questionVi: `Mất bao lâu để tạo một video hoàn chỉnh cho ngành ${labels.vi}?`,
        answerEn: `With Sophia AI Factory, input your topic and receive a fully voiced, subtitled 1080p video in 60 seconds.`,
        answerVi: `Với Sophia AI Factory, bạn chỉ cần nhập chủ đề và nhận ngay video 1080p có phụ đề và lồng tiếng sau 60 giây.`,
      },
      {
        questionEn: `Can I claim the SOLO100 promo discount?`,
        questionVi: `Tôi có thể sử dụng mã giảm giá SOLO100 không?`,
        answerEn: `Yes, use promo code SOLO100 at checkout to save $100 immediately on the Starter plan.`,
        answerVi: `Chắc chắn rồi! Hãy nhập mã SOLO100 khi thanh toán để được giảm ngay 2.500.000 VNĐ ($100).`,
      },
    ],
    keywordsEn: [`${canonicalSlug} ai video`, `${canonicalSlug} video marketing`, `${canonicalSlug} reels generator`],
    keywordsVi: [`video ${labels.vi} ai`, `marketing ${labels.vi} tự động`, `tạo clip ${labels.vi} triệu view`],
  };
}
