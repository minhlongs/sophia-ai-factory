/**
 * Solutions Catalog Data Partition — Solopreneur & Creator
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/solopreneur-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const SOLOPRENEUR_SOLUTION: SolutionIndustry = {
  slug: 'solopreneur',
  nameEn: 'Solopreneurs & Creators',
  nameVi: 'Kinh Doanh Độc Lập & Solopreneur',
  category: 'Creator Economy',
  iconName: 'Sparkle',
  heroHeadlineEn: 'Run A 7-Figure Faceless Content Empire As A One-Person Business',
  heroHeadlineVi: 'Vận Hành Đế Chế Video Triệu View Cho Doanh Nghiệp 1 Người',
  heroSubheadlineEn: 'Dominate TikTok, YouTube Shorts, and X without showing your face, hiring employees, or spending all day editing clips.',
  heroSubheadlineVi: 'Thống lĩnh các nền tảng video ngắn mà không cần lộ mặt, không cần thuê nhân viên và không phải ngồi hàng giờ cắt ghép.',
  painPoints: [
    {
      titleEn: 'Severe Solo Burnout',
      titleVi: 'Kiệt Sức Vì Phải Tự Làm Mọi Khâu Một Mình',
      descEn: 'Managing ideation, scriptwriting, voiceover, b-roll selection, editing, and publishing alone causes rapid burnout.',
      descVi: 'Một mình gánh vác từ lên ý tưởng, viết kịch bản, lồng tiếng, tìm tư liệu đến cắt ghép khiến bạn mệt mỏi.',
    },
    {
      titleEn: 'Reluctance to Show Face On-Camera',
      titleVi: 'Không Muốn Xuất Hiện Khuôn Mặt Trên Mạng Xã Hội',
      descEn: 'Many entrepreneurs want to monetize faceless content channels without sacrificing personal privacy.',
      descVi: 'Nhiều người muốn kiếm tiền từ kênh nội dung nhưng không muốn công khai danh tính và đời tư cá nhân.',
    },
    {
      titleEn: 'Inconsistent Content Schedules',
      titleVi: 'Không Duy Trì Được Lịch Đăng Đều Đặn',
      descEn: 'Skipping uploads for a few days ruins algorithmic momentum and stalls traffic growth.',
      descVi: 'Bỏ bê vài ngày không đăng video là thuật toán giảm đề xuất, mất trắng lượng traffic tích lũy.',
    },
  ],
  samplePromptTitleEn: 'Faceless $5K/Mo Business Model Breakdown',
  samplePromptTitleVi: 'Mô Hình Kiếm $5K/Tháng Cho Solopreneur Không Lộ Mặt',
  samplePromptEn: 'Generate a 45-second faceless video breakdown explaining how a solo creator sells $49 digital checklists via short video traffic. Hook: "If you want to build a $5K/month income stream in 2026 without showing your face or taking client calls, here is the roadmap."',
  samplePromptVi: 'Tạo video ngắn 45s chia sẻ cách 1 người xây dựng nguồn thu nhập thụ động từ sản phẩm số qua kênh video ngắn. Hook: "Nếu bạn muốn kiếm 100 triệu mỗi tháng mà không cần lộ mặt hay họp hành với khách, đây là lộ trình 3 bước."',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 1500,
    traditionalTurnaroundDays: 5,
    sophiaMonthlyUsd: 99,
    sophiaTurnaroundSeconds: 30,
    estimatedMonthlySavingsUsd: 1401,
    estimatedVideoOutputPerMonth: 90,
  },
  testimonial: {
    quoteEn: 'I reached my first $5,000 MRR milestone in 45 days running two faceless channels completely powered by Sophia.',
    quoteVi: 'Tôi đạt cột mốc $5.000 MRR đầu tiên chỉ sau 45 ngày vận hành 2 kênh video không lộ mặt được tạo tự động bởi Sophia.',
    author: 'Minh Quan',
    roleEn: 'Solo Digital Entrepreneur',
    roleVi: 'Solopreneur & Nhà Sáng Tạo',
    company: 'Zenith Studio',
    metrics: 'First $5,000 MRR achieved in 45 days',
  },
  faqs: [
    {
      questionEn: 'How does the SOLO100 promo code work for solopreneurs?',
      questionVi: 'Mã ưu đãi SOLO100 áp dụng như thế nào cho người mới khởi nghiệp?',
      answerEn: 'Use code SOLO100 at checkout to receive an instant $100 discount off your Starter plan, bringing it down to just $99/month.',
      answerVi: 'Nhập mã SOLO100 khi đăng ký để được giảm ngay 2.500.000 VNĐ ($100), chỉ còn $99/tháng cho gói Starter.',
    },
  ],
  keywordsEn: ['faceless youtube channel ai', 'solopreneur video automation', 'passive income reels', 'solo creator tools'],
  keywordsVi: ['kênh tiktok không lộ mặt', 'kiếm tiền video ngắn ai', 'solopreneur tự động hóa', 'công cụ tạo video cho 1 người'],
};
