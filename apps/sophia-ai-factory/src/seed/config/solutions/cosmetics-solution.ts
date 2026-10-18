/**
 * Cosmetics Solution Catalog Entry
 * Layer: Seed (Configuration and static data, imports only seed)
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const COSMETICS_SOLUTION: SolutionIndustry = {
  slug: 'cosmetics',
  nameEn: 'Cosmetics & Beauty',
  nameVi: 'Mỹ Phẩm & Thẩm Mỹ',
  category: 'E-Commerce & Retail',
  iconName: 'Sparkles',
  heroHeadlineEn: 'Viral Beauty Demos & Skincare Transformations That Sell Out Inventory',
  heroHeadlineVi: 'Video Biến Hình Mỹ Phẩm & Skincare Viral Cháy Hàng Trong Tích Tắc',
  heroSubheadlineEn: 'Produce hundreds of thumb-stopping before/after reels, ingredient breakdowns, and UGC-style reviews tailored for TikTok Shop and Shopee.',
  heroSubheadlineVi: 'Tự động xuất hàng trăm video biến hình trước/sau, giải mã thành phần và review chân thực chuẩn UGC cho TikTok Shop và Shopee.',
  painPoints: [
    {
      titleEn: 'High KOC / Influencer Booking Fees',
      titleVi: 'Phí Thuê KOC & Beauty Blogger Đắt Đỏ',
      descEn: 'Beauty influencers charge $500 - $2,000 per video with zero guarantee of viral views or sales conversion.',
      descVi: 'Thuê một KOC review tốn từ 10 - 50 triệu/clip nhưng không cam kết ra đơn hay view.',
    },
    {
      titleEn: 'Strict Advertising Compliance Bans',
      titleVi: 'Tài Khoản Dễ Bị Khóa Do Vi Phạm Quảng Cáo',
      descEn: 'Ad accounts get banned for non-compliant claim wording without automated compliance scanning.',
      descVi: 'Nhiều video bị TikTok bóp tương tác do vi phạm chính sách cam kết hiệu quả quá đà.',
    },
    {
      titleEn: 'High Creative Fatigue',
      titleVi: 'Mẫu Video Nhanh Chóng Bị Bão Hòa',
      descEn: 'Beauty ad creatives fatigue within 7 days, demanding a relentless stream of fresh hooks and visual variations.',
      descVi: 'Mỗi mẫu video chỉ chạy hiệu quả 5-7 ngày là cạn tương tác, đòi hỏi liên tục sản xuất góc quay mới.',
    },
  ],
  samplePromptTitleEn: 'Retinol Serum Before & After UGC Script',
  samplePromptTitleVi: 'Kịch Bản UGC Serum Niacinamide Giảm Thâm',
  samplePromptEn: 'Generate a 30-second TikTok UGC-style testimonial addressing stubborn acne marks. Hook: "If you are still scrubbing your skin with physical exfoliants in 2026, stop right now!" Emphasize visible glow in 14 days with clinical ingredient proof.',
  samplePromptVi: 'Tạo video ngắn 30s phong cách KOC chia sẻ kinh nghiệm xử lý thâm mụn. Hook: "Nếu 2026 bạn vẫn còn dùng tẩy tế bào chết hạt to, dừng ngay lại trước khi rách da!" Trình bày thành phần 10% Niacinamide và kết quả sau 14 ngày.',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 2800,
    traditionalTurnaroundDays: 10,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 45,
    estimatedMonthlySavingsUsd: 2601,
    estimatedVideoOutputPerMonth: 80,
  },
  testimonial: {
    quoteEn: 'Our TikTok Shop GMV tripled in two weeks after launching 5 daily Sophia-generated skincare hooks.',
    quoteVi: 'Doanh số TikTok Shop của thương hiệu mỹ phẩm chúng tôi tăng gấp 3 sau khi đăng đều đặn 5 video mỗi ngày từ Sophia.',
    author: 'Chloe Nguyen',
    roleEn: 'Head of Growth',
    roleVi: 'Trưởng Phòng Tăng Trưởng',
    company: 'Aura Derma Lab',
    metrics: '3.2x GMV growth on TikTok Shop',
  },
  faqs: [
    {
      questionEn: 'Can I insert my actual product packaging into generated videos?',
      questionVi: 'Tôi có thể đưa bao bì sản phẩm thật vào video không?',
      answerEn: 'Yes, simply upload your transparent product PNG and Sophia will seamlessly composite it into realistic lifestyle scenes.',
      answerVi: 'Được chứ, chỉ cần tải lên ảnh sản phẩm tách nền, Sophia sẽ ghép tự nhiên vào bối cảnh đời thực và bàn trang điểm.',
    },
    {
      questionEn: 'How does Sophia ensure video claims comply with advertising policies?',
      questionVi: 'Sophia có kiểm duyệt từ ngữ tránh bị bóp tương tác không?',
      answerEn: 'Sophia built-in content filters automatically detect and suggest safe phrasing to protect your TikTok ad accounts from policy bans.',
      answerVi: 'Bộ lọc nội dung của Sophia tự động gợi ý cách dùng từ chuẩn chính sách để video không bị quét từ cấm trên TikTok/Facebook.',
    },
  ],
  keywordsEn: ['beauty ai video generator', 'skincare tiktok ads', 'cosmetics ugc video maker', 'tiktok shop beauty marketing'],
  keywordsVi: ['làm video mỹ phẩm ai', 'quảng cáo skincare tiktok', 'ugc review mỹ phẩm', 'tăng doanh số tiktok shop'],
};
